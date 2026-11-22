/**
 * Mobile UI audit: measures every section (public + admin) and every form/modal on
 * real phone viewports, reports objective issues and writes screenshots.
 *
 *   npm run build && node tests/mobile-audit.cjs [outDir] [--strict]
 *
 * Checks: horizontal overflow, tap targets < 44x44 px, text < 12 px, elements cut off
 * at the screen edge, modal fit. All Apps Script traffic goes to the local emulator.
 */
const { createRequire } = require('node:module');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { startServer } = require('./gas-emulator.cjs');

const req = createRequire(__filename);
let pw;
try { pw = req('playwright'); } catch { pw = require(path.join(require('node:child_process').execSync('npm root -g').toString().trim(), 'playwright')); }
const { chromium } = pw;

const ROOT = path.join(__dirname, '..');
const OUT = path.resolve(process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : path.join(ROOT, '.mobile-audit'));
const STRICT = process.argv.includes('--strict');
const DIST = path.join(ROOT, 'dist');
const GAS_PORT = 8788;
const APP_PORT = 4181;
const APP = `http://localhost:${APP_PORT}/`;
const PIN = '246810';
const MIN_TAP = 44;
const MIN_FONT = 12;

const VIEWPORTS = [
  { name: '375x812', viewport: { width: 375, height: 812 } },
  { name: '390x844', viewport: { width: 390, height: 844 } },
];
const TABS = ['upcoming', 'panel', 'panduan', 'peringatan', 'kitab', 'youtube', 'cadangan'];
const LANGS = ['ms', 'ar'];
const FORMS = {
  ms: [['panel', /Tambah Panel/], ['panduan', /Tambah Dokumen/], ['peringatan', /Tambah Peringatan/], ['kitab', /Tambah Kitab/], ['kitab', /Tambah skrip/], ['youtube', /Tambah Episod/]],
  ar: [['panel', /إضافة ضيف/], ['panduan', /إضافة وثيقة/], ['peringatan', /إضافة توجيه/], ['kitab', /إضافة كتاب/], ['kitab', /إضافة نص/], ['youtube', /إضافة حلقة/]],
};
const LABELS = {
  ms: { edit: 'Edit cadangan', del: 'Padam cadangan' },
  ar: { edit: 'تعديل المقترح', del: 'حذف المقترح' },
};

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };
const serve = () => new Promise((resolve) => {
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

async function seedStress() {
  const post = (b) => fetch(`http://localhost:${GAS_PORT}/exec`, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ pin: PIN, ...b }) }).then((r) => r.json());
  const d = (n) => { const x = new Date(); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
  const H = ['Ahad', 'Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Sabtu'];
  const hari = (n) => { const x = new Date(); x.setDate(x.getDate() + n); return H[x.getDay()]; };
  const up = [
    [3, 'Adab Penuntut Ilmu: Belajar daripada Kitab Ta\'lim al-Muta\'allim karangan Imam az-Zarnuji', 'Ustaz Muhammad Amirul Hakim bin Abdullah, Dr. Nurul Huda Ismail & Sdr. Faiz Azman'],
    [10, 'Keluarga Sakinah', 'Ustazah Siti Aisyah'],
    [-5, 'Hikmah di Sebalik Ujian', 'Ustaz Muhammad Syafiq & Pn. Rohani Abdullah'],
  ];
  // LIST PANEL drives Upcoming: one row per panelist; same tajuk+date merge into one slot.
  for (const [n, tajuk, panel] of up) {
    for (const nama of panel.split(/, | & /)) await post({ action: 'create', sheet: 'PANEL', item: { tarikh: d(n), tajuk, nama_panel: nama } });
  }
  await post({ action: 'create', sheet: 'PANEL', item: { tarikh: 'Belum Ditentukan', tajuk: 'Rezeki & Tawakal: Antara Usaha dan Doa', nama_panel: 'Ustaz Zulkifli Hassan' } });
  for (const [t, p] of [['Mengurus Hati di Era Media Sosial: Antara Riya\' dan Ikhlas', 'Dr. Ahmad Fauzi bin Yusof Al-Hafiz'], ['Solat Khusyuk', 'Ustaz Hafiz Rahman']]) await post({ action: 'create', sheet: 'PANEL', item: { tajuk: t, nama_panel: p, tarikh: d(-14) } });
  await post({ action: 'create', sheet: 'PANDUAN', item: { kategori: 'PANEL', tajuk: 'SOP Moderator & Pengurusan Masa Rakaman Langsung', keterangan: 'Skrip pembukaan, penutup dan cara mengendalikan soalan penonton.', gdrive_url: 'https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQ/view' } });
  await post({ action: 'create', sheet: 'PERINGATAN', item: { petikan: 'Bercakaplah dengan bahasa yang memudahkan, bukan menyukarkan. Sampaikan dengan lembut walaupun tegas pada prinsip, kerana tujuan kita menyampaikan, bukan memenangi hujah.', arab: 'يَسِّرُوا وَلَا تُعَسِّرُوا، وَبَشِّرُوا وَلَا تُنَفِّرُوا، وَتَطَاوَعُوا وَلَا تَخْتَلِفُوا', konteks: 'Usrah Pengurusan Podcast, Rabiulawal 1448H' } });
  for (const [k, n] of [['Ihya\' Ulum al-Din (Terjemahan Lengkap 4 Jilid)', 7], ['Al-Hikam Ibn \'Atha\'illah as-Sakandari', 4], ['Bidayatul Hidayah', 0]]) await post({ action: 'create', sheet: 'KITAB', item: { nama_kitab: k, bilangan: n } });
  for (const [t, u] of [['EP12 · Hikmah di Sebalik Ujian Bersama Ustaz Muhammad Syafiq', 'https://youtu.be/dQw4w9WgXcQ'], ['EP11 · Solat Khusyuk', 'https://www.youtube.com/watch?v=jNQXAC9IVRw']]) await post({ action: 'create', sheet: 'YOUTUBE', item: { tajuk: t, youtube_url: u, tarikh: d(-7) } });
  await post({ action: 'create', sheet: 'CADANGAN', item: { catatan: 'Cadangan: letak pautan penuh https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789abcdef supaya mudah diakses.' } });
  await post({ action: 'create', sheet: 'CADANGAN', item: { catatan: 'Tambah segmen soal jawab langsung dari penonton YouTube pada 10 minit terakhir.', status: 'SELESAI', balasan_admin: 'Terima kasih! Akan dicuba pada episod seterusnya.' } });
}

async function useEmulator(ctx) {
  const png = fs.readFileSync(path.join(ROOT, 'public/icons/icon-512.png'));
  await ctx.route(/^https:\/\/script\.google(usercontent)?\.com\//, async (route) => {
    const u = new URL(route.request().url());
    try { await route.fulfill({ response: await route.fetch({ url: `http://localhost:${GAS_PORT}/exec${u.search}` }) }); } catch { await route.abort(); }
  });
  await ctx.route('**/i.ytimg.com/**', (r) => r.fulfill({ status: 200, contentType: 'image/png', body: png }));
}

/** Runs in the page: objective measurements of the current screen. */
function measure({ scope, deviceWidth, lang }) {
  // Compare against the DEVICE width, not innerWidth: on mobile, overflowing content makes the
  // browser widen the layout viewport (page zooms out), so innerWidth would hide the bug.
  const vw = deviceWidth;
  const root = scope ? document.querySelector(scope) : document.body;
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && !el.closest('[aria-hidden="true"]');
  };
  const label = (el) => (el.getAttribute('aria-label') || el.textContent || el.getAttribute('placeholder') || el.tagName).trim().replace(/\s+/g, ' ').slice(0, 40);
  const issues = [];
  const sw = document.documentElement.scrollWidth;
  if (sw > vw) issues.push({ type: 'overflow-x', detail: `${sw}px > ${vw}px` });
  if (window.innerWidth > vw) issues.push({ type: 'overflow-x', detail: `layout viewport widened to ${window.innerWidth}px (page zoomed out)` });

  // Interactive elements: tap target size
  const inter = root.querySelectorAll('a[href], button, input:not([type=hidden]), select, textarea, [role=tab]');
  for (const el of inter) {
    if (!visible(el) || el.tabIndex === -1 && el.tagName === 'INPUT') continue;
    if (el.closest('.no-scrollbar') && el.getBoundingClientRect().right > vw) continue; // off-screen in a scroller is fine
    // A checkbox/radio wrapped in a <label> is tapped via the whole label: measure that.
    const hit = /^(checkbox|radio)$/.test(el.type) && el.closest('label') ? el.closest('label') : el;
    const r = hit.getBoundingClientRect();
    if (r.height < 44 - 0.5 || r.width < 44 - 0.5) issues.push({ type: 'tap<44', detail: `${Math.round(r.width)}x${Math.round(r.height)} "${label(el)}"` });
  }
  // Text size + clipped at screen edge
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const seen = new Set();
  while (walker.nextNode()) {
    const t = walker.currentNode;
    const el = t.parentElement;
    if (!t.textContent.trim() || seen.has(el) || !visible(el) || el.closest('svg,[aria-hidden="true"],.sr-only')) continue;
    seen.add(el);
    const fs = parseFloat(getComputedStyle(el).fontSize);
    if (fs < 12) issues.push({ type: 'font<12', detail: `${fs}px "${label(el)}"` });
    const r = el.getBoundingClientRect();
    if (!el.closest('.no-scrollbar') && (r.right > vw + 1 || r.left < -1)) issues.push({ type: 'cut-off', detail: `"${label(el)}" ${Math.round(r.left)}..${Math.round(r.right)}` });
  }
  // Any element extending past the screen edge (unless clipped by an on-screen ancestor).
  for (const el of root.querySelectorAll('*')) {
    if (!visible(el) || el.closest('svg')) continue;
    const r = el.getBoundingClientRect();
    if (r.right <= vw + 1 && r.left >= -1) continue;
    let clipped = false;
    for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
      const cs = getComputedStyle(a);
      if (cs.overflowX !== 'visible') { const ar = a.getBoundingClientRect(); if (ar.right <= vw + 1 && ar.left >= -1) { clipped = true; break; } }
    }
    if (!clipped) issues.push({ type: 'past-edge', detail: `<${el.tagName.toLowerCase()} class="${String(el.className).slice(0, 50)}"> ${Math.round(r.left)}..${Math.round(r.right)}` });
  }
  // Arabic mode: any visible Latin word that is not user content (dir="auto"), a marked
  // brand/code (lang="en"/"ms", <code>), or a known technical term = untranslated UI text.
  if (lang === 'ar') {
    if (document.documentElement.dir !== 'rtl') issues.push({ type: 'not-rtl', detail: document.documentElement.dir });
    const OK = /^(PDF|URL|PIN|YouTube|Google|Drive|Apps|Script|WhatsApp|youtube|com|youtu|be|shorts|live|embed|watch|https?|www|src|config|js|EP\d*)$/i;
    const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (tw.nextNode()) {
      const el = tw.currentNode.parentElement;
      if (!el || !visible(el) || el.closest('[dir="auto"],[lang="en"],[lang="ms"],code,svg,script,style,[aria-hidden="true"],.sr-only,input,textarea,select,option')) continue;
      const words = (tw.currentNode.textContent.match(/[A-Za-z][A-Za-z.]*/g) || []).filter((w) => !w.replace(/\.$/, '').split('.').every((x) => OK.test(x)));
      if (words.length) issues.push({ type: 'untranslated', detail: `"${tw.currentNode.textContent.trim().slice(0, 50)}"` });
    }
    for (const el of root.querySelectorAll('[placeholder],[title]')) {
      if (!visible(el) || el.closest('[dir="auto"],[lang="en"],[lang="ms"]')) continue;
      for (const attr of ['placeholder', 'title']) {
        const v = el.getAttribute(attr);
        if (!v || /:\/\//.test(v)) continue;
        const words = (v.match(/[A-Za-z][A-Za-z.]*/g) || []).filter((w) => !w.replace(/\.$/, '').split('.').every((x) => OK.test(x)));
        if (words.length) issues.push({ type: 'untranslated', detail: `${attr}="${v.slice(0, 50)}"` });
      }
    }
  }
  return issues;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const { server: gas } = await startServer(GAS_PORT, { pin: PIN });
  await seedStress();
  const app = await serve();
  const browser = await chromium.launch();
  const report = [];
  const errors = [];
  const add = (where, issues) => { for (const i of issues) report.push({ where, ...i }); };

  try {
    for (const lang of LANGS) for (const vp of VIEWPORTS) {
      const tag = `${lang}-${vp.name}`;
      const ctx = await browser.newContext({ ...vp, isMobile: true, hasTouch: true, deviceScaleFactor: 2, colorScheme: vp.name === '390x844' ? 'dark' : 'light' });
      await useEmulator(ctx);
      await ctx.addInitScript((l) => { try { localStorage.setItem('hph_lang', l); } catch (e) {} }, lang);
      // Safari containing-block behaviour for transformed ancestors
      await ctx.addInitScript(() => document.addEventListener('DOMContentLoaded', () => {
        const st = document.createElement('style'); st.textContent = '.animate-fade-up{will-change:transform}'; document.head.appendChild(st);
      }));
      const p = await ctx.newPage();
      p.on('console', (m) => m.type() === 'error' && errors.push(`${tag}: ${m.text()}`));
      p.on('pageerror', (e) => errors.push(`${tag}: ${e.message}`));
      await p.goto(APP + '#upcoming');
      await p.waitForFunction(() => !document.querySelector('.animate-spin') && document.querySelector('h1'));

      const go = async (t) => { await p.evaluate((x) => { location.hash = x; window.scrollTo(0, 0); }, t); await p.waitForSelector(`#h-${t}`); await p.waitForTimeout(350); };
      for (const mode of ['public', 'admin']) {
        if (mode === 'admin') {
          await p.click('[data-testid="admin-lock"]');
          add(`${tag} pin-modal`, await p.evaluate(measure, { scope: 'div[role="dialog"]', deviceWidth: vp.viewport.width, lang }));
          await p.screenshot({ path: `${OUT}/${tag}-modal-pin.png` });
          await p.fill('div[role="dialog"] input[type="password"]', PIN);
          await p.click('div[role="dialog"] form button');
          await p.waitForSelector('[data-testid="admin-banner"]');
        }
        for (const t of TABS) {
          await go(t);
          add(`${tag} ${mode} #${t}`, await p.evaluate(measure, { scope: null, deviceWidth: vp.viewport.width, lang }));
          await p.screenshot({ path: `${OUT}/${tag}-${mode}-${t}.png`, fullPage: true });
        }
      }
      // forms / modals
      for (const [t, name] of FORMS[lang]) {
        await go(t);
        await p.evaluate(() => window.scrollTo(0, 400));
        await p.getByRole('button', { name }).first().click();
        await p.waitForSelector('div[role="dialog"]');
        await p.waitForTimeout(350);
        const fit = await p.evaluate(() => {
          const d = document.querySelector('div[role="dialog"]');
          const sheet = d.querySelector(':scope > div.relative').getBoundingClientRect();
          const body = d.querySelector('[data-modal-body]');
          const save = [...d.querySelectorAll('button')].find((b) => /Simpan|حفظ/.test(b.textContent)).getBoundingClientRect();
          return { top: sheet.top, bottom: sheet.bottom, vh: innerHeight, scrollable: body.scrollHeight > body.clientHeight, saveOk: save.bottom <= innerHeight && save.top >= 0 };
        });
        if (!fit.saveOk || fit.bottom > fit.vh + 1 || fit.top < 0) report.push({ where: `${tag} form ${name}`, type: 'modal-fit', detail: JSON.stringify(fit) });
        add(`${tag} form ${name}`, await p.evaluate(measure, { scope: 'div[role="dialog"]', deviceWidth: vp.viewport.width, lang }));
        await p.screenshot({ path: `${OUT}/${tag}-form-${t}-${String(name).replace(/\W+/g, '')}.png` });
        await p.keyboard.press('Escape');
        await p.waitForSelector('div[role="dialog"]', { state: 'detached' });
      }
      // edit form (cadangan) + delete confirm
      await go('cadangan');
      await p.locator(`button[aria-label="${LABELS[lang].edit}"]`).first().click();
      add(`${tag} form Edit Cadangan`, await p.evaluate(measure, { scope: 'div[role="dialog"]', deviceWidth: vp.viewport.width, lang }));
      await p.screenshot({ path: `${OUT}/${tag}-form-cadangan-edit.png` });
      await p.keyboard.press('Escape');
      await p.locator(`button[aria-label="${LABELS[lang].del}"]`).first().click();
      add(`${tag} confirm-delete`, await p.evaluate(measure, { scope: 'div[role="dialog"]', deviceWidth: vp.viewport.width, lang }));
      await p.screenshot({ path: `${OUT}/${tag}-modal-confirm.png` });
      await p.keyboard.press('Escape');
      await ctx.close();
    }
  } finally {
    await browser.close(); gas.close(); app.close();
  }

  // Summarise
  const byType = {};
  for (const r of report) (byType[r.type] ||= new Map()).set(`${r.detail}`, (byType[r.type].get(r.detail) || []).concat(r.where));
  for (const [type, m] of Object.entries(byType)) {
    console.log(`\n== ${type} (${m.size} unique)`);
    for (const [detail, where] of m) console.log(`  ${detail}   [${where.length}x, e.g. ${where[0]}]`);
  }
  console.log(`\nTOTAL issues: ${report.length} | console errors: ${errors.length}`);
  if (errors.length) console.log(errors.join('\n'));
  console.log(`screenshots: ${OUT}`);
  if (STRICT && (report.length || errors.length)) process.exit(1);
})().catch((e) => { console.error('✗', e); process.exit(1); });
