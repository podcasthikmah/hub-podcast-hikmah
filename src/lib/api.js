/**
 * Backend adapter.
 *  - LIVE  : Google Apps Script Web App (GET for reads, text/plain POST for writes => no CORS preflight)
 *  - MOCK  : localStorage "database" that enforces the SAME permission rules as Code.gs
 */
import { CONFIG, IS_MOCK } from '../config.js';
import { SHEETS, STATUS, emptyDB } from './schema.js';
import { buildSeed } from './seed.js';
import { storage, store, uid, todayISO } from './utils.js';

const MOCK_KEY = 'hph_mock_db_v1';
const PUBLIC_FIELDS_CADANGAN = ['tarikh', 'catatan'];
const MAX_CATATAN = 1000;

/* ------------------------------- LIVE ---------------------------------- */
const TIMEOUT_MS = 25_000; // Apps Script cold starts can take several seconds

async function request(url, init, fallbackMsg) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  let res;
  try {
    res = await fetch(url, { redirect: 'follow', ...init, signal: ctrl.signal });
  } catch (e) {
    throw new Error(e.name === 'AbortError' ? 'Pelayan lambat bertindak balas. Cuba lagi.' : 'Tiada sambungan ke pelayan');
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) throw new Error(`Ralat pelayan (HTTP ${res.status})`);
  let json;
  try {
    json = await res.json();
  } catch {
    // Usually an HTML login/error page: deployment not set to "Anyone" or URL is wrong.
    throw new Error('Respons tidak sah daripada Apps Script. Semak URL & akses "Anyone".');
  }
  if (!json || !json.ok) throw new Error((json && json.error) || fallbackMsg);
  return json.data;
}

const liveGet = () => request(`${CONFIG.GAS_URL}?action=getAll&t=${Date.now()}`, {}, 'Gagal memuatkan data');

const livePost = (payload) =>
  request(
    CONFIG.GAS_URL,
    {
      method: 'POST',
      // text/plain = CORS "simple request" (no OPTIONS preflight, which Apps Script can't answer)
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
    },
    'Permintaan gagal',
  );

/* ------------------------------- MOCK ---------------------------------- */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function mockDB() {
  let db = storage(MOCK_KEY, null);
  if (!db) {
    db = { ...emptyDB(), ...buildSeed(), _owners: {} };
    store(MOCK_KEY, db);
  }
  return db;
}
const publicView = (db) => Object.fromEntries(Object.keys(SHEETS).map((k) => [k, db[k] || []]));

function clean(sheet, item) {
  const out = {};
  for (const col of SHEETS[sheet]) if (item[col] !== undefined) out[col] = item[col];
  return out;
}

async function mockPost(p) {
  await sleep(250);
  const db = mockDB();
  if (p.pin && p.pin !== CONFIG.MOCK_ADMIN_PIN) throw new Error('PIN salah');
  const isAdmin = Boolean(p.pin);
  if (p.action === 'health') {
    if (!isAdmin) throw new Error('Akses admin diperlukan');
    const tabs = ['UPCOMING', 'PANEL', 'PANDUAN', 'PERINGATAN', 'KITAB', 'YOUTUBE', 'CADANGAN']
      .map((name) => ({ name, exists: true, rows: (db[name] || []).length, missing: [] }));
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return { version: 'mock', pinSet: true, scriptTz: tz, sheetTz: tz, tabs, at: new Date().toISOString() };
  }
  const rows = db[p.sheet];
  if (p.action !== 'verifyPin' && !rows) throw new Error('Sheet tidak sah');
  const find = () => {
    const i = rows.findIndex((r) => r.id === p.id);
    if (i < 0) throw new Error('Rekod tidak dijumpai');
    return i;
  };
  let result;

  switch (p.action) {
    case 'verifyPin':
      if (!isAdmin) throw new Error('PIN salah');
      return { admin: true };

    case 'create': {
      if (!isAdmin && p.sheet !== 'CADANGAN') throw new Error('Akses admin diperlukan');
      let item = clean(p.sheet, p.item || {});
      if (p.sheet === 'CADANGAN') {
        if (!isAdmin) item = { tarikh: item.tarikh, catatan: item.catatan, status: STATUS.BELUM, balasan_admin: '' };
        if (!String(item.catatan || '').trim()) throw new Error('Catatan diperlukan');
        if (String(item.catatan).length > MAX_CATATAN) throw new Error('Catatan terlalu panjang');
        item.created_at = new Date().toISOString();
        item.tarikh = item.tarikh || todayISO();
        item.status = item.status || STATUS.BELUM;
      }
      if (SHEETS[p.sheet].includes('order')) {
        item.order = item.order || Math.max(0, ...rows.map((r) => Number(r.order) || 0)) + 1;
      }
      if (p.sheet === 'KITAB') item.bilangan = Number(item.bilangan) || 0;
      item.id = uid();
      rows.push(item);
      if (p.ownerKey) db._owners[item.id] = p.ownerKey;
      result = item;
      break;
    }

    case 'update': {
      const i = find();
      let patch = clean(p.sheet, p.patch || {});
      delete patch.id;
      if (!isAdmin) {
        if (p.sheet !== 'CADANGAN') throw new Error('Akses admin diperlukan');
        if (!p.ownerKey || db._owners[p.id] !== p.ownerKey) throw new Error('Anda hanya boleh mengedit cadangan sendiri');
        if (rows[i].status === STATUS.SELESAI) throw new Error('Cadangan ini telah selesai dan dikunci');
        patch = Object.fromEntries(Object.entries(patch).filter(([k]) => PUBLIC_FIELDS_CADANGAN.includes(k)));
      }
      rows[i] = { ...rows[i], ...patch };
      result = rows[i];
      break;
    }

    case 'delete': {
      if (!isAdmin) throw new Error('Akses admin diperlukan');
      rows.splice(find(), 1);
      result = { id: p.id };
      break;
    }

    case 'reorder': {
      if (!isAdmin) throw new Error('Akses admin diperlukan');
      p.ids.forEach((id, idx) => {
        const r = rows.find((x) => x.id === id);
        if (r) r.order = idx + 1;
      });
      result = { ids: p.ids };
      break;
    }

    case 'increment': {
      if (!isAdmin) throw new Error('Akses admin diperlukan');
      const i = find();
      rows[i].bilangan = Math.max(0, (Number(rows[i].bilangan) || 0) + Number(p.delta || 0));
      result = rows[i];
      break;
    }

    default:
      throw new Error('Tindakan tidak dikenali');
  }
  store(MOCK_KEY, db);
  return result;
}

/* ------------------------------ EXPORTS -------------------------------- */
export const api = {
  mode: IS_MOCK ? 'mock' : 'live',
  getAll: IS_MOCK ? async () => { await sleep(300); return publicView(mockDB()); } : liveGet,
  post: IS_MOCK ? mockPost : livePost,
  resetMock: () => { try { localStorage.removeItem(MOCK_KEY); } catch { /* noop */ } },
};
