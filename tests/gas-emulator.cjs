/**
 * Local Google Apps Script emulator for google-apps-script/Code.gs.
 * Runs the REAL Code.gs inside a Node vm with in-memory fakes of the Apps Script
 * services it uses, and serves it like a deployed Web App at /exec.
 *
 *   node tests/gas-emulator.cjs [port]      (default 8787, ADMIN_PIN=246810)
 *
 * Fidelity notes (matching real Apps Script behaviour that matters to the client):
 *  - GET/POST responses carry Access-Control-Allow-Origin: *
 *  - OPTIONS (CORS preflight) is NOT supported -> 405, exactly like Apps Script,
 *    so a client that accidentally triggers a preflight fails here too.
 *  - Leading apostrophe in a written string is consumed (Sheets "force text" marker).
 */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');

function createRuntime() {
  // ---------------- Spreadsheet fakes ----------------
  const sheets = new Map(); // name -> Sheet
  const order = [];

  // Like Sheets: "'x" is forced text; a bare "21:00" is auto-parsed into a time-only (1899-12-30) date.
  const store = (v) => {
    if (typeof v !== 'string') return v;
    if (v.startsWith("'")) return v.slice(1);
    const t = v.match(/^(\d{1,2}):(\d{2})$/);
    return t ? new Date(1899, 11, 30, Number(t[1]), Number(t[2])) : v;
  };

  class Range {
    constructor(sh, row, col, nr = 1, nc = 1) { Object.assign(this, { sh, row, col, nr, nc }); }
    setValues(vals) { vals.forEach((r, i) => r.forEach((v, j) => this.sh._set(this.row + i, this.col + j, v))); return this; }
    setValue(v) { this.sh._set(this.row, this.col, v); return this; }
    setFontWeight() { return this; }
    setBackground() { return this; }
    setFontColor() { return this; }
    setNumberFormat() { return this; }
    getValues() { return this.sh._grid(this.row, this.col, this.nr, this.nc); }
  }

  class Sheet {
    constructor(name) { this.name = name; this.data = []; }
    _set(r, c, v) {
      while (this.data.length < r) this.data.push([]);
      const row = this.data[r - 1];
      while (row.length < c) row.push('');
      row[c - 1] = store(v);
    }
    _width() { return this.data.reduce((m, r) => Math.max(m, r.length), 0); }
    _grid(r, c, nr, nc) {
      const out = [];
      for (let i = 0; i < nr; i++) {
        const row = this.data[r - 1 + i] || [];
        const line = [];
        for (let j = 0; j < nc; j++) line.push(row[c - 1 + j] ?? '');
        out.push(line);
      }
      return out;
    }
    getName() { return this.name; }
    getDataRange() { return new Range(this, 1, 1, Math.max(this.data.length, 1), Math.max(this._width(), 1)); }
    getRange(r, c, nr, nc) { return new Range(this, r, c, nr, nc); }
    appendRow(vals) { this.data.push(vals.map(store)); return this; }
    deleteRow(r) { this.data.splice(r - 1, 1); }
    getLastRow() { return this.data.length; }
    getLastColumn() { return this._width(); }
    getParent() { return ss; }
    getMaxRows() { return 1000; }
    setFrozenRows() {}
    hideColumns() {}
  }

  const ss = {
    getSheetByName: (n) => sheets.get(n) || null,
    insertSheet: (n) => { const s = new Sheet(n); sheets.set(n, s); order.push(n); return s; },
    getSheets: () => order.map((n) => sheets.get(n)),
    getSpreadsheetTimeZone: () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    deleteSheet: (s) => { sheets.delete(s.name); order.splice(order.indexOf(s.name), 1); },
  };
  ss.insertSheet('Sheet1');

  // ---------------- Service fakes ----------------
  const props = new Map();
  const cache = new Map();
  const pad = (n) => String(n).padStart(2, '0');
  const formatDate = (d, _tz, fmt) =>
    fmt
      .replace('yyyy', d.getFullYear())
      .replace('MM', pad(d.getMonth() + 1))
      .replace('dd', pad(d.getDate()))
      .replace("'T'", 'T')
      .replace('HH', pad(d.getHours()))
      .replace('mm', pad(d.getMinutes()))
      .replace('ss', pad(d.getSeconds()));

  const sandbox = {
    console,
    SpreadsheetApp: { getActiveSpreadsheet: () => ss, flush: () => {} },
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput: (content) => ({ content, setMimeType() { return this; } }),
    },
    LockService: { getScriptLock: () => ({ waitLock() {}, tryLock() { return true; }, releaseLock() {} }) },
    CacheService: {
      getScriptCache: () => ({ get: (k) => (cache.has(k) ? cache.get(k) : null), put: (k, v) => cache.set(k, String(v)) }),
    },
    PropertiesService: {
      getScriptProperties: () => ({ getProperty: (k) => (props.has(k) ? props.get(k) : null), setProperty: (k, v) => props.set(k, v) }),
    },
    Utilities: {
      getUuid: () => crypto.randomUUID(),
      formatDate,
      DigestAlgorithm: { SHA_256: 'sha256' },
      computeDigest: (alg, s) => [...crypto.createHash(alg).update(String(s), 'utf8').digest()].map((b) => (b > 127 ? b - 256 : b)),
    },
    Session: { getScriptTimeZone: () => Intl.DateTimeFormat().resolvedOptions().timeZone },
    Logger: { log: () => {} },
    // Fake translator: deterministic, visibly Arabic, and able to fail on demand.
    LanguageApp: {
      calls: 0,
      translate(text, from, to) {
        this.calls++;
        if (from !== 'ms' || to !== 'ar') throw new Error(`unexpected ${from}->${to}`);
        if (String(text).includes('GAGAL_TERJEMAH')) throw new Error('quota exceeded');
        return `ترجمة: ${text}`;
      },
    },
  };
  vm.createContext(sandbox);
  const code = fs.readFileSync(path.join(__dirname, '..', 'google-apps-script', 'Code.gs'), 'utf8');
  vm.runInContext(code, sandbox, { filename: 'Code.gs' });

  return { gs: sandbox, ss, sheets, props, cache };
}

function startServer(port = 8787, { pin = '246810', seed = true } = {}) {
  const rt = createRuntime();
  rt.gs.setupSheets();
  if (pin) rt.props.set('ADMIN_PIN', pin);
  if (seed) rt.gs.seedSampleData();

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://localhost:${port}`);
    const send = (status, body) => {
      res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(body);
    };
    if (url.pathname !== '/exec') return send(404, '{"error":"not found"}');
    if (req.method === 'OPTIONS') { res.writeHead(405); return res.end(); } // like Apps Script
    if (req.method === 'GET') {
      return send(200, rt.gs.doGet({ parameter: Object.fromEntries(url.searchParams) }).content);
    }
    if (req.method === 'POST') {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        const out = rt.gs.doPost({ postData: { contents: body, type: req.headers['content-type'] } });
        send(200, out.content);
      });
      return;
    }
    res.writeHead(405); res.end();
  });
  return new Promise((resolve) => server.listen(port, () => resolve({ server, rt })));
}

module.exports = { createRuntime, startServer };

if (require.main === module) {
  const port = Number(process.argv[2]) || 8787;
  startServer(port).then(() => console.log(`GAS emulator on http://localhost:${port}/exec (ADMIN_PIN=246810)`));
}
