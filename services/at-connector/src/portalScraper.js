/**
 * Portal das Finanças — Recibos Verdes Scraper
 *
 * Automates login + download of recibos verdes (green receipts) data
 * from the AT portal using HTTP requests with cookie management.
 *
 * Flow:
 * 1. GET login page → extract CSRF token
 * 2. POST NIF + password → authenticate
 * 3. Follow redirects → get session cookies
 * 4. GET recibos verdes page → extract data
 * 5. Parse and return structured records
 *
 * Falls back to Playwright if HTTP approach fails (optional).
 */

import https from 'node:https';
import http from 'node:http';
import { URL } from 'node:url';
import { Buffer } from 'node:buffer';

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

/**
 * Normalize one AT JSON line into the connector's canonical record shape.
 * Field names vary across portal versions (numDocumento/numero, etc.) so
 * we accept either.
 */
function mapJsonLine(line) {
  return {
    documentNumber: line.numDocumento || line.numero || '',
    documentType: line.tipoDocumento || 'FR',
    documentDate: line.dataEmissao || line.data || '',
    customerNif: line.nifAdquirente || line.nif || '',
    customerName: line.nomeAdquirente || line.nome || '',
    grossTotal: parseFloat(line.valorTotal || line.valor || '0'),
    taxPayable: parseFloat(line.valorIVA || line.iva || '0'),
    netTotal: parseFloat(line.valorBase || line.base || '0'),
    status: line.situacao || line.estado || 'N',
    atcud: line.atcud || '',
  };
}

class CookieJar {
  constructor() {
    this.cookies = {};
  }

  update(setCookieHeaders) {
    if (!setCookieHeaders) return;
    const headers = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders];
    for (const header of headers) {
      const parts = header.split(';')[0].split('=');
      const name = parts[0].trim();
      const value = parts.slice(1).join('=').trim();
      if (name && value) {
        this.cookies[name] = value;
      }
    }
  }

  toString() {
    return Object.entries(this.cookies)
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');
  }
}

function request(url, options = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const isHttps = parsed.protocol === 'https:';
    const lib = isHttps ? https : http;

    const reqOpts = {
      hostname: parsed.hostname,
      port: parsed.port || (isHttps ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: options.method || 'GET',
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'pt-PT,pt;q=0.9,en;q=0.8',
        ...(options.headers || {}),
      },
      // Don't follow redirects automatically
      maxRedirects: 0,
      rejectUnauthorized: true,
      timeout: 30000,
    };

    const req = lib.request(reqOpts, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf-8');
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body,
          url,
        });
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

/**
 * Portal das Finanças Scraper
 */
export class PortalScraper {
  constructor(nif, password) {
    this.nif = nif;
    this.password = password;
    this.jar = new CookieJar();
    this.authenticated = false;
    this.debug = process.env.PORTAL_DEBUG === '1';
  }

  log(...args) {
    if (this.debug) console.log('[portal-scraper]', ...args);
  }

  async fetch(url, options = {}) {
    const headers = {
      ...(options.headers || {}),
      'Cookie': this.jar.toString(),
    };

    this.log(`${options.method || 'GET'} ${url}`);

    const resp = await request(url, { ...options, headers });
    this.jar.update(resp.headers['set-cookie']);

    this.log(`  → ${resp.statusCode} (cookies: ${Object.keys(this.jar.cookies).length})`);

    // Follow redirects manually (up to 10 hops)
    if (options.followRedirects !== false && resp.statusCode >= 300 && resp.statusCode < 400 && resp.headers.location) {
      const redirectUrl = new URL(resp.headers.location, url).toString();
      this.log(`  → redirect to ${redirectUrl}`);
      return this.fetch(redirectUrl, { ...options, method: 'GET', body: undefined });
    }

    return resp;
  }

  /**
   * Login to Portal das Finanças
   */
  async login() {
    // Step 1: Get login page to extract CSRF token
    const partID = 'PFAP';
    const targetPath = '/consultarDocumentosEmitidos.action';
    const loginFormUrl = `https://www.acesso.gov.pt/v2/loginForm?partID=${partID}&path=${encodeURIComponent(targetPath)}`;

    const loginPage = await this.fetch(loginFormUrl, { followRedirects: true });

    if (loginPage.statusCode !== 200) {
      throw new Error(`Login page returned HTTP ${loginPage.statusCode}`);
    }

    // Extract CSRF token (multiple formats: HTML input, JSON, or JS template literal)
    let csrf = null;
    const csrfMatch = loginPage.body.match(/name="_csrf"[^>]*value="([^"]+)"/);
    if (csrfMatch) {
      csrf = csrfMatch[1];
    } else {
      // JSON format: "_csrf": "token-value"
      const jsonMatch = loginPage.body.match(/"_csrf"\s*:\s*"([^"]+)"/);
      if (jsonMatch) {
        csrf = jsonMatch[1];
      } else {
        // JS template literal: token: `uuid-value`
        const templateMatch = loginPage.body.match(/token:\s*`([^`]+)`/);
        if (templateMatch) {
          csrf = templateMatch[1];
        }
      }
    }
    if (!csrf) {
      throw new Error('Could not extract CSRF token from login page');
    }

    this.log('CSRF token:', csrf.slice(0, 8) + '...');

    // Step 2: POST credentials
    const formBody = new URLSearchParams({
      '_csrf': csrf,
      'selectedAuthMethod': 'NIF',
      'username': this.nif,
      'password': this.password,
      'partID': partID,
      'path': targetPath,
    }).toString();

    const loginResp = await this.fetch('https://www.acesso.gov.pt/v2/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Referer': loginFormUrl,
        'Origin': 'https://www.acesso.gov.pt',
      },
      body: formBody,
      followRedirects: true,
    });

    // Check if login succeeded
    const isError = loginResp.body.includes('Credenciais inválidas') ||
                    loginResp.body.includes('dados incorretos') ||
                    loginResp.body.includes('Invalid credentials') ||
                    loginResp.body.includes('loginForm');

    if (isError && !loginResp.body.includes('consultarDocumentos')) {
      throw new Error('Login failed — invalid NIF or password');
    }

    this.authenticated = true;
    this.log('Login successful');
    return true;
  }

  /**
   * Fetch issued documents ("documentos emitidos") from the portal.
   *
   * AT's JSON endpoint `obterDocumentosEmitidos.action` has been observed to
   * return an empty body (HTTP 200 but rawLength=0) for authenticated
   * sessions when the request does not carry an `ano` param. We now:
   *   1. Visit `/consultarDocumentosEmitidos.action?ano=<year>` FIRST so the
   *      portal seeds its server-side session state for that year.
   *   2. Call the JSON endpoint with BOTH `ano` AND the date filters.
   *   3. If still empty, try the HTML view (the table is rendered server-side).
   *   4. If still empty, fall back to the legacy recibos-verdes endpoints.
   *
   * The return payload always includes diagnostic fields so callers can see
   * WHICH endpoint produced the records (or that the response was empty).
   */
  async fetchRecibosVerdes(startDate, endDate) {
    if (!this.authenticated) {
      await this.login();
    }

    const year = startDate ? startDate.slice(0, 4) : new Date().getFullYear().toString();
    const attempts = [];

    // Step 1: seed the year context
    const consultUrl = `https://faturas.portaldasfinancas.gov.pt/consultarDocumentosEmitidos.action?ano=${year}`;
    const consultPage = await this.fetch(consultUrl, { followRedirects: true });
    attempts.push({ url: consultUrl, status: consultPage.statusCode, rawLength: consultPage.body.length, purpose: 'seed-year' });
    this.log('Consult page status:', consultPage.statusCode, 'len:', consultPage.body.length);

    if (consultPage.body.includes('loginForm') || consultPage.body.includes('acesso.gov.pt/v2/login')) {
      throw new Error('Session expired — re-login required');
    }

    // Step 2: JSON endpoint. The `obterDocumentosEmitidos.action` endpoint has
    // been observed returning HTTP 500 when parameters are present but empty
    // (e.g. `tipoDocumento=` with no value). Try a matrix of parameter shapes
    // until one succeeds or all return 500.
    let records = [];
    let endpointHit = null;
    let jsonShape = null;
    let lastStatus = null;
    let lastRawLength = null;

    const jsonVariants = [
      // Minimal: only year + date filters, no empty tipoDocumento or nifAdquirente
      `https://faturas.portaldasfinancas.gov.pt/json/obterDocumentosEmitidos.action?ano=${year}&dataInicioFilter=${startDate || ''}&dataFimFilter=${endDate || ''}&ambitoPesquisa=emitidos`,
      // Alternate ambit naming
      `https://faturas.portaldasfinancas.gov.pt/json/obterDocumentosEmitidos.action?ano=${year}&dataInicioFilter=${startDate || ''}&dataFimFilter=${endDate || ''}&ambitoPesquisa=prestador`,
      // Full shape (original) with empty params
      `https://faturas.portaldasfinancas.gov.pt/json/obterDocumentosEmitidos.action?ano=${year}&dataInicioFilter=${startDate || ''}&dataFimFilter=${endDate || ''}&ambitoPesquisa=emitidos&tipoDocumento=&nifAdquirente=`,
      // Without the Filter suffix (older portal API)
      `https://faturas.portaldasfinancas.gov.pt/json/obterDocumentosEmitidos.action?ano=${year}&dataInicio=${startDate || ''}&dataFim=${endDate || ''}&ambitoPesquisa=emitidos`,
    ];

    for (const jsonUrl of jsonVariants) {
      const jsonResp = await this.fetch(jsonUrl, {
        followRedirects: true,
        headers: {
          'Accept': 'application/json, text/javascript, */*; q=0.01',
          'X-Requested-With': 'XMLHttpRequest',
          'Referer': consultUrl,
        },
      });
      attempts.push({ url: jsonUrl, status: jsonResp.statusCode, rawLength: jsonResp.body.length, purpose: 'json-variant' });
      this.log('JSON variant status:', jsonResp.statusCode, 'len:', jsonResp.body.length, 'url:', jsonUrl.slice(-80));
      lastStatus = jsonResp.statusCode;
      lastRawLength = jsonResp.body.length;

      if (jsonResp.statusCode >= 200 && jsonResp.statusCode < 300 && jsonResp.body.length > 0) {
        try {
          const jsonData = JSON.parse(jsonResp.body);
          jsonShape = Object.keys(jsonData).join(',');
          if (jsonData.linhas && Array.isArray(jsonData.linhas) && jsonData.linhas.length > 0) {
            records = jsonData.linhas.map(mapJsonLine);
            endpointHit = 'json-obterDocumentosEmitidos';
            break;
          }
          // If structure is valid but empty, stop trying further variants.
          if (jsonData.linhas && Array.isArray(jsonData.linhas)) break;
        } catch {
          // Not JSON — try the next variant.
        }
      }
    }

    // Step 3: HTML table on the consult page (the page itself renders rows server-side)
    if (records.length === 0 && consultPage.body.length > 0) {
      const htmlRecords = this.parseHtmlTable(consultPage.body);
      // Diagnostic: count ATCUD patterns in the HTML. If > 0 here but
      // parseHtmlTable found no rows, the table shape is different than our
      // regex expects and we need to refine the parser (not that data is
      // absent).
      const atcudMatches = (consultPage.body.match(/[A-Z0-9]{8}-\d+/g) || []).slice(0, 5);
      const trCount = (consultPage.body.match(/<tr[\s>]/gi) || []).length;
      const tdCount = (consultPage.body.match(/<td[\s>]/gi) || []).length;
      this.log('HTML diag: tr=', trCount, 'td=', tdCount, 'atcuds_sample=', atcudMatches.join(','));
      attempts.push({
        url: consultUrl,
        status: consultPage.statusCode,
        rawLength: consultPage.body.length,
        purpose: 'html-consult-page',
        parsed: htmlRecords.length,
        trCount,
        tdCount,
        atcudSample: atcudMatches,
      });
      if (htmlRecords.length > 0) {
        records = htmlRecords;
        endpointHit = 'html-consultarDocumentosEmitidos';
      }
    }

    // Step 3.5: Excel export URLs (different code path on AT; when the JSON
    // endpoint errors with 500 these often still work because they go through
    // the reporting pipeline instead of the AJAX renderer).
    if (records.length === 0) {
      const excelUrls = [
        `https://faturas.portaldasfinancas.gov.pt/exportarDocumentosEmitidos.action?ano=${year}&dataInicioFilter=${startDate || ''}&dataFimFilter=${endDate || ''}&ambitoPesquisa=emitidos`,
        `https://faturas.portaldasfinancas.gov.pt/exportarListaDocumentosEmitidos.action?ano=${year}&dataInicioFilter=${startDate || ''}&dataFimFilter=${endDate || ''}&ambitoPesquisa=emitidos`,
        `https://faturas.portaldasfinancas.gov.pt/consultarDocumentosEmitidos.action?ano=${year}&dataInicioFilter=${startDate || ''}&dataFimFilter=${endDate || ''}&ambitoPesquisa=emitidos&exportar=excel`,
      ];
      for (const excelUrl of excelUrls) {
        const excelResp = await this.fetch(excelUrl, {
          followRedirects: true,
          headers: {
            'Accept': 'application/vnd.ms-excel, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, text/csv, */*',
            'Referer': consultUrl,
          },
        });
        attempts.push({ url: excelUrl, status: excelResp.statusCode, rawLength: excelResp.body.length, purpose: 'excel-export' });
        this.log('Excel export status:', excelResp.statusCode, 'len:', excelResp.body.length);
        // If we got a reasonable-size body that isn't an HTML error page, it's
        // probably a spreadsheet. We can't parse XLS in pure Node without
        // dependencies, but we surface the byte count so the caller can choose
        // to forward the bytes to a sheet parser. Also try to parse as CSV or
        // TSV if the body looks like text.
        if (excelResp.statusCode === 200 && excelResp.body.length > 200 && !excelResp.body.includes('<html')) {
          endpointHit = 'excel-export-' + excelUrl.split('/').pop().split('?')[0];
          // Record bytes in notes so the caller can decide whether to shell out
          // to a parser. For now we don't attempt to parse XLS client-side.
          this.log('Excel export succeeded; bytes=', excelResp.body.length, 'hit=', endpointHit);
          // TODO: pipe to node-xlsx or similar; for now return empty records but
          // annotate the endpoint so the caller knows automation is one step
          // away (user can download manually from the same URL).
          break;
        }
      }
    }

    // Step 4: legacy recibos-verdes endpoints
    if (records.length === 0) {
      this.log('Trying legacy recibos verdes endpoint...');
      const legacyRecords = await this.fetchLegacyRecibos(startDate, endDate);
      if (legacyRecords.length > 0) {
        records = legacyRecords;
        endpointHit = 'legacy-recibos-verdes';
      }
    }

    return {
      success: true,
      totalRecords: records.length,
      records,
      authenticated: this.authenticated,
      method: 'http-scraper',
      rawLength: lastRawLength,
      httpStatus: lastStatus,
      jsonShape,
      endpointHit,
      attempts,
      notes: records.length === 0
        ? `All endpoints returned empty. Tried ${attempts.length} URL(s). Last HTTP=${lastStatus}, rawLen=${lastRawLength}.`
        : null,
    };
  }

  /**
   * Try the legacy recibos verdes endpoint
   */
  async fetchLegacyRecibos(startDate, endDate) {
    const urls = [
      `https://irs.portaldasfinancas.gov.pt/recibos/portal/consultar/emitidos`,
      `https://faturas.portaldasfinancas.gov.pt/consultarRecibosVerdes.action`,
      `https://faturas.portaldasfinancas.gov.pt/json/obterRecibosVerdes.action?dataInicio=${startDate || ''}&dataFim=${endDate || ''}`,
    ];

    for (const url of urls) {
      try {
        const resp = await this.fetch(url, {
          followRedirects: true,
          headers: {
            'Accept': 'application/json, text/html, */*',
            'X-Requested-With': 'XMLHttpRequest',
          },
        });

        if (resp.statusCode === 200 && resp.body.length > 100) {
          try {
            const data = JSON.parse(resp.body);
            if (data.linhas || data.recibos || data.documentos) {
              const items = data.linhas || data.recibos || data.documentos || [];
              return items.map(item => ({
                documentNumber: item.numDocumento || item.numero || item.referencia || '',
                documentType: 'FR',
                documentDate: item.dataEmissao || item.data || item.dataInicio || '',
                customerNif: item.nifAdquirente || item.nif || item.nifCliente || '',
                customerName: item.nomeAdquirente || item.nome || item.nomeCliente || '',
                grossTotal: parseFloat(item.valorTotal || item.valor || item.importancia || '0'),
                taxPayable: parseFloat(item.valorIVA || item.iva || '0'),
                netTotal: parseFloat(item.valorBase || item.valorLiquido || '0'),
                status: item.situacao || item.estado || 'N',
                atcud: item.atcud || '',
              }));
            }
          } catch {
            // Not JSON, try HTML
            const htmlRecords = this.parseHtmlTable(resp.body);
            if (htmlRecords.length > 0) return htmlRecords;
          }
        }
      } catch (err) {
        this.log(`  ${url} failed:`, err.message);
      }
    }

    return [];
  }

  /**
   * Parse HTML table rows into records
   */
  parseHtmlTable(html) {
    const records = [];
    // Match table rows with invoice data
    const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;

    let rowMatch;
    while ((rowMatch = rowRegex.exec(html)) !== null) {
      const cells = [];
      let cellMatch;
      const rowContent = rowMatch[1];
      while ((cellMatch = cellRegex.exec(rowContent)) !== null) {
        cells.push(cellMatch[1].replace(/<[^>]+>/g, '').trim());
      }

      // Typical AT table: Date | Type | Number | NIF | Name | Amount | Status
      if (cells.length >= 5) {
        const dateStr = cells.find(c => /\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4}/.test(c)) || cells[0];
        const nifCell = cells.find(c => /^\d{9}$/.test(c.replace(/\s/g, ''))) || '';
        const amountCell = cells.find(c => /^\d+[.,]\d{2}$/.test(c.replace(/\s/g, '').replace('€', ''))) || '0';

        if (dateStr && /\d/.test(dateStr)) {
          records.push({
            documentNumber: cells[2] || '',
            documentType: cells[1] || 'FR',
            documentDate: this.normalizeDate(dateStr),
            customerNif: nifCell.replace(/\s/g, ''),
            customerName: cells[4] || '',
            grossTotal: parseFloat(amountCell.replace(/\s/g, '').replace('€', '').replace(',', '.')) || 0,
            taxPayable: 0,
            netTotal: 0,
            status: 'N',
            atcud: '',
          });
        }
      }
    }

    return records;
  }

  normalizeDate(dateStr) {
    // Convert DD/MM/YYYY to YYYY-MM-DD
    const dmy = dateStr.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
    return dateStr;
  }
}

/**
 * Standalone function for use from AT connector
 */
export async function scrapeRecibosVerdes({ nif, password, startDate, endDate, debug }) {
  if (debug) process.env.PORTAL_DEBUG = '1';

  const scraper = new PortalScraper(nif, password);
  try {
    await scraper.login();
    const result = await scraper.fetchRecibosVerdes(startDate, endDate);
    return result;
  } catch (err) {
    return {
      success: false,
      error: err.message,
      authenticated: scraper.authenticated,
    };
  }
}
