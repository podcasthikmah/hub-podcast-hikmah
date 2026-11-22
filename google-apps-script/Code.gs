/**
 * HUB PODCAST HIKMAH — Google Apps Script backend (Web App API)
 * =============================================================
 * Deploy:  Deploy > New deployment > Web app
 *          Execute as: Me   |   Who has access: Anyone
 *
 * Admin PIN: Project Settings > Script Properties > add  ADMIN_PIN = <your pin>
 *            (or run setAdminPin() once after editing it below).
 *
 * Reads : GET  <WEB_APP_URL>?action=getAll
 * Writes: POST <WEB_APP_URL>  body = JSON string, Content-Type: text/plain
 *         (text/plain is a "simple" CORS request => no preflight, works from GitHub Pages)
 *
 * Every response: { ok: true, data: ... }  or  { ok: false, error: "message" }
 */

// ---- Schema (MUST match src/lib/schema.js) ---------------------------------
var HEADERS = {
  UPCOMING:   ['id', 'order', 'hari', 'tarikh', 'masa', 'tajuk', 'panel'],
  PANEL:      ['id', 'tajuk', 'nama_panel', 'tarikh', 'masa'],
  PANDUAN:    ['id', 'order', 'kategori', 'tajuk', 'keterangan', 'gdrive_url'],
  PERINGATAN: ['id', 'order', 'petikan', 'arab', 'konteks'],
  KITAB:      ['id', 'nama_kitab', 'bilangan'],
  YOUTUBE:    ['id', 'order', 'tajuk', 'youtube_url', 'custom_thumbnail', 'tarikh'],
  CADANGAN:   ['id', 'tarikh', 'catatan', 'status', 'balasan_admin', 'created_at', 'owner_hash']
};
var HIDDEN_COLS = { owner_hash: true };       // never sent to the browser
var NUMERIC_COLS = { order: true, bilangan: true };
var PUBLIC_EDIT_FIELDS = ['tarikh', 'catatan']; // what a public owner may change in CADANGAN

var LIMITS = {
  MAX_TEXT: 2000,               // any single cell
  MAX_CATATAN: 1000,            // public suggestion length
  PUBLIC_POSTS_PER_10MIN: 30,   // global anti-spam ceiling for new CADANGAN
  PIN_FAILS_PER_10MIN: 10       // brute-force guard
};

// ---- Entry points ----------------------------------------------------------
function doGet(e) {
  try {
    var action = (e && e.parameter && e.parameter.action) || 'getAll';
    if (action === 'getAll') return json_({ ok: true, data: getAll_() });
    if (action === 'ping') return json_({ ok: true, data: 'pong' });
    return json_({ ok: false, error: 'Tindakan GET tidak dikenali' });
  } catch (err) {
    return json_({ ok: false, error: String(err.message || err) });
  }
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    lock.waitLock(20000);
    LOCK_HELD_ = true;
    var data = handle_(body);
    SpreadsheetApp.flush();
    return json_({ ok: true, data: data });
  } catch (err) {
    return json_({ ok: false, error: String(err.message || err) });
  } finally {
    LOCK_HELD_ = false;
    try { lock.releaseLock(); } catch (x) {}
  }
}

// ---- Router ----------------------------------------------------------------
function handle_(p) {
  var action = p.action;
  if (action === 'verifyPin') {
    requireAdmin_(p.pin);
    return { admin: true };
  }

  var sheet = String(p.sheet || '');
  if (!HEADERS[sheet]) throw new Error('Sheet tidak sah');
  // Any request carrying a PIN must pass the (rate-limited) check; no PIN = public.
  var isAdmin = false;
  if (p.pin) { requireAdmin_(p.pin); isAdmin = true; }

  switch (action) {
    case 'create':
      if (!isAdmin && sheet !== 'CADANGAN') throw new Error('Akses admin diperlukan');
      return createRow_(sheet, p.item || {}, isAdmin, p.ownerKey);

    case 'update':
      return updateRow_(sheet, String(p.id), p.patch || {}, isAdmin, p.ownerKey);

    case 'delete':
      if (!isAdmin) throw new Error('Akses admin diperlukan');
      return deleteRow_(sheet, String(p.id));

    case 'reorder':
      if (!isAdmin) throw new Error('Akses admin diperlukan');
      return reorder_(sheet, p.ids || []);

    case 'increment':
      if (!isAdmin) throw new Error('Akses admin diperlukan');
      if (sheet !== 'KITAB') throw new Error('Increment hanya untuk KITAB');
      return increment_(String(p.id), Number(p.delta) || 0);

    default:
      throw new Error('Tindakan tidak dikenali');
  }
}

// ---- Reads -----------------------------------------------------------------
function getAll_() {
  var out = {};
  Object.keys(HEADERS).forEach(function (name) {
    out[name] = readSheet_(name).rows.map(function (r) { return publicRow_(r); });
  });
  return out;
}

function readSheet_(name) {
  var sh = getSheet_(name);
  var values = sh.getDataRange().getValues();
  if (values.length < 1) return { sh: sh, header: HEADERS[name], rows: [] };
  var header = values[0].map(function (h) { return String(h).trim(); });
  if (missingHeaders_(name, header).length) {
    header = ensureHeaders_(sh, name);
    values = sh.getDataRange().getValues();
  }
  var tz = Session.getScriptTimeZone();
  var rows = [];
  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    if (row.join('') === '') continue;
    var obj = { _row: i + 1 };
    header.forEach(function (h, c) {
      if (!h) return;
      var v = row[c];
      if (v instanceof Date) {
        // A time typed into a non-text cell (e.g. "21:00") comes back as a 1899-12-30 date: keep the time.
        if (v.getFullYear() < 1900 || h === 'masa') v = Utilities.formatDate(v, tz, 'HH:mm');
        else v = Utilities.formatDate(v, tz, h === 'created_at' ? "yyyy-MM-dd'T'HH:mm:ss" : 'yyyy-MM-dd');
      }
      if (NUMERIC_COLS[h]) v = Number(v) || 0;
      else v = v === null || v === undefined ? '' : String(v);
      obj[h] = v;
    });
    if (!obj.id) continue;
    rows.push(obj);
  }
  return { sh: sh, header: header, rows: rows };
}

function publicRow_(r) {
  var o = {};
  Object.keys(r).forEach(function (k) {
    if (k === '_row' || HIDDEN_COLS[k]) return;
    o[k] = r[k];
  });
  return o;
}

var LOCK_HELD_ = false; // true while doPost holds the script lock

function missingHeaders_(name, header) {
  return HEADERS[name].filter(function (h) { return header.indexOf(h) < 0; });
}

/**
 * Self-healing schema: appends any column from HEADERS that the tab is missing
 * (e.g. PANEL.tarikh on a tab created by hand). Writes map values by the tab's own
 * header row, so without this a missing column would silently drop that field.
 * New columns are formatted as plain text so Sheets doesn't auto-convert dates.
 * Runs under the script lock so two first requests can't both append the column.
 */
function ensureHeaders_(sh, name) {
  var lock = null;
  if (!LOCK_HELD_) {
    lock = LockService.getScriptLock();
    if (!lock.tryLock(10000)) lock = null;
  }
  try {
    var width = Math.max(sh.getDataRange().getValues()[0].length, 1);
    var header = sh.getRange(1, 1, 1, width).getValues()[0].map(function (h) { return String(h).trim(); });
    var last = 0;
    header.forEach(function (h, i) { if (h) last = i + 1; });
    header = header.slice(0, last);
    var missing = missingHeaders_(name, header);
    if (missing.length && (lock || LOCK_HELD_)) {
      sh.getRange(1, last + 1, 1, missing.length).setValues([missing]).setFontWeight('bold');
      missing.forEach(function (col, i) {
        sh.getRange(2, last + 1 + i, Math.max(sh.getMaxRows() - 1, 1), 1).setNumberFormat(NUMERIC_COLS[col] ? '0' : '@');
      });
      header = header.concat(missing);
    }
    return header;
  } finally {
    if (lock) lock.releaseLock();
  }
}

// ---- Writes ----------------------------------------------------------------
function createRow_(name, item, isAdmin, ownerKey) {
  var data = readSheet_(name);
  var obj = {};

  if (name === 'CADANGAN') {
    var catatan = String(item.catatan || '').trim();
    if (!catatan) throw new Error('Catatan diperlukan');
    if (catatan.length > LIMITS.MAX_CATATAN) throw new Error('Catatan terlalu panjang');
    if (!isAdmin) rateLimit_('cad', LIMITS.PUBLIC_POSTS_PER_10MIN, 'Terlalu banyak cadangan dihantar. Cuba sebentar lagi.');
    obj.tarikh = isoDate_(item.tarikh) || today_();
    obj.catatan = catatan;
    obj.status = isAdmin && item.status === 'SELESAI' ? 'SELESAI' : 'BELUM';
    obj.balasan_admin = isAdmin ? String(item.balasan_admin || '') : '';
    obj.created_at = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss");
    obj.owner_hash = ownerKey ? hash_(ownerKey) : '';
  } else {
    HEADERS[name].forEach(function (h) { if (item[h] !== undefined) obj[h] = item[h]; });
  }

  if (HEADERS[name].indexOf('order') >= 0 && !Number(obj.order)) {
    obj.order = data.rows.reduce(function (m, r) { return Math.max(m, Number(r.order) || 0); }, 0) + 1;
  }
  if (name === 'KITAB') obj.bilangan = Math.max(0, Number(obj.bilangan) || 0);
  obj.id = Utilities.getUuid().slice(0, 12);

  var rowValues = data.header.map(function (h) { return cell_(h, obj[h]); });
  data.sh.appendRow(rowValues);
  return publicRow_(obj);
}

function updateRow_(name, id, patch, isAdmin, ownerKey) {
  var data = readSheet_(name);
  var row = findRow_(data, id);

  if (!isAdmin) {
    if (name !== 'CADANGAN') throw new Error('Akses admin diperlukan');
    if (!ownerKey || !row.owner_hash || hash_(ownerKey) !== row.owner_hash) {
      throw new Error('Anda hanya boleh mengedit cadangan sendiri');
    }
    if (row.status === 'SELESAI') throw new Error('Cadangan ini telah selesai dan dikunci');
    var allowed = {};
    PUBLIC_EDIT_FIELDS.forEach(function (k) { if (patch[k] !== undefined) allowed[k] = patch[k]; });
    patch = allowed;
    if (patch.catatan !== undefined) {
      patch.catatan = String(patch.catatan).trim();
      if (!patch.catatan) throw new Error('Catatan diperlukan');
      if (patch.catatan.length > LIMITS.MAX_CATATAN) throw new Error('Catatan terlalu panjang');
    }
  }
  delete patch.id;
  delete patch.owner_hash;
  delete patch.created_at;
  if (name === 'CADANGAN' && patch.status !== undefined) patch.status = patch.status === 'SELESAI' ? 'SELESAI' : 'BELUM';
  if (patch.tarikh !== undefined && patch.tarikh !== '') patch.tarikh = isoDate_(patch.tarikh) || patch.tarikh;

  data.header.forEach(function (h, c) {
    if (patch[h] === undefined || HEADERS[name].indexOf(h) < 0) return;
    data.sh.getRange(row._row, c + 1).setValue(cell_(h, patch[h]));
    row[h] = NUMERIC_COLS[h] ? Number(patch[h]) || 0 : String(patch[h]);
  });
  return publicRow_(row);
}

function deleteRow_(name, id) {
  var data = readSheet_(name);
  var row = findRow_(data, id);
  data.sh.deleteRow(row._row);
  return { id: id };
}

function reorder_(name, ids) {
  var data = readSheet_(name);
  var col = data.header.indexOf('order');
  if (col < 0) throw new Error('Sheet ini tiada lajur order');
  ids.forEach(function (id, i) {
    var r = data.rows.filter(function (x) { return x.id === String(id); })[0];
    if (r) data.sh.getRange(r._row, col + 1).setValue(i + 1);
  });
  return { ids: ids };
}

function increment_(id, delta) {
  var data = readSheet_('KITAB');
  var row = findRow_(data, id);
  var col = data.header.indexOf('bilangan');
  var next = Math.max(0, (Number(row.bilangan) || 0) + delta);
  data.sh.getRange(row._row, col + 1).setValue(next);
  row.bilangan = next;
  return publicRow_(row);
}

// ---- Auth & guards ---------------------------------------------------------
function getPin_() {
  return String(PropertiesService.getScriptProperties().getProperty('ADMIN_PIN') || '');
}

function checkPin_(pin) {
  var real = getPin_();
  if (!real || !pin) return false;
  return String(pin) === real;
}

function requireAdmin_(pin) {
  if (!getPin_()) throw new Error('ADMIN_PIN belum ditetapkan dalam Script Properties');
  var cache = CacheService.getScriptCache();
  var fails = Number(cache.get('pinfails') || 0);
  if (fails >= LIMITS.PIN_FAILS_PER_10MIN) throw new Error('Terlalu banyak cubaan. Cuba lagi dalam 10 minit.');
  if (!checkPin_(pin)) {
    cache.put('pinfails', String(fails + 1), 600);
    throw new Error('PIN salah');
  }
}

function rateLimit_(key, max, msg) {
  var cache = CacheService.getScriptCache();
  var n = Number(cache.get('rl_' + key) || 0);
  if (n >= max) throw new Error(msg);
  cache.put('rl_' + key, String(n + 1), 600);
}

// ---- Helpers ---------------------------------------------------------------
function getSheet_(name) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sh) throw new Error('Tab "' + name + '" tidak dijumpai. Jalankan setupSheets() dahulu.');
  return sh;
}

function findRow_(data, id) {
  var r = data.rows.filter(function (x) { return x.id === id; })[0];
  if (!r) throw new Error('Rekod tidak dijumpai');
  return r;
}

/** Sanitise a value before writing: cap length & neutralise spreadsheet formula injection. */
function cell_(header, v) {
  if (v === undefined || v === null) return '';
  if (NUMERIC_COLS[header]) return Number(v) || 0;
  var s = String(v).slice(0, LIMITS.MAX_TEXT);
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return s;
}

function isoDate_(v) {
  var m = String(v || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? m[1] + '-' + m[2] + '-' + m[3] : '';
}

function today_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function hash_(s) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(s));
  return bytes.map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('');
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// ---- One-time setup (run from the editor) ----------------------------------
/** Creates the 7 tabs with exact headers. Safe to re-run (won't delete data). */
function setupSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(HEADERS).forEach(function (name) {
    var sh = ss.getSheetByName(name) || ss.insertSheet(name);
    var h = HEADERS[name];
    sh.getRange(1, 1, 1, h.length).setValues([h]).setFontWeight('bold').setBackground('#0F4C3A').setFontColor('#FAF9F6');
    sh.setFrozenRows(1);
    // Store everything as plain text so Sheets doesn't auto-convert dates/IDs.
    h.forEach(function (col, i) {
      var range = sh.getRange(2, i + 1, Math.max(sh.getMaxRows() - 1, 1), 1);
      range.setNumberFormat(NUMERIC_COLS[col] ? '0' : '@');
    });
    if (h.indexOf('owner_hash') >= 0) sh.hideColumns(h.indexOf('owner_hash') + 1);
  });
  var def = ss.getSheetByName('Sheet1') || ss.getSheetByName('Helaian1');
  if (def && def.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(def);
  Logger.log('Tab berjaya disediakan.');
}

/** Optional: edit the PIN below, run once, then clear it from the code. */
function setAdminPin() {
  var PIN = 'TUKAR_PIN_INI';
  if (PIN === 'TUKAR_PIN_INI') throw new Error('Edit nilai PIN dalam setAdminPin() dahulu.');
  PropertiesService.getScriptProperties().setProperty('ADMIN_PIN', PIN);
  Logger.log('ADMIN_PIN disimpan.');
}

/** Optional: seed a few starter rows so the app isn't empty on first live load. */
function seedSampleData() {
  var t = today_();
  var add = function (name, obj) {
    var sh = getSheet_(name);
    obj.id = Utilities.getUuid().slice(0, 12);
    sh.appendRow(HEADERS[name].map(function (h) { return cell_(h, obj[h]); }));
  };
  add('UPCOMING', { order: 1, hari: '', tarikh: t, masa: '9:00 malam', tajuk: 'Mengurus Hati di Era Media Sosial', panel: 'Ustaz Hafiz Rahman & Dr. Nurul Huda' });
  add('PANEL', { tajuk: 'Mengurus Hati di Era Media Sosial', nama_panel: 'Ustaz Hafiz Rahman', tarikh: t, masa: '21:00' });
  add('PANDUAN', { order: 1, kategori: 'PANEL', tajuk: 'Panduan Lengkap Panel Jemputan', keterangan: 'Aliran rakaman & persediaan.', gdrive_url: 'https://drive.google.com/file/d/GANTI_ID/view' });
  add('PANDUAN', { order: 2, kategori: 'SKRIP_PROMOSI', tajuk: 'Contoh Skrip Promosi Kitab', keterangan: 'Skrip 60–90 saat.', gdrive_url: 'https://drive.google.com/file/d/GANTI_ID/view' });
  add('PERINGATAN', { order: 1, petikan: 'Niatkan setiap perkongsian kerana Allah.', arab: 'إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ', konteks: 'Taklimat Panel' });
  add('KITAB', { nama_kitab: 'Riyadhus Solihin', bilangan: 0 });
  add('YOUTUBE', { order: 1, tajuk: 'EP01 · Pengenalan', youtube_url: 'https://youtu.be/GANTI_ID_VID', custom_thumbnail: '', tarikh: t });
  Logger.log('Data contoh ditambah.');
}
