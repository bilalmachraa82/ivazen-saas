/**
 * Portal das Financas — Recibos Verdes Scraper (Playwright)
 *
 * Uses a real headless Chromium browser via playwright-core to handle
 * the acesso.gov.pt JS SPA login flow, which the HTTP-based scraper
 * cannot reliably complete.
 *
 * Flow:
 * 1. Launch headless Chromium
 * 2. Navigate to acesso.gov.pt login form (PFAP partID)
 * 3. Select NIF auth method, fill credentials, submit
 * 4. Wait for redirect to portaldasfinancas.gov.pt
 * 5. Navigate to consultarDocumentosEmitidos.action
 * 6. Try JSON API first via page.evaluate fetch
 * 7. Fallback: parse HTML table
 * 8. Return structured records
 */

import { chromium } from 'playwright-core';

const CHROMIUM_PATH = process.env.CHROMIUM_PATH || '/usr/bin/chromium';
const DEFAULT_TIMEOUT = 30_000;

/**
 * @param {string} dateStr - Date in DD/MM/YYYY format
 * @returns {string} Date in YYYY-MM-DD format
 */
function normalizeDateDMY(dateStr) {
  const m = dateStr.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return dateStr;
}

/**
 * Parse JSON records from the AT portal API response into a uniform shape.
 * @param {Array} linhas - Array of line items from the AT JSON API
 * @returns {Array} Normalized records
 */
function mapJsonRecords(linhas) {
  return linhas.map((line) => ({
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
  }));
}

/**
 * Parse HTML table rows from portal page content into records.
 * @param {string} html - Raw HTML string
 * @returns {Array} Parsed records
 */
function parseHtmlTable(html) {
  const records = [];
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

    if (cells.length >= 5) {
      const dateStr = cells.find((c) => /\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4}/.test(c)) || cells[0];
      const nifCell = cells.find((c) => /^\d{9}$/.test(c.replace(/\s/g, ''))) || '';
      const amountCell = cells.find((c) => /^\d+[.,]\d{2}$/.test(c.replace(/\s/g, '').replace('EUR', '').replace('€', ''))) || '0';

      if (dateStr && /\d/.test(dateStr)) {
        records.push({
          documentNumber: cells[2] || '',
          documentType: cells[1] || 'FR',
          documentDate: normalizeDateDMY(dateStr),
          customerNif: nifCell.replace(/\s/g, ''),
          customerName: cells[4] || '',
          grossTotal: parseFloat(amountCell.replace(/\s/g, '').replace('EUR', '').replace('€', '').replace(',', '.')) || 0,
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

/**
 * Scrape recibos verdes from the AT portal using Playwright.
 *
 * @param {object} params
 * @param {string} params.nif - 9-digit Portuguese NIF
 * @param {string} params.password - AT portal password
 * @param {string} [params.startDate] - Start date YYYY-MM-DD
 * @param {string} [params.endDate] - End date YYYY-MM-DD
 * @param {boolean} [params.debug] - Enable debug logging
 * @returns {Promise<object>} Result with success, records, method
 */
export async function scrapeRecibosVerdesPlaywright({ nif, password, startDate, endDate, debug }) {
  const log = debug ? (...args) => console.log('[playwright-scraper]', ...args) : () => {};

  let browser = null;

  try {
    log('Launching Chromium from', CHROMIUM_PATH);

    browser = await chromium.launch({
      executablePath: CHROMIUM_PATH,
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-setuid-sandbox',
        '--disable-extensions',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
      ],
    });

    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      locale: 'pt-PT',
      timezoneId: 'Europe/Lisbon',
    });

    const page = await context.newPage();
    page.setDefaultTimeout(DEFAULT_TIMEOUT);

    // ── Step 1: Navigate to login form ──────────────────────────────
    const partID = 'PFAP';
    const targetPath = '/consultarDocumentosEmitidos.action';
    const loginFormUrl = `https://www.acesso.gov.pt/v2/loginForm?partID=${partID}&path=${encodeURIComponent(targetPath)}`;

    log('Navigating to login form:', loginFormUrl);
    await page.goto(loginFormUrl, { waitUntil: 'networkidle', timeout: 45_000 });

    // ── Step 2: Select NIF auth method ──────────────────────────────
    // The login page may have multiple auth tabs; select NIF/password
    const nifTab = page.locator('[data-tab="nif"], [href="#nif"], button:has-text("NIF"), a:has-text("NIF")');
    if (await nifTab.count() > 0) {
      log('Clicking NIF auth tab');
      await nifTab.first().click();
      await page.waitForTimeout(500);
    }

    // ── Step 3: Fill credentials ────────────────────────────────────
    log('Filling NIF:', nif.slice(0, 3) + '***');

    // Try multiple possible selectors for the username field
    const usernameSelectors = [
      'input[name="username"]',
      'input[id="username"]',
      'input[name="nif"]',
      '#nif',
      'input[type="text"][placeholder*="NIF"]',
      'input[type="text"]',
    ];

    let usernameField = null;
    for (const sel of usernameSelectors) {
      const locator = page.locator(sel);
      if (await locator.count() > 0) {
        usernameField = locator.first();
        log('Found username field with selector:', sel);
        break;
      }
    }

    if (!usernameField) {
      const html = await page.content();
      throw new Error('Could not find username input field on login page');
    }

    await usernameField.fill(nif);

    // Fill password
    const passwordSelectors = [
      'input[name="password"]',
      'input[id="password"]',
      'input[type="password"]',
    ];

    let passwordField = null;
    for (const sel of passwordSelectors) {
      const locator = page.locator(sel);
      if (await locator.count() > 0) {
        passwordField = locator.first();
        log('Found password field with selector:', sel);
        break;
      }
    }

    if (!passwordField) {
      throw new Error('Could not find password input field on login page');
    }

    await passwordField.fill(password);

    // ── Step 4: Submit login ────────────────────────────────────────
    const submitSelectors = [
      'button[type="submit"]',
      'input[type="submit"]',
      'button:has-text("Autenticar")',
      'button:has-text("Entrar")',
      'button:has-text("Login")',
      '#sbmtLogin',
    ];

    let submitButton = null;
    for (const sel of submitSelectors) {
      const locator = page.locator(sel);
      if (await locator.count() > 0) {
        submitButton = locator.first();
        log('Found submit button with selector:', sel);
        break;
      }
    }

    if (!submitButton) {
      throw new Error('Could not find submit button on login page');
    }

    log('Submitting login form...');
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle', timeout: 45_000 }).catch(() => {}),
      submitButton.click(),
    ]);

    // Wait a bit for any JS redirects to complete
    await page.waitForTimeout(2000);

    // ── Step 5: Check for login errors ──────────────────────────────
    const currentUrl = page.url();
    log('Post-login URL:', currentUrl);

    const pageContent = await page.content();
    const loginFailed =
      pageContent.includes('Credenciais inv\u00e1lidas') ||
      pageContent.includes('dados incorretos') ||
      pageContent.includes('Invalid credentials') ||
      pageContent.includes('Autentica\u00e7\u00e3o falhada');

    if (loginFailed) {
      throw new Error('Login failed - invalid NIF or password');
    }

    // If still on acesso.gov.pt, login may not have redirected
    if (currentUrl.includes('acesso.gov.pt') && !currentUrl.includes('portaldasfinancas')) {
      // Check if we are on an error page or if the login form is still visible
      const stillOnLoginForm = pageContent.includes('loginForm') || pageContent.includes('selectedAuthMethod');
      if (stillOnLoginForm) {
        throw new Error('Login did not redirect - authentication may have failed silently');
      }
    }

    log('Login appears successful');

    // ── Step 6: Navigate to consultation page ───────────────────────
    const consultUrl = 'https://faturas.portaldasfinancas.gov.pt/consultarDocumentosEmitidos.action';

    // Only navigate if not already there
    if (!currentUrl.includes('consultarDocumentosEmitidos')) {
      log('Navigating to consultation page:', consultUrl);
      await page.goto(consultUrl, { waitUntil: 'networkidle', timeout: 45_000 });
    }

    // Verify we are on the right page and not redirected back to login
    const consultContent = await page.content();
    if (consultContent.includes('loginForm') || consultContent.includes('acesso.gov.pt/v2/login')) {
      throw new Error('Session expired or invalid - redirected back to login');
    }

    log('On consultation page');

    // ── Step 7: Try JSON API via page.evaluate ──────────────────────
    let records = [];
    let method = 'playwright-json';

    const jsonApiUrl = `https://faturas.portaldasfinancas.gov.pt/json/obterDocumentosEmitidos.action?dataInicioFilter=${startDate || ''}&dataFimFilter=${endDate || ''}&ambitoPesquisa=emitidos&tipoDocumento=&nifAdquirente=`;

    log('Trying JSON API:', jsonApiUrl);

    try {
      const jsonResult = await page.evaluate(async (url) => {
        const resp = await fetch(url, {
          headers: {
            'Accept': 'application/json, text/javascript, */*; q=0.01',
            'X-Requested-With': 'XMLHttpRequest',
          },
          credentials: 'include',
        });

        if (!resp.ok) {
          return { error: `HTTP ${resp.status}`, status: resp.status };
        }

        const text = await resp.text();
        try {
          return { data: JSON.parse(text), raw: text.slice(0, 200) };
        } catch {
          return { html: text.slice(0, 5000), raw: text.slice(0, 200) };
        }
      }, jsonApiUrl);

      log('JSON API result:', JSON.stringify(jsonResult).slice(0, 300));

      if (jsonResult.data && jsonResult.data.linhas && Array.isArray(jsonResult.data.linhas)) {
        records = mapJsonRecords(jsonResult.data.linhas);
        log('Got', records.length, 'records from JSON API');
      } else if (jsonResult.html) {
        log('JSON API returned HTML, parsing table...');
        records = parseHtmlTable(jsonResult.html);
        method = 'playwright-html';
      } else if (jsonResult.error) {
        log('JSON API error:', jsonResult.error);
        // Fall through to HTML parsing
      }
    } catch (jsonErr) {
      log('JSON API page.evaluate failed:', jsonErr.message);
    }

    // ── Step 8: Fallback - parse current page HTML table ────────────
    if (records.length === 0) {
      log('Trying HTML table fallback from current page...');
      method = 'playwright-html';

      const pageHtml = await page.content();
      records = parseHtmlTable(pageHtml);
      log('Got', records.length, 'records from HTML table');
    }

    // ── Step 9: Try legacy recibos verdes endpoints ─────────────────
    if (records.length === 0) {
      const legacyUrls = [
        `https://faturas.portaldasfinancas.gov.pt/json/obterRecibosVerdes.action?dataInicio=${startDate || ''}&dataFim=${endDate || ''}`,
        'https://irs.portaldasfinancas.gov.pt/recibos/portal/consultar/emitidos',
      ];

      for (const legacyUrl of legacyUrls) {
        log('Trying legacy endpoint:', legacyUrl);
        try {
          const legacyResult = await page.evaluate(async (url) => {
            const resp = await fetch(url, {
              headers: {
                'Accept': 'application/json, text/html, */*',
                'X-Requested-With': 'XMLHttpRequest',
              },
              credentials: 'include',
            });

            if (!resp.ok) return { error: `HTTP ${resp.status}` };
            const text = await resp.text();
            try {
              return { data: JSON.parse(text) };
            } catch {
              return { html: text.slice(0, 5000) };
            }
          }, legacyUrl);

          if (legacyResult.data) {
            const items = legacyResult.data.linhas || legacyResult.data.recibos || legacyResult.data.documentos || [];
            if (Array.isArray(items) && items.length > 0) {
              records = mapJsonRecords(items);
              method = 'playwright-legacy-json';
              log('Got', records.length, 'records from legacy JSON endpoint');
              break;
            }
          } else if (legacyResult.html) {
            const parsed = parseHtmlTable(legacyResult.html);
            if (parsed.length > 0) {
              records = parsed;
              method = 'playwright-legacy-html';
              log('Got', records.length, 'records from legacy HTML endpoint');
              break;
            }
          }
        } catch (err) {
          log('Legacy endpoint failed:', err.message);
        }
      }
    }

    await context.close();

    return {
      success: true,
      totalRecords: records.length,
      records,
      method,
      authenticated: true,
    };
  } catch (err) {
    log('Error:', err.message);
    return {
      success: false,
      error: err.message,
      method: 'playwright',
      authenticated: false,
    };
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}
