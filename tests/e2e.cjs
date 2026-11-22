/**
 * End-to-end test: real built app (LIVE mode) <-> real Code.gs (emulated) via Playwright.
 *   npm run test:e2e
 * Builds the app as-is (with the real GAS_URL from src/config.js) and routes every
 * script.google.com request to the local emulator, so the real Sheet is NEVER touched.
 * Then drives every section
 * as a public user and as admin, asserting UI + spreadsheet state + zero console errors.
 */
const { createRequire } = require('node:module');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { startServer } = require('./gas-emulator.cjs');

const req = createRequire(__filename);
let playwright;
try { playwright = req('playwright'); } catch { playwright = require(path.join(require('node:child_process').execSync('npm root -g').toString().trim(), 'playwright')); }
const { chromium, devices } = playwright;

const ROOT = path.join(__dirname, '..');
const GAS_PORT = 8787;
const APP_PORT = 4180;
const PIN = '246810';
const APP = `http://localhost:${APP_PORT}/`;
const DIST = path.join(ROOT, process.argv[2] || '.e2e-dist');

// ---------------- tiny static server for the built app ----------------
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };
function serveDist() {
  return new Promise((resolve) => {
    const s = http.createServer((rq, rs) => {
      let p = decodeURIComponent(new URL(rq.url, APP).pathname);
      if (p.endsWith('/')) p += 'index.html';
      const f = path.join(DIST, p);
      if (!f.startsWith(DIST) || !fs.existsSync(f)) { rs.writeHead(404); return rs.end(); }
      rs.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
      fs.createReadStream(f).pipe(rs);
    });
    s.listen(APP_PORT, () => resolve(s));
  });
}

// ---------------- helpers ----------------
let passed = 0;
const step = async (name, fn) => { await fn(); passed++; console.log('  ✓', name); };
const errors = [];
let expectNetErrors = false;
let rt; // emulator runtime (set in main), used by the sync-flow helpers // set during deliberate offline tests

function watch(page, label) {
  page.on('pageerror', (e) => errors.push(`[${label}] pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    if (expectNetErrors) return;
    errors.push(`[${label}] console: ${m.text()}`);
  });
}

const THUMB = fs.readFileSync(path.join(ROOT, 'public/icons/icon-512.png'));
/** Redirect the app's Apps Script calls to the emulator (method, query & body preserved). */
async function useEmulator(ctx) {
  await ctx.route(/^https:\/\/script\.google(usercontent)?\.com\//, async (route) => {
    const u = new URL(route.request().url());
    const target = `http://localhost:${GAS_PORT}/exec${u.search}`;
    try {
      const res = await route.fetch({ url: target });
      await route.fulfill({ response: res });
    } catch {
      await route.abort();
    }
  });
  // Belt and braces: any other Google host must never be reached from tests.
  await ctx.route(/^https:\/\/(www\.)?googleapis\.com\/(?!css)/, (r) => r.abort());
}

async function stubThumbs(ctx) {
  await useEmulator(ctx);
  // The sandbox network blocks i.ytimg.com; serve a real 512px PNG so the real-thumbnail path is exercised.
  await ctx.route('**/i.ytimg.com/**', (r) => r.fulfill({ status: 200, contentType: 'image/png', body: THUMB }));
}

const sheet = (rt, name) => {
  const [h, ...rows] = rt.sheets.get(name).data;
  return rows.filter((r) => r[0]).map((r) => Object.fromEntries(h.map((k, i) => [k, r[i]])));
};
const synced = (page) => page.waitForFunction(() => !document.querySelector('.animate-spin'), null, { timeout: 15000 });
const toast = (page, re) => page.getByRole('status').filter({ hasText: re }).first().waitFor({ timeout: 8000 });

async function adminLogin(page, pin = PIN) {
  // One-tap lock button (deterministic). The 5-tap © gesture has its own dedicated test.
  await page.click('[data-testid="admin-lock"]');
  await page.fill('div[role="dialog"] input[type="password"]', pin);
  await page.click('div[role="dialog"] form button');
}
const go = async (page, tab) => {
  await page.evaluate((t) => { location.hash = t; }, tab);
  await page.waitForSelector(`#h-${tab}`);
};

async function noHorizontalScroll(page, label) {
  const { sw, iw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
  assert.ok(sw <= iw, `${label}: horizontal overflow ${sw} > ${iw}`);
}

// ---------------- LIST PANEL -> UPCOMING sync flow (desktop + mobile) ----------------
const HARI = ['Ahad', 'Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Sabtu'];
const iso = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const hariOfISO = (s) => { const [y, m, d] = s.split('-').map(Number); return HARI[new Date(y, m - 1, d).getDay()]; };
const isDatedStr = (t) => /^\d{4}-\d{2}-\d{2}/.test(String(t || ''));

async function addPanel(page, { tajuk, nama, tarikh, tbd = false }) {
  await go(page, 'panel');
  await page.getByRole('button', { name: /Tambah Panel/ }).click();
  await page.fill('#f-tajuk', tajuk);
  await page.fill('#f-nama_panel', nama);
  if (tbd) {
    await page.check('#f-tbd');
    assert.equal(await page.locator('#f-tarikh').isDisabled(), true, 'date disabled when Belum Ditentukan');
  } else {
    await page.fill('#f-tarikh', tarikh);
    // derived Bahasa Melayu day shown live in the form
    assert.match(await page.getByTestId('hari-preview').innerText(), new RegExp(`^${hariOfISO(tarikh)}, `));
  }
  await page.getByRole('dialog').getByRole('button', { name: 'Simpan' }).click();
  await toast(page, /Panel disimpan/);
  await synced(page);
  await page.waitForSelector('div[role="dialog"]', { state: 'detached' });
}

async function upcomingSlots(page) {
  await go(page, 'upcoming');
  return page.locator('[data-slot]').evaluateAll((els) => els.map((e) => ({
    id: e.getAttribute('data-slot'),
    text: e.innerText,
    panel: e.querySelector('[data-testid="slot-panel"]')?.innerText || '',
  })));
}

async function scheduleSyncFlow(page, tag, { checkHero = false } = {}) {
  const d5 = iso(5);
  const T = `Sync ${tag} Jadual`;
  // 1. dated panel + 2nd panelist on same tajuk/date (should merge into ONE slot)
  await addPanel(page, { tajuk: T, nama: `Ustaz ${tag} A`, tarikh: d5 });
  await addPanel(page, { tajuk: T, nama: `Dr. ${tag} B`, tarikh: d5 });
  const rowsA = sheet(rt, 'PANEL').filter((r) => r.tajuk === T);
  assert.equal(rowsA.length, 2);
  assert.ok(rowsA.every((r) => r.tarikh === d5), 'tarikh stored as ISO in the Sheet');
  // 2. Belum Ditentukan
  await addPanel(page, { tajuk: `TBD ${tag} Tajuk`, nama: `Ustaz ${tag} C`, tbd: true });
  assert.equal(sheet(rt, 'PANEL').find((r) => r.nama_panel === `Ustaz ${tag} C`).tarikh, 'Belum Ditentukan');
  await page.locator('li', { hasText: `Ustaz ${tag} C` }).getByText('Belum Ditentukan').waitFor();
  const dated = page.locator('li', { hasText: `Ustaz ${tag} A` });
  assert.match(await dated.innerText(), new RegExp(hariOfISO(d5)));
  // 3. validation: neither date nor Belum Ditentukan -> modal stays open, nothing saved
  await page.getByRole('button', { name: /Tambah Panel/ }).click();
  await page.fill('#f-tajuk', `Invalid ${tag}`);
  await page.fill('#f-nama_panel', 'Tiada Tarikh');
  await page.getByRole('dialog').getByRole('button', { name: 'Simpan' }).click();
  await page.waitForTimeout(300);
  assert.equal(await page.getByRole('dialog').count(), 1, 'form blocked without a date');
  await page.keyboard.press('Escape');
  assert.ok(!sheet(rt, 'PANEL').some((r) => r.tajuk === `Invalid ${tag}`));

  // 4. Upcoming: merged slot, hari shown, TBD excluded, nearest first, read-only
  let slots = await upcomingSlots(page);
  const mine = slots.filter((x) => x.text.includes(T));
  assert.equal(mine.length, 1, 'two panelists -> one slot');
  assert.equal(mine[0].panel, `Ustaz ${tag} A & Dr. ${tag} B`);
  assert.ok(mine[0].text.includes(hariOfISO(d5)), 'hari on the card');
  assert.ok(!slots.some((x) => x.text.includes(`TBD ${tag}`)), 'Belum Ditentukan not in Upcoming');
  const dates = slots.map((x) => x.id.slice(0, 10));
  assert.deepEqual(dates, [...dates].sort(), 'sorted by nearest date');
  assert.ok(dates.every((x) => x >= iso(0)), 'no past dates in Upcoming');
  for (const name of [/Tambah Slot/, /^Edit$/, /^Padam$/, /^Naik$/, /^Turun$/]) {
    assert.equal(await page.locator('#h-upcoming >> xpath=ancestor::section').getByRole('button', { name }).count(), 0);
  }
  assert.equal(await page.getByRole('button', { name: 'Salin Info WA' }).count(), slots.length);

  // 5. Hero = nearest dated panel; changes when that entry becomes Belum Ditentukan
  if (checkHero) {
    const nearest = () => {
      const rows = sheet(rt, 'PANEL').filter((r) => isDatedStr(r.tarikh) && r.tarikh >= iso(0));
      rows.sort((a, b) => a.tarikh.localeCompare(b.tarikh) || a.tajuk.localeCompare(b.tajuk));
      return rows[0];
    };
    const h1 = () => page.getByRole('heading', { level: 1 }).innerText();
    const first = nearest();
    assert.equal((await h1()).trim(), first.tajuk);
    const sameSlot = sheet(rt, 'PANEL').filter((r) => r.tajuk === first.tajuk && r.tarikh === first.tarikh);
    for (const r of sameSlot) {
      await go(page, 'panel');
      await page.locator(`li[data-panel-id="${r.id}"]`).getByRole('button', { name: 'Edit' }).click();
      await page.check('#f-tbd');
      await page.getByRole('dialog').getByRole('button', { name: 'Simpan' }).click();
      await toast(page, /Panel disimpan/);
      await synced(page);
      await page.waitForSelector('div[role="dialog"]', { state: 'detached' });
    }
    const second = nearest();
    await go(page, 'upcoming');
    await page.waitForFunction((t) => document.querySelector('h1')?.innerText.trim() === t, second.tajuk);
    // restore so later steps see the original data
    for (const r of sameSlot) {
      await go(page, 'panel');
      await page.locator(`li[data-panel-id="${r.id}"]`).getByRole('button', { name: 'Edit' }).click();
      await page.uncheck('#f-tbd');
      await page.fill('#f-tarikh', first.tarikh);
      await page.getByRole('dialog').getByRole('button', { name: 'Simpan' }).click();
      await toast(page, /Panel disimpan/);
      await synced(page);
      await page.waitForSelector('div[role="dialog"]', { state: 'detached' });
    }
    await go(page, 'upcoming');
    await page.waitForFunction((t) => document.querySelector('h1')?.innerText.trim() === t, first.tajuk);
  }

  // 6. editing one panelist to Belum Ditentukan updates the merged slot
  await go(page, 'panel');
  const idA = sheet(rt, 'PANEL').find((r) => r.nama_panel === `Ustaz ${tag} A`).id;
  await page.locator(`li[data-panel-id="${idA}"]`).getByRole('button', { name: 'Edit' }).click();
  assert.equal(await page.inputValue('#f-tarikh'), d5, 'edit form pre-fills the date');
  await page.check('#f-tbd');
  await page.getByRole('dialog').getByRole('button', { name: 'Simpan' }).click();
  await toast(page, /Panel disimpan/);
  await synced(page);
  slots = await upcomingSlots(page);
  assert.equal(slots.find((x) => x.text.includes(T)).panel, `Dr. ${tag} B`);

  // 7. "Urus jadual di List Panel" shortcut
  await page.getByRole('link', { name: /Urus jadual di List Panel/ }).click();
  await page.waitForSelector('#h-panel');

  // 8. cleanup: delete test rows -> slot disappears from Upcoming
  for (const nama of [`Ustaz ${tag} A`, `Dr. ${tag} B`, `Ustaz ${tag} C`]) {
    const id = sheet(rt, 'PANEL').find((r) => r.nama_panel === nama).id;
    await go(page, 'panel');
    await page.locator(`li[data-panel-id="${id}"]`).getByRole('button', { name: 'Padam' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Padam' }).click();
    await toast(page, /dipadam/);
    await synced(page);
  }
  slots = await upcomingSlots(page);
  assert.ok(!slots.some((x) => x.text.includes(T)));
}

// ======================================================================
(async () => {
  const started = await startServer(GAS_PORT, { pin: PIN });
  const gas = started.server;
  rt = started.rt;
  const app = await serveDist();
  const browser = await chromium.launch();

  try {
    // ------------------------------ PUBLIC ------------------------------
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, permissions: ['clipboard-read', 'clipboard-write'] });
    await stubThumbs(ctx);
    const page = await ctx.newPage();
    watch(page, 'public');

    await step('live load: data comes from Code.gs', async () => {
      await page.goto(APP + '#upcoming');
      await synced(page);
      await page.getByRole('heading', { level: 1 }).filter({ hasText: 'Mengurus Hati' }).waitFor();
      assert.equal(await page.locator('text=Demo').count(), 0, 'should not be in demo mode');
    });

    await step('Upcoming (public): no "Salin Info WA" button, no card footer, no mention in copy', async () => {
      const cards = page.locator('#h-upcoming >> xpath=ancestor::section').locator('ul > li');
      assert.ok(await cards.count() >= 1);
      assert.equal(await page.getByRole('button', { name: /Salin Info WA|Disalin/ }).count(), 0);
      assert.equal(await page.getByText('Salin Info WA').count(), 0, 'description must not point to a hidden button');
      // public cards have no empty admin footer (no stray divider)
      assert.equal(await cards.first().locator('.border-t').count(), 0);
    });

    await step('Hero "Panduan Panel" navigates to Panduan', async () => {
      await page.click('button:has-text("Panduan Panel")');
      await page.waitForSelector('#h-panduan');
      assert.equal(new URL(page.url()).hash, '#panduan');
      assert.ok(await page.locator('a:has-text("Muat Turun PDF")').count() >= 1);
      // skrip promosi rows must NOT leak into Panduan Panel
      assert.equal(await page.locator('#h-panduan >> xpath=ancestor::section').locator('text=Contoh Skrip Promosi').count(), 0);
    });

    await step('List Panel: search + filter + empty state', async () => {
      await go(page, 'panel');
      await page.fill('input[placeholder^="Cari"]', 'hafiz');
      assert.equal(await page.locator('section li').count(), 1);
      await page.fill('input[placeholder^="Cari"]', 'zzzz');
      await page.waitForSelector('text=Tiada padanan');
      await page.click('button[aria-label="Kosongkan carian"]');
      await page.click('role=tab[name="Lepas"]');
      await page.click('role=tab[name="Semua"]');
      assert.ok(await page.locator('section li').count() >= 1);
    });

    await step('Peringatan: speech bubble + Arabic RTL rendered', async () => {
      await go(page, 'peringatan');
      const ar = page.locator('p[lang="ar"]').first();
      assert.equal(await ar.getAttribute('dir'), 'rtl');
    });

    await step('Promosi Kitab: public sees counts, no +/- controls, script card', async () => {
      await go(page, 'kitab');
      assert.ok(await page.locator('[aria-label$="kali dipromosi"]').count() >= 1);
      assert.equal(await page.locator('button[aria-label^="Tambah Riyadhus"]').count(), 0);
      await page.waitForSelector('text=Contoh Skrip Promosi');
    });

    await step('Episode YT: placeholder id shows fallback (no 404 request)', async () => {
      await go(page, 'youtube');
      const a = page.locator('section li a').first();
      // Seed link from Code.gs on main is a placeholder; the card must still link out safely.
      assert.match(await a.getAttribute('href'), /^https:\/\/(www\.youtube\.com|youtu\.be)\//);
      assert.equal(await a.getAttribute('target'), '_blank');
      assert.equal(await page.locator('section li img').count(), 0);
    });

    let myId;
    await step('Cadangan: public submit -> saved with owner_hash', async () => {
      await go(page, 'cadangan');
      await page.fill('#cad-catatan', 'Cadangan E2E: tambah sari kata BM pada semua episod.');
      await page.click('text=Hantar Cadangan');
      await toast(page, /Terima kasih/);
      await synced(page);
      const row = sheet(rt, 'CADANGAN').find((r) => r.catatan.startsWith('Cadangan E2E'));
      assert.ok(row, 'row in sheet');
      assert.equal(row.status, 'BELUM');
      assert.match(row.owner_hash, /^[0-9a-f]{64}$/);
      myId = row.id;
      await page.locator('li', { hasText: 'Cadangan E2E' }).locator('text=Cadangan anda').waitFor();
    });

    await step('Cadangan: cooldown blocks immediate resubmit', async () => {
      await page.fill('#cad-catatan', 'Spam kedua yang terlalu cepat');
      await page.click('text=Hantar Cadangan');
      await toast(page, /Sila tunggu/);
      assert.equal(sheet(rt, 'CADANGAN').filter((r) => r.catatan.startsWith('Spam kedua')).length, 0);
      await page.fill('#cad-catatan', '');
    });

    await step('Cadangan: owner edits own; cannot edit others', async () => {
      const mine = page.locator('li', { hasText: 'Cadangan E2E' });
      await mine.locator('button[aria-label="Edit cadangan"]').click();
      await page.fill('#f-catatan', 'Cadangan E2E (disunting): sari kata BM & EN.');
      await page.click('button:has-text("Simpan")');
      await toast(page, /disimpan/);
      await synced(page);
      assert.match(sheet(rt, 'CADANGAN').find((r) => r.id === myId).catatan, /disunting/);
      const other = page.locator('li', { hasText: 'soal jawab' });
      if (await other.count()) assert.equal(await other.locator('button[aria-label="Edit cadangan"]').count(), 0);
      // admin-only controls hidden
      assert.equal(await page.locator('button[aria-label="Padam cadangan"]').count(), 0);
      assert.equal(await page.locator('textarea[aria-label="Maklum balas admin"]').count(), 0);
    });

    await step('Cadangan: status filter counts', async () => {
      await page.click('role=tab[name=/Belum Selesai/]');
      assert.ok(await page.locator('text=Cadangan E2E').count());
      await page.click('role=tab[name=/^Selesai/]');
      assert.equal(await page.locator('text=Cadangan E2E').count(), 0);
      await page.click('role=tab[name=/^Semua/]');
    });

    // ------------------------------ ADMIN ------------------------------
    await step('Admin trigger: 5 quick taps on © open the PIN dialog', async () => {
      await page.locator('[data-testid="copyright"]').scrollIntoViewIfNeeded();
      // dispatch the 5 taps inside one evaluate so they all land within the 2.5s window
      await page.evaluate(() => { const b = document.querySelector('[data-testid="copyright"]'); for (let i = 0; i < 5; i++) b.click(); });
      await page.waitForSelector('div[role="dialog"] input[type="password"]');
      await page.keyboard.press('Escape');
      await page.waitForSelector('div[role="dialog"]', { state: 'detached' });
    });

    await step('Admin: wrong PIN rejected, right PIN unlocks', async () => {
      await adminLogin(page, '000000');
      await page.waitForSelector('text=PIN tidak sah');
      await page.fill('div[role="dialog"] input[type="password"]', PIN);
      await page.click('div[role="dialog"] form button');
      await page.waitForSelector('[data-testid="admin-banner"]');
      rt.cache.clear(); // reset brute-force counter
    });

    await step('Admin Upcoming: "Salin Info WA" visible on every card and copies formatted message', async () => {
      await go(page, 'upcoming');
      const cards = page.locator('#h-upcoming >> xpath=ancestor::section').locator('ul > li');
      const n = await cards.count();
      assert.equal(await page.getByRole('button', { name: 'Salin Info WA' }).count(), n);
      await page.getByRole('button', { name: 'Salin Info WA' }).first().click();
      await toast(page, /disalin/i);
      const clip = await page.evaluate(() => navigator.clipboard.readText());
      assert.match(clip, /\*Tajuk:\* Mengurus Hati/);
      assert.match(clip, /\*Hari\/Tarikh:\* \w+, \d+ \w+ \d{4}/);
      assert.match(clip, new RegExp(`${APP_PORT}/#panduan`));
    });

    await step('Desktop: LIST PANEL -> UPCOMING + Hero sync (date, Belum Ditentukan, grouping, sort, hero)', async () => {
      await scheduleSyncFlow(page, 'D', { checkHero: true });
    });

    await step('Admin Panduan: add doc -> GDrive download link conversion', async () => {
      await go(page, 'panduan');
      await page.click('text=Tambah Dokumen');
      await page.fill('#f-tajuk', 'Dokumen E2E');
      await page.fill('#f-gdrive_url', 'https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQ/view?usp=sharing');
      await page.click('button:has-text("Simpan")');
      await toast(page, /ditambah/);
      await synced(page);
      const row = sheet(rt, 'PANDUAN').find((r) => r.tajuk === 'Dokumen E2E');
      assert.equal(row.kategori, 'PANEL');
      const href = await page.locator('article', { hasText: 'Dokumen E2E' }).locator('a:has-text("Muat Turun PDF")').getAttribute('href');
      assert.equal(href, 'https://drive.google.com/uc?export=download&id=1AbCdEfGhIjKlMnOpQ');
    });

    await step('Admin Peringatan: add quote with Arabic', async () => {
      await go(page, 'peringatan');
      await page.click('text=Tambah Peringatan');
      await page.fill('#f-arab', 'وَتَعَاوَنُوا عَلَى الْبِرِّ وَالتَّقْوَى');
      await page.fill('#f-petikan', 'Peringatan E2E: saling membantu dalam kebaikan.');
      await page.click('button:has-text("Simpan")');
      await toast(page, /ditambah/);
      await synced(page);
      assert.ok(sheet(rt, 'PERINGATAN').find((r) => r.arab.startsWith('وَتَعَاوَنُوا')));
    });

    await step('Admin Kitab: +/- sync to sheet (rapid clicks), add script', async () => {
      await go(page, 'kitab');
      const id = sheet(rt, 'KITAB').find((r) => r.nama_kitab === 'Riyadhus Solihin').id;
      const start = Number(sheet(rt, 'KITAB').find((r) => r.id === id).bilangan);
      const plus = page.locator('button[aria-label="Tambah Riyadhus Solihin"]');
      await plus.click(); await plus.click(); await plus.click();
      await page.locator('button[aria-label="Kurangkan Riyadhus Solihin"]').click();
      await synced(page);
      await page.waitForTimeout(400);
      assert.equal(Number(sheet(rt, 'KITAB').find((r) => r.id === id).bilangan), start + 2);
      assert.match(await page.locator('li', { hasText: 'Riyadhus' }).locator('[aria-label$="kali dipromosi"]').innerText(), new RegExp(`${start + 2}`));

      await page.click('text=+ Tambah skrip');
      await page.fill('#f-tajuk', 'Skrip E2E');
      await page.fill('#f-gdrive_url', 'https://drive.google.com/file/d/1ZZZZZZZZZZZZZ/view');
      await page.click('button:has-text("Simpan")');
      await toast(page, /ditambah/);
      await synced(page);
      assert.equal(sheet(rt, 'PANDUAN').find((r) => r.tajuk === 'Skrip E2E').kategori, 'SKRIP_PROMOSI');
    });

    await step('Admin YouTube: invalid link rejected, youtu.be link -> auto thumbnail', async () => {
      await go(page, 'youtube');
      await page.click('text=Tambah Episod');
      await page.fill('#f-tajuk', 'EP E2E');
      await page.fill('#f-youtube_url', 'https://youtu.be/notvalid');
      await page.waitForSelector('text=Pautan YouTube tidak dikenali');
      await page.click('button:has-text("Simpan")');
      await toast(page, /tidak sah/);
      await page.fill('#f-youtube_url', 'https://youtu.be/dQw4w9WgXcQ?si=share');
      await page.waitForSelector('text=ID video dikesan');
      await page.click('button:has-text("Simpan")');
      await toast(page, /ditambah/);
      await synced(page);
      const card = page.locator('li', { hasText: 'EP E2E' });
      assert.equal(await card.locator('img').getAttribute('src'), 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg');
      assert.equal(await card.locator('a').first().getAttribute('href'), 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
      await page.waitForFunction(() => [...document.querySelectorAll('section li img')].some((i) => i.complete && i.naturalWidth > 120));
    });

    await step('Admin Cadangan: Done toggle + reply sync', async () => {
      await go(page, 'cadangan');
      const b = page.locator('li', { hasText: 'Cadangan E2E' });
      await b.locator('button:has-text("Tandakan Done")').click();
      await toast(page, /selesai/i);
      await b.locator('textarea[aria-label="Maklum balas admin"]').fill('Baik, akan dilaksanakan bulan depan.');
      await b.locator('button:has-text("Simpan")').click();
      await toast(page, /Maklum balas disimpan/);
      await synced(page);
      const row = sheet(rt, 'CADANGAN').find((r) => r.id === myId);
      assert.equal(row.status, 'SELESAI');
      assert.equal(row.balasan_admin, 'Baik, akan dilaksanakan bulan depan.');
    });

    await step('After logout: owner\'s Done item is locked, reply visible', async () => {
      await page.click('button[title="Keluar Mod Admin"]');
      // Salin Info WA disappears again as soon as admin mode is locked
      await go(page, 'upcoming');
      assert.equal(await page.getByRole('button', { name: 'Salin Info WA' }).count(), 0);
      await go(page, 'cadangan');
      const b = page.locator('li', { hasText: 'Cadangan E2E' });
      await b.locator('text=Dikunci').waitFor();
      assert.equal(await b.locator('button[aria-label="Edit cadangan"]').count(), 0);
      await b.locator('text=akan dilaksanakan').waitFor();
    });

    await step('Stale PIN: admin action after PIN change -> error + auto logout', async () => {
      await adminLogin(page);
      await page.waitForSelector('[data-testid="admin-banner"]');
      rt.props.set('ADMIN_PIN', '999999');
      await go(page, 'kitab');
      await page.locator('button[aria-label="Tambah Riyadhus Solihin"]').click();
      await toast(page, /PIN salah/);
      await page.waitForSelector('[data-testid="admin-banner"]', { state: 'detached' });
      rt.props.set('ADMIN_PIN', PIN);
      rt.cache.clear();
    });

    await step('Stale-while-revalidate: cached data renders instantly while API is slow', async () => {
      let release;
      const gate = new Promise((r) => (release = r));
      await page.route('**/exec?**', async (r) => { await gate; await r.fallback(); }); // fallback -> emulator route
      await page.reload();
      await page.getByRole('heading', { level: 1 }).filter({ hasText: 'Mengurus Hati' }).waitFor({ timeout: 2000 });
      release();
      await synced(page);
      await page.unroute('**/exec?**');
    });

    await step('Offline: API down -> "Luar talian" badge, cached UI stays usable', async () => {
      expectNetErrors = true;
      await page.route('**/exec**', (r) => r.abort());
      await page.reload();
      await page.waitForSelector('text=Luar talian');
      await page.getByRole('heading', { level: 1 }).waitFor();
      await page.unroute('**/exec**');
      await page.click('text=Luar talian');
      await synced(page);
      await page.waitForSelector('text=Luar talian', { state: 'detached' }); // recovered
      expectNetErrors = false;
    });

    await step('First visit + API down: error card with retry (no misleading empty state)', async () => {
      expectNetErrors = true;
      const c2 = await browser.newContext();
      await useEmulator(c2);
      const p2 = await c2.newPage();
      watch(p2, 'firstvisit');
      await p2.route('**/exec**', (r) => r.abort());
      await p2.goto(APP + '#panel');
      await p2.waitForSelector('text=Tidak dapat memuatkan data');
      assert.equal(await p2.locator('text=Tiada rekod').count(), 0);
      await p2.unroute('**/exec**');
      await p2.click('text=Cuba lagi');
      await p2.waitForSelector('#h-panel');
      await c2.close();
      expectNetErrors = false;
    });

    await ctx.close();

    // ------------------------------ MOBILE ------------------------------
    for (const dev of ['iPhone SE', 'iPhone 13', 'Galaxy S9+']) {
      await step(`Mobile ${dev}: no horizontal overflow on any tab (public + admin + modal)`, async () => {
        const mctx = await browser.newContext({ ...devices[dev] });
        await stubThumbs(mctx);
        const mp = await mctx.newPage();
        // Emulate Safari: transformed/animated ancestors become the containing block for position:fixed.
        await mp.addInitScript(() => document.addEventListener('DOMContentLoaded', () => {
          const st = document.createElement('style');
          st.textContent = '.animate-fade-up{will-change:transform}';
          document.head.appendChild(st);
        }));
        watch(mp, dev);
        await mp.goto(APP);
        await synced(mp);
        const tabs = ['upcoming', 'panel', 'panduan', 'peringatan', 'kitab', 'youtube', 'cadangan'];
        for (const t of tabs) { await go(mp, t); await noHorizontalScroll(mp, `${dev} public #${t}`); }
        await adminLogin(mp);
        await mp.waitForSelector('[data-testid="admin-banner"]');
        rt.cache.clear();
        for (const t of tabs) { await go(mp, t); await noHorizontalScroll(mp, `${dev} admin #${t}`); }
        // Every "add" form, opened after scrolling down: overlay must cover the viewport and
        // the Simpan button must be on-screen (regression: sheet trapped inside the section).
        const forms = [['panel', /Tambah Panel/], ['panduan', /Tambah Dokumen/],
          ['peringatan', /Tambah Peringatan/], ['kitab', /Tambah Kitab/], ['kitab', /\+ Tambah skrip/],
          ['youtube', /Tambah Episod/]];
        for (const [t, name] of forms) {
          await go(mp, t);
          await mp.evaluate(() => window.scrollTo(0, 300));
          await mp.getByRole('button', { name }).click();
          const g = await mp.evaluate(() => {
            const d = document.querySelector('div[role="dialog"]');
            const o = d.getBoundingClientRect();
            const save = [...d.querySelectorAll('button')].find((x) => /Simpan|Hantar/.test(x.textContent)).getBoundingClientRect();
            return { o: [o.x, o.y, o.width, o.height], vw: innerWidth, vh: innerHeight, saveTop: save.top, saveBottom: save.bottom, inBody: d.parentElement === document.body };
          });
          assert.ok(g.inBody, `${t}: dialog portalled to body`);
          assert.deepEqual(g.o.map(Math.round), [0, 0, g.vw, g.vh], `${dev} ${t}: overlay covers viewport`);
          assert.ok(g.saveTop >= 0 && g.saveBottom <= g.vh + 0.5, `${dev} ${t}: Simpan visible (${g.saveBottom} > ${g.vh})`);
          const fs_ = await mp.locator('div[role="dialog"] input, div[role="dialog"] textarea').first().evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
          assert.ok(fs_ >= 16, `input font ${fs_}px (iOS zoom)`);
          await mp.keyboard.press('Escape');
          await mp.waitForSelector('div[role="dialog"]', { state: 'detached' });
        }
        await mctx.close();
      });
    }

    await step('Mobile bottom tab bar: tabs, "Lagi" sheet, active slot, starts at top', async () => {
      const mctx = await browser.newContext({ ...devices['iPhone 13'] });
      await stubThumbs(mctx);
      const mp = await mctx.newPage();
      watch(mp, 'bottomnav');
      await mp.goto(APP + '#upcoming');
      await synced(mp);
      const bar = mp.getByRole('navigation', { name: 'Seksyen utama' });
      await bar.getByRole('link', { name: 'Panel' }).click();
      await mp.waitForSelector('#h-panel');
      assert.equal(new URL(mp.url()).hash, '#panel');
      // compact strip replaces the full hero off the Upcoming tab
      assert.equal(await mp.locator('h1').isVisible(), false);
      await mp.locator('a:has-text("Seterusnya")').waitFor();
      await mp.evaluate(() => window.scrollTo(0, 600));
      await bar.getByRole('button', { name: 'Lagi' }).click();
      const sheet = mp.getByRole('dialog', { name: 'Seksyen lain' });
      await sheet.getByRole('link', { name: /Promosi Kitab/ }).click();
      await mp.waitForSelector('#h-kitab');
      await sheet.waitFor({ state: 'detached' });
      assert.equal(await mp.evaluate(() => window.scrollY), 0, 'new tab starts at top');
      await bar.getByRole('button', { name: 'Kitab' }).waitFor(); // 5th slot shows current section
      // every bar target >= 44px and bar never covers the footer's admin lock
      const sizes = await bar.locator('a:visible, button:visible').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height));
      assert.ok(sizes.every((h) => h >= 44), `bar targets ${sizes}`);
      await mp.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      const lock = await mp.locator('button[aria-label="Log masuk Admin"]').boundingBox();
      const barTop = (await bar.boundingBox()).y;
      assert.ok(lock.y + lock.height <= barTop, 'footer content clears the tab bar');
      await mctx.close();
    });

    await step('Mobile (iPhone 13): LIST PANEL -> UPCOMING sync (date, Belum Ditentukan, grouping, sort)', async () => {
      const mctx = await browser.newContext({ ...devices['iPhone 13'] });
      await stubThumbs(mctx);
      const mp = await mctx.newPage();
      watch(mp, 'mobile-sync');
      await mp.goto(APP + '#upcoming');
      await synced(mp);
      await adminLogin(mp);
      await mp.waitForSelector('[data-testid="admin-banner"]');
      rt.cache.clear();
      await scheduleSyncFlow(mp, 'M');
      await mctx.close();
    });

    // ------------------------------ BILINGUAL BM / العربية ------------------------------
    const HARI_AR = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    const dayAr = (iso) => { const [y, m, d] = iso.split('-').map(Number); return HARI_AR[new Date(y, m - 1, d).getDay()]; };
    const htmlState = (pg) => pg.evaluate(() => ({ lang: document.documentElement.lang, dir: document.documentElement.dir, saved: localStorage.getItem('hph_lang') }));

    await step('i18n desktop: toggle -> RTL + Arabic UI, persists across reload, data unchanged, back to BM', async () => {
      // a "Belum Ditentukan" row to check the translated status (stored value must stay BM)
      const tbd = (await (await fetch(`http://localhost:${GAS_PORT}/exec`, { method: 'POST', headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ pin: PIN, action: 'create', sheet: 'PANEL', item: { tajuk: 'Rezeki & Tawakal', nama_panel: 'Ustaz i18n TBD', tarikh: 'Belum Ditentukan' } }) })).json()).data;
      const c = await browser.newContext({ viewport: { width: 1280, height: 860 } });
      await stubThumbs(c);
      const p = await c.newPage();
      watch(p, 'i18n-desktop');
      await p.goto(APP + '#upcoming');
      await synced(p);
      assert.deepEqual(await htmlState(p), { lang: 'ms', dir: 'ltr', saved: null }, 'BM by default');
      await p.click('[data-lang-option="ar"]');
      assert.deepEqual(await htmlState(p), { lang: 'ar', dir: 'rtl', saved: 'ar' });
      assert.equal(await p.getAttribute('[data-lang-option="ar"]', 'aria-pressed'), 'true');
      // persists + applied before React renders (inline script in index.html)
      await p.reload();
      assert.deepEqual(await htmlState(p), { lang: 'ar', dir: 'rtl', saved: 'ar' });
      await synced(p);
      // translated section titles / nav
      await p.waitForSelector('#h-upcoming:has-text("البودكاست القادم")');
      const navText = await p.locator('header nav').innerText();
      for (const w of ['القادم', 'قائمة الضيوف', 'الدليل', 'التوجيهات', 'التعريف بالكتب', 'الحلقات', 'المقترحات']) assert.ok(navText.includes(w), `nav has ${w}`);
      // Arabic day names on derived schedule cards; user content (tajuk) untouched
      const slots = await p.locator('[data-slot]').evaluateAll((els) => els.map((e) => ({ id: e.getAttribute('data-slot'), text: e.innerText, h3: e.querySelector('h3').innerText })));
      assert.ok(slots.length > 0);
      for (const sl of slots) assert.ok(sl.text.includes(dayAr(sl.id.slice(0, 10))), `Arabic day on ${sl.id}`);
      const firstPanel = sheet(rt, 'PANEL').find((r) => r.tajuk.trim() === slots[0].h3.trim());
      assert.ok(firstPanel, 'card title is the Sheet value verbatim');
      // typography: Tajawal for UI, no letter-spacing on Arabic labels, Amiri kept for Quranic text
      assert.match(await p.evaluate(() => getComputedStyle(document.body).fontFamily), /Tajawal/);
      assert.equal(await p.evaluate(() => getComputedStyle(document.querySelector('section p.uppercase')).letterSpacing), 'normal');
      // geometry mirrors: brand on the right, desktop nav to its left, CTA arrow flipped
      const brand = await p.locator('header a[href="#upcoming"]').first().boundingBox();
      assert.ok(brand.x + brand.width > 1280 / 2 + 200, 'brand on the right in RTL');
      assert.match(await p.evaluate(() => getComputedStyle(document.querySelector('button.btn-gold svg.flip-rtl')).transform), /^matrix\(-1/);
      // List Panel: TBD shown as "غير محدد", Sheet keeps "Belum Ditentukan"
      await go(p, 'panel');
      await p.locator(`li[data-panel-id="${tbd.id}"]`).getByText('غير محدد').waitFor();
      assert.equal(sheet(rt, 'PANEL').find((r) => r.id === tbd.id).tarikh, 'Belum Ditentukan');
      assert.match(await p.locator('section p.text-\\[13px\\]').first().innerText(), /^عدد السجلات: \d+$/);
      // Admin flow in Arabic: form labels, live Arabic day preview, saved data stays BM-coded
      await adminLogin(p);
      await p.waitForSelector('[data-testid="admin-banner"]:has-text("وضع المشرف مفعّل")');
      rt.cache.clear();
      await p.getByRole('button', { name: /إضافة ضيف/ }).click();
      await p.getByRole('dialog').getByText('غير محدد').waitFor();
      await p.fill('#f-tajuk', 'Tajuk i18n');
      await p.fill('#f-nama_panel', 'Ustaz i18n AR');
      await p.fill('#f-tarikh', iso(6));
      assert.ok((await p.getByTestId('hari-preview').innerText()).startsWith(`${dayAr(iso(6))}، `));
      await p.check('#f-tbd');
      await p.getByRole('dialog').getByRole('button', { name: 'حفظ' }).click();
      await toast(p, /تم حفظ الضيف/);
      await synced(p);
      assert.equal(sheet(rt, 'PANEL').find((r) => r.nama_panel === 'Ustaz i18n AR').tarikh, 'Belum Ditentukan');
      // Peringatan bubble tail sits on the start (right) side in RTL
      await go(p, 'peringatan');
      const tail = await p.locator('figure span.absolute').first().boundingBox();
      const bubble = await p.locator('figure > div.relative').first().boundingBox();
      assert.ok(tail.x > bubble.x + bubble.width - 10, 'bubble tail on the right in RTL');
      // back to BM
      await p.click('[data-lang-option="ms"]');
      assert.deepEqual(await htmlState(p), { lang: 'ms', dir: 'ltr', saved: 'ms' });
      await go(p, 'upcoming');
      await p.waitForSelector('#h-upcoming:has-text("Upcoming Podcast")');
      // cleanup
      for (const id of [tbd.id, sheet(rt, 'PANEL').find((r) => r.nama_panel === 'Ustaz i18n AR').id]) {
        await fetch(`http://localhost:${GAS_PORT}/exec`, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ pin: PIN, action: 'delete', sheet: 'PANEL', id }) });
      }
      await c.close();
    });

    await step('i18n mobile (iPhone 13, AR): bottom bar mirrored, Lagi sheet, no overflow, brand unclipped, banner logout', async () => {
      const mctx = await browser.newContext({ ...devices['iPhone 13'] });
      await stubThumbs(mctx);
      await mctx.addInitScript(() => { try { if (!sessionStorage.getItem('x')) { localStorage.setItem('hph_lang', 'ar'); sessionStorage.setItem('x', '1'); } } catch (e) {} });
      const mp = await mctx.newPage();
      watch(mp, 'i18n-mobile');
      await mp.goto(APP + '#upcoming');
      await synced(mp);
      assert.equal((await htmlState(mp)).dir, 'rtl');
      const bar = mp.getByRole('navigation', { name: 'الأقسام الرئيسية' });
      const first = await bar.getByRole('link', { name: 'القادم' }).boundingBox();
      const more = await bar.getByRole('button', { name: 'المزيد' }).boundingBox();
      assert.ok(first.x > more.x, 'first tab on the right, "More" on the left (RTL)');
      await bar.getByRole('button', { name: 'المزيد' }).click();
      await mp.getByRole('dialog', { name: 'أقسام أخرى' }).getByRole('link', { name: /التعريف بالكتب/ }).click();
      await mp.waitForSelector('#h-kitab:has-text("التعريف بالكتب")');
      const W = 390;
      for (const tab of ['upcoming', 'panel', 'panduan', 'peringatan', 'kitab', 'youtube', 'cadangan']) {
        await go(mp, tab);
        const o = await mp.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth }));
        assert.ok(o.sw <= W && o.iw <= W, `AR #${tab}: overflow ${JSON.stringify(o)}`);
      }
      // brand fully visible (wraps, never clipped/ellipsized) even in admin mode
      const brandClipped = () => mp.evaluate(() => {
        const el = document.querySelector('header span[lang="en"]');
        return el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1;
      });
      assert.equal(await brandClipped(), false, 'brand clipped (public)');
      await adminLogin(mp);
      await mp.waitForSelector('[data-testid="admin-banner"]');
      rt.cache.clear();
      assert.equal(await brandClipped(), false, 'brand clipped (admin)');
      // phones: logout lives in the admin banner
      await mp.getByTestId('admin-banner').getByRole('button', { name: 'خروج' }).click();
      await mp.waitForSelector('[data-testid="admin-banner"]', { state: 'detached' });
      await mctx.close();

      // BM at the narrowest common phone (320px): brand not clipped either
      const sctx = await browser.newContext({ ...devices['iPhone SE'] });
      await stubThumbs(sctx);
      const sp = await sctx.newPage();
      watch(sp, 'brand-320');
      await sp.goto(APP);
      await synced(sp);
      await adminLogin(sp);
      await sp.waitForSelector('[data-testid="admin-banner"]');
      rt.cache.clear();
      assert.equal(await sp.evaluate(() => { const el = document.querySelector('header span[lang="en"]'); return el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1; }), false, 'brand clipped at 320px (BM, admin)');
      await sctx.close();
    });

    // ------------------------------ FOCUS REGRESSION ------------------------------
    await step('Modal keeps focus while background sync re-renders the page', async () => {
      const c = await browser.newContext({ viewport: { width: 1280, height: 860 } });
      await useEmulator(c);
      const p = await c.newPage();
      watch(p, 'focus');
      await p.goto(APP + '#panel');
      await synced(p);
      await adminLogin(p);
      await p.waitForSelector('[data-testid="admin-banner"]');
      rt.cache.clear();
      await p.click('text=Tambah Panel');
      await p.click('#f-nama_panel');
      await p.keyboard.type('Ustaz ', { delay: 30 });
      await p.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); // triggers refresh()
      await p.waitForTimeout(400);
      await p.keyboard.type('Fokus', { delay: 30 });
      assert.equal(await p.inputValue('#f-nama_panel'), 'Ustaz Fokus');
      assert.equal(await p.inputValue('#f-tajuk'), '');
      await c.close();
    });

    assert.deepEqual(errors, [], 'console/page errors:\n' + errors.join('\n'));
    console.log(`\n${passed} E2E checks passed, 0 console errors`);
  } finally {
    await browser.close();
    gas.close();
    app.close();
  }
})().catch((e) => {
  console.error('\n✗', e.message);
  if (errors.length) console.error('console errors:\n' + errors.join('\n'));
  process.exit(1);
});
