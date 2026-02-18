import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';
import crypto from 'node:crypto';

const PORT = Number(process.env.PORT || 8787);
const CONNECTOR_TOKEN = process.env.CONNECTOR_TOKEN || '';

const AT_PFX_PATH = process.env.AT_PFX_PATH || '';
const AT_PFX_PASSPHRASE = process.env.AT_PFX_PASSPHRASE || '';
const AT_KEY_PEM_PATH = process.env.AT_KEY_PEM_PATH || '';
const AT_CERT_PEM_PATH = process.env.AT_CERT_PEM_PATH || '';
const AT_KEY_PEM_PASSPHRASE = process.env.AT_KEY_PEM_PASSPHRASE || '';
const AT_PUBLIC_CERT_PATH = process.env.AT_PUBLIC_CERT_PATH || '';

const AT_TLS_MIN_VERSION = process.env.AT_TLS_MIN_VERSION || 'TLSv1.2';
const AT_TLS_CIPHERS = process.env.AT_TLS_CIPHERS || '';
const AT_TLS_LEGACY_SERVER_CONNECT = process.env.AT_TLS_LEGACY_SERVER_CONNECT === '1';
const AT_DOCS_PER_PAGE = Math.min(
  5000,
  Math.max(1, Number(process.env.AT_DOCS_PER_PAGE || 5000))
);

if (!CONNECTOR_TOKEN) {
  console.error('[at-connector] Missing CONNECTOR_TOKEN');
  process.exit(1);
}

const hasPfxIdentity = Boolean(AT_PFX_PATH && AT_PFX_PASSPHRASE);
const hasPemIdentity = Boolean(AT_KEY_PEM_PATH && AT_CERT_PEM_PATH);

if (!AT_PUBLIC_CERT_PATH) {
  console.error('[at-connector] Missing AT_PUBLIC_CERT_PATH');
  process.exit(1);
}
if (!hasPfxIdentity && !hasPemIdentity) {
  console.error('[at-connector] Missing TLS identity. Provide either:');
  console.error('  - AT_PFX_PATH + AT_PFX_PASSPHRASE, or');
  console.error('  - AT_KEY_PEM_PATH + AT_CERT_PEM_PATH (+ optional AT_KEY_PEM_PASSPHRASE)');
  process.exit(1);
}

const tlsIdentity = hasPemIdentity
  ? {
      key: fs.readFileSync(AT_KEY_PEM_PATH),
      cert: fs.readFileSync(AT_CERT_PEM_PATH),
      ...(AT_KEY_PEM_PASSPHRASE ? { passphrase: AT_KEY_PEM_PASSPHRASE } : {}),
    }
  : {
      pfx: fs.readFileSync(AT_PFX_PATH),
      passphrase: AT_PFX_PASSPHRASE,
    };

const atPublicCertBytes = fs.readFileSync(AT_PUBLIC_CERT_PATH);
const atX509 = new crypto.X509Certificate(atPublicCertBytes);
const atPublicKey = atX509.publicKey;

const AT_ENDPOINTS = {
  invoiceQuery: {
    test: 'https://servicos.portaldasfinancas.gov.pt:725/fatshare/ws/fatshareFaturas',
    production: 'https://servicos.portaldasfinancas.gov.pt:425/fatshare/ws/fatshareFaturas',
  },
};

const secureOptions = AT_TLS_LEGACY_SERVER_CONNECT
  ? crypto.constants.SSL_OP_LEGACY_SERVER_CONNECT
  : 0;

// Global agent: cert identifies the software (producer) and can be reused.
const soapAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 20,
  ...tlsIdentity,
  minVersion: AT_TLS_MIN_VERSION,
  ...(AT_TLS_CIPHERS ? { ciphers: AT_TLS_CIPHERS, honorCipherOrder: true } : {}),
  ...(secureOptions ? { secureOptions } : {}),
});

function json(res, statusCode, body) {
  const payload = JSON.stringify(body);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

function readJson(req, maxBytes = 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > maxBytes) {
        reject(new Error('Payload too large'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch (e) {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

function requireAuth(req) {
  const h = req.headers.authorization || '';
  if (!h.startsWith('Bearer ')) return false;
  const token = h.slice('Bearer '.length);
  // constant-time compare
  const a = Buffer.from(token);
  const b = Buffer.from(CONNECTOR_TOKEN);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function aes128EcbPkcs5Encrypt(plainUtf8, key16) {
  const cipher = crypto.createCipheriv('aes-128-ecb', key16, null);
  cipher.setAutoPadding(true);
  return Buffer.concat([cipher.update(Buffer.from(plainUtf8, 'utf8')), cipher.final()]);
}

function generateWSSecurityHeader(username, password) {
  const ks = crypto.randomBytes(16);
  const created = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

  const encPassword = aes128EcbPkcs5Encrypt(password, ks).toString('base64');
  const encCreated = aes128EcbPkcs5Encrypt(created, ks).toString('base64');

  const encNonce = crypto.publicEncrypt(
    { key: atPublicKey, padding: crypto.constants.RSA_PKCS1_PADDING },
    ks
  ).toString('base64');

  return { username, encPassword, encNonce, encCreated };
}

function buildInvoiceQueryEnvelope(security, params) {
  const bodyParts = [];
  if (params.taxRegistrationNumber) {
    bodyParts.push(`<fat:TaxRegistrationNumber>${params.taxRegistrationNumber}</fat:TaxRegistrationNumber>`);
  }
  if (params.customerTaxId) {
    bodyParts.push(`<fat:CustomerTaxID>${params.customerTaxId}</fat:CustomerTaxID>`);
  }
  bodyParts.push(`<fat:StartDate>${params.startDate}</fat:StartDate>`);
  bodyParts.push(`<fat:EndDate>${params.endDate}</fat:EndDate>`);
  bodyParts.push(`<fat:Pagination><fat:nPage>${params.nPage}</fat:nPage><fat:nDocsPage>${params.nDocsPage}</fat:nDocsPage></fat:Pagination>`);

  return `<?xml version="1.0" encoding="UTF-8"?>
<S:Envelope xmlns:S="http://schemas.xmlsoap.org/soap/envelope/">
  <S:Header>
    <wss:Security xmlns:wss="http://schemas.xmlsoap.org/ws/2002/12/secext">
      <wss:UsernameToken>
        <wss:Username>${security.username}</wss:Username>
        <wss:Password>${security.encPassword}</wss:Password>
        <wss:Nonce>${security.encNonce}</wss:Nonce>
        <wss:Created>${security.encCreated}</wss:Created>
      </wss:UsernameToken>
    </wss:Security>
  </S:Header>
  <S:Body>
    <fat:InvoicesRequest xmlns:fat="http://at.gov.pt/fatshare/ws/">
      ${bodyParts.join('\n      ')}
    </fat:InvoicesRequest>
  </S:Body>
</S:Envelope>`;
}

function decodeXmlEntities(s) {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function parseInvoicesResponse(xmlText) {
  const out = {
    success: false,
    totalRecords: 0,
    totalPages: 1,
    page: 1,
    totalDocsSent: 0,
    invoices: [],
    errorMessage: undefined,
  };

  if (xmlText.includes(':Fault')) {
    const m = xmlText.match(/<faultstring>([^<]*)<\/faultstring>/i);
    out.errorMessage = m ? decodeXmlEntities(m[1]) : 'SOAP Fault';
    return out;
  }

  const getTag = (xml, tag) => {
    const re = new RegExp(`<(?:\\\\w+:)?${tag}>([^<]*)<\\\\/(?:\\\\w+:)?${tag}>`);
    const m = xml.match(re);
    return m ? decodeXmlEntities(m[1]) : '';
  };
  const getInt = (xml, tag) => Number(getTag(xml, tag)) || 0;

  const estado = getInt(xmlText, 'EstadoOperacao');
  const desc = getTag(xmlText, 'Desc');
  if (estado && estado !== 200) {
    out.errorMessage = desc || `EstadoOperacao ${estado}`;
    return out;
  }

  // Pagination totals
  out.totalRecords = getInt(xmlText, 'totalDocs') || getInt(xmlText, 'TotalRecords') || 0;
  out.totalDocsSent = getInt(xmlText, 'totalDocsSent') || 0;
  out.totalPages = getInt(xmlText, 'totalPages') || 1;
  out.page = getInt(xmlText, 'nPage') || 1;

  const invoiceRe = /<(?:\w+:)?Invoice>([\s\S]*?)<\/(?:\w+:)?Invoice>/g;
  const lineRe = /<(?:\w+:)?LineSummary>([\s\S]*?)<\/(?:\w+:)?LineSummary>/g;

  const getNum = (xml, tag) => Number(getTag(xml, tag)) || 0;

  for (const m of xmlText.matchAll(invoiceRe)) {
    const invoiceXml = m[1];
    const lineSummary = [];
    for (const lm of invoiceXml.matchAll(lineRe)) {
      const lineXml = lm[1];
      const baseAmount =
        Number(getTag(lineXml, 'TotalTaxBase')) ||
        Number(getTag(lineXml, 'NetAmount')) ||
        Number(getTag(lineXml, 'Amount')) ||
        0;
      const taxAmount =
        Number(getTag(lineXml, 'TaxAmount')) ||
        Number(getTag(lineXml, 'TotalTaxAmount')) ||
        0;
      lineSummary.push({
        taxCode: getTag(lineXml, 'TaxCode') || 'NOR',
        taxPercentage: Number(getTag(lineXml, 'TaxPercentage')) || 0,
        taxCountryRegion: getTag(lineXml, 'TaxCountryRegion') || 'PT',
        amount: baseAmount,
        taxAmount,
      });
    }

    out.invoices.push({
      supplierNif: getTag(invoiceXml, 'SupplierNIF') || getTag(invoiceXml, 'TaxRegistrationNumber'),
      supplierName: getTag(invoiceXml, 'SupplierName') || getTag(invoiceXml, 'CompanyName'),
      customerNif: getTag(invoiceXml, 'CustomerNIF') || getTag(invoiceXml, 'CustomerTaxID'),
      customerName: getTag(invoiceXml, 'CustomerName') || undefined,
      documentNumber: getTag(invoiceXml, 'DocumentNumber') || getTag(invoiceXml, 'InvoiceNo'),
      documentDate: getTag(invoiceXml, 'DocumentDate') || getTag(invoiceXml, 'InvoiceDate'),
      documentType: getTag(invoiceXml, 'DocumentType') || getTag(invoiceXml, 'InvoiceType') || 'FT',
      atcud: getTag(invoiceXml, 'ATCUD') || undefined,
      grossTotal: getNum(invoiceXml, 'GrossTotal'),
      netTotal: getNum(invoiceXml, 'NetTotal'),
      taxPayable: getNum(invoiceXml, 'TaxPayable'),
      lineSummary,
    });
  }

  out.success = true;
  return out;
}

function requestSoap(urlString, xmlBody) {
  const url = new URL(urlString);

  const reqOptions = {
    method: 'POST',
    protocol: url.protocol,
    hostname: url.hostname,
    port: url.port,
    path: url.pathname,
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      'Accept': 'text/xml',
      'Content-Length': Buffer.byteLength(xmlBody),
      'User-Agent': 'iva-inteligente/at-connector',
    },
    agent: soapAgent,
  };

  return new Promise((resolve, reject) => {
    const req = https.request(reqOptions, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode || 0,
          headers: res.headers,
          body: Buffer.concat(chunks).toString('utf8'),
        });
      });
    });
    req.on('error', reject);
    req.write(xmlBody);
    req.end();
  });
}

function parseDateUTC(s) {
  const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

function fmtDateUTC(d) {
  return d.toISOString().slice(0, 10);
}

function addDaysUTC(d, days) {
  const out = new Date(d);
  out.setUTCDate(out.getUTCDate() + days);
  return out;
}

function splitMonthlyRanges(startDate, endDate) {
  const start = parseDateUTC(startDate);
  const end = parseDateUTC(endDate);
  if (!start || !end) return [];
  const ranges = [];

  let cur = start;
  while (cur <= end) {
    const y = cur.getUTCFullYear();
    const m = cur.getUTCMonth();
    const monthEnd = new Date(Date.UTC(y, m + 1, 0));
    const rEnd = monthEnd < end ? monthEnd : end;
    ranges.push({ startDate: fmtDateUTC(cur), endDate: fmtDateUTC(rEnd) });
    cur = addDaysUTC(rEnd, 1);
  }

  return ranges;
}

async function queryInvoicesSingleMonth({ environment, clientNif, username, password, direction, startDate, endDate }) {
  const endpoint = AT_ENDPOINTS.invoiceQuery[environment];

  const invoices = [];
  let totalPages = 1;
  let totalRecords = 0;

  for (let nPage = 1; nPage <= totalPages; nPage++) {
    const security = generateWSSecurityHeader(username, password);

    const envelope = buildInvoiceQueryEnvelope(security, {
      taxRegistrationNumber: direction === 'vendas' ? clientNif : undefined,
      customerTaxId: direction === 'compras' ? clientNif : undefined,
      startDate,
      endDate,
      nPage,
      nDocsPage: AT_DOCS_PER_PAGE,
    });

    const soapResp = await requestSoap(endpoint, envelope);
    if (soapResp.statusCode < 200 || soapResp.statusCode >= 300) {
      return {
        success: false,
        totalRecords: 0,
        invoices: [],
        errorMessage: `HTTP ${soapResp.statusCode}`,
        rawPreview: soapResp.body.slice(0, 500),
      };
    }

    const parsed = parseInvoicesResponse(soapResp.body);
    if (!parsed.success) return parsed;

    totalRecords = parsed.totalRecords || totalRecords;
    totalPages = parsed.totalPages || totalPages;
    invoices.push(...(parsed.invoices || []));
  }

  return { success: true, totalRecords, invoices };
}

async function queryInvoices({ environment, clientNif, username, password, direction, startDate, endDate }) {
  const ranges = splitMonthlyRanges(startDate, endDate);
  if (ranges.length === 0) {
    return { success: false, totalRecords: 0, invoices: [], errorMessage: 'Invalid date range' };
  }

  let totalRecords = 0;
  const invoices = [];

  for (const r of ranges) {
    const rResp = await queryInvoicesSingleMonth({
      environment,
      clientNif,
      username,
      password,
      direction,
      startDate: r.startDate,
      endDate: r.endDate,
    });
    if (!rResp.success) return rResp;
    totalRecords += Number(rResp.totalRecords) || 0;
    invoices.push(...(rResp.invoices || []));
  }

  return { success: true, totalRecords, invoices };
}

function isValidDate(s) {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    return json(res, 200, { ok: true });
  }

  if (req.method === 'POST' && req.url === '/v1/invoices') {
    if (!requireAuth(req)) {
      return json(res, 401, { success: false, error: 'Unauthorized' });
    }

    let body;
    try {
      body = await readJson(req);
    } catch (e) {
      return json(res, 400, { success: false, error: e.message || 'Bad request' });
    }

    const {
      environment = 'production',
      clientNif,
      username,
      password,
      type = 'compras',
      startDate,
      endDate,
    } = body || {};

    if (environment !== 'test' && environment !== 'production') {
      return json(res, 400, { success: false, error: 'Invalid environment' });
    }
    if (!clientNif || typeof clientNif !== 'string') {
      return json(res, 400, { success: false, error: 'clientNif is required' });
    }
    if (!username || typeof username !== 'string' || !password || typeof password !== 'string') {
      return json(res, 400, { success: false, error: 'username/password are required' });
    }
    if (!isValidDate(startDate) || !isValidDate(endDate)) {
      return json(res, 400, { success: false, error: 'startDate/endDate must be YYYY-MM-DD' });
    }

    const wantCompras = type === 'compras' || type === 'ambos';
    const wantVendas = type === 'vendas' || type === 'ambos';

    const startedAt = Date.now();
    try {
      const resp = { success: true };
      if (wantCompras) {
        resp.compras = await queryInvoices({
          environment,
          clientNif,
          username,
          password,
          direction: 'compras',
          startDate,
          endDate,
        });
      }
      if (wantVendas) {
        resp.vendas = await queryInvoices({
          environment,
          clientNif,
          username,
          password,
          direction: 'vendas',
          startDate,
          endDate,
        });
      }
      resp.timingMs = Date.now() - startedAt;
      return json(res, 200, resp);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return json(res, 502, { success: false, error: msg });
    }
  }

  json(res, 404, { success: false, error: 'Not found' });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[at-connector] listening on :${PORT}`);
});
