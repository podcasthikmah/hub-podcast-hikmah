/**
 * API contract tests for google-apps-script/Code.gs (via tests/gas-emulator.cjs).
 *   node tests/gas-api.test.cjs
 */
const assert = require('node:assert/strict');
const { startServer } = require('./gas-emulator.cjs');

const PORT = 8799;
const URL_ = `http://localhost:${PORT}/exec`;
const PIN = '246810';

const get = async () => (await fetch(`${URL_}?action=getAll`)).json();
const post = async (body) =>
  (await fetch(URL_, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) })).json();
const ok = (r) => { assert.equal(r.ok, true, `expected ok, got: ${r.error}`); return r.data; };
const err = (r, re) => { assert.equal(r.ok, false, 'expected an error'); assert.match(r.error, re); };

let passed = 0;
const test = async (name, fn) => { await fn(); passed++; console.log('  ✓', name); };

(async () => {
  const { server, rt } = await startServer(PORT);
  try {
    await test('getAll returns all 7 sheets, no hidden columns', async () => {
      const d = ok(await get());
      assert.deepEqual(Object.keys(d).sort(), ['CADANGAN', 'KITAB', 'PANDUAN', 'PANEL', 'PERINGATAN', 'UPCOMING', 'YOUTUBE']);
      // seedSampleData() on main leaves `hari` blank; the client derives it from `tarikh` (hariOf).
      assert.ok(d.UPCOMING.length >= 1, 'seed row present');
      assert.equal(typeof d.KITAB[0].bilangan, 'number');
      assert.equal(typeof d.UPCOMING[0].order, 'number');
    });

    await test('preflight (OPTIONS) is rejected like real Apps Script', async () => {
      const r = await fetch(URL_, { method: 'OPTIONS' });
      assert.equal(r.status, 405);
    });

    await test('verifyPin: right PIN ok, wrong PIN rejected', async () => {
      ok(await post({ action: 'verifyPin', pin: PIN }));
      err(await post({ action: 'verifyPin', pin: '000000' }), /PIN salah/);
      rt.cache.clear();
    });

    await test('public cannot write admin sheets', async () => {
      for (const sheet of ['UPCOMING', 'PANEL', 'PANDUAN', 'PERINGATAN', 'KITAB', 'YOUTUBE']) {
        err(await post({ action: 'create', sheet, item: { tajuk: 'x' } }), /admin/);
      }
      const id = ok(await get()).KITAB[0].id;
      err(await post({ action: 'increment', sheet: 'KITAB', id, delta: 1 }), /admin/);
      err(await post({ action: 'delete', sheet: 'KITAB', id }), /admin/);
      err(await post({ action: 'reorder', sheet: 'UPCOMING', ids: [] }), /admin/);
    });

    let cad;
    await test('public creates CADANGAN; server forces status/reply, hides owner_hash', async () => {
      cad = ok(await post({
        action: 'create', sheet: 'CADANGAN', ownerKey: 'k-owner-1',
        item: { tarikh: '2026-11-18', catatan: '  Cadangan ujian  ', status: 'SELESAI', balasan_admin: 'hack' },
      }));
      assert.equal(cad.status, 'BELUM');
      assert.equal(cad.balasan_admin, '');
      assert.equal(cad.catatan, 'Cadangan ujian');
      assert.equal(cad.owner_hash, undefined);
      const row = ok(await get()).CADANGAN.find((r) => r.id === cad.id);
      assert.ok(row && row.owner_hash === undefined);
    });

    await test('public edit: owner ok (only tarikh/catatan), stranger rejected', async () => {
      const u = ok(await post({ action: 'update', sheet: 'CADANGAN', id: cad.id, ownerKey: 'k-owner-1', patch: { catatan: 'Disunting', status: 'SELESAI', balasan_admin: 'x' } }));
      assert.equal(u.catatan, 'Disunting');
      assert.equal(u.status, 'BELUM');
      assert.equal(u.balasan_admin, '');
      err(await post({ action: 'update', sheet: 'CADANGAN', id: cad.id, ownerKey: 'k-other', patch: { catatan: 'x' } }), /sendiri/);
      err(await post({ action: 'update', sheet: 'CADANGAN', id: cad.id, patch: { catatan: 'x' } }), /sendiri/);
    });

    await test('admin marks Done + replies; owner is then locked out', async () => {
      const u = ok(await post({ action: 'update', sheet: 'CADANGAN', id: cad.id, pin: PIN, patch: { status: 'SELESAI', balasan_admin: 'Terima kasih' } }));
      assert.equal(u.status, 'SELESAI');
      assert.equal(u.balasan_admin, 'Terima kasih');
      err(await post({ action: 'update', sheet: 'CADANGAN', id: cad.id, ownerKey: 'k-owner-1', patch: { catatan: 'x' } }), /dikunci/);
      const back = ok(await post({ action: 'update', sheet: 'CADANGAN', id: cad.id, pin: PIN, patch: { status: 'whatever' } }));
      assert.equal(back.status, 'BELUM', 'invalid status normalised');
    });

    await test('CADANGAN validation: empty / too long', async () => {
      err(await post({ action: 'create', sheet: 'CADANGAN', item: { catatan: '   ' } }), /diperlukan/);
      err(await post({ action: 'create', sheet: 'CADANGAN', item: { catatan: 'a'.repeat(1001) } }), /panjang/);
    });

    await test('formula injection is neutralised', async () => {
      const r = ok(await post({ action: 'create', sheet: 'CADANGAN', item: { catatan: '=IMPORTXML("http://x")' } }));
      const sheet = rt.sheets.get('CADANGAN');
      const raw = sheet.data.find((row) => row[0] === r.id);
      // emulator consumes the apostrophe exactly like Sheets; the cell holds literal text
      assert.equal(raw[2], '=IMPORTXML("http://x")');
      assert.equal(r.catatan, '=IMPORTXML("http://x")');
    });

    let up;
    await test('admin CRUD + auto order on UPCOMING', async () => {
      const before = ok(await get()).UPCOMING;
      up = ok(await post({ action: 'create', sheet: 'UPCOMING', pin: PIN, item: { tarikh: '2026-12-03', hari: 'Khamis', tajuk: 'Ujian', panel: 'A & B' } }));
      assert.equal(up.order, Math.max(...before.map((r) => r.order)) + 1);
      const e = ok(await post({ action: 'update', sheet: 'UPCOMING', id: up.id, pin: PIN, patch: { tajuk: 'Ujian 2', id: 'hijack' } }));
      assert.equal(e.tajuk, 'Ujian 2');
      assert.equal(e.id, up.id, 'id cannot be changed');
    });

    await test('reorder rewrites order 1..n', async () => {
      const rows = ok(await get()).UPCOMING;
      const ids = rows.map((r) => r.id).reverse();
      ok(await post({ action: 'reorder', sheet: 'UPCOMING', pin: PIN, ids }));
      const after = ok(await get()).UPCOMING;
      ids.forEach((id, i) => assert.equal(after.find((r) => r.id === id).order, i + 1));
      err(await post({ action: 'reorder', sheet: 'KITAB', pin: PIN, ids: [] }), /order/);
    });

    await test('KITAB increment is atomic-ish & clamps at 0', async () => {
      const k = ok(await post({ action: 'create', sheet: 'KITAB', pin: PIN, item: { nama_kitab: 'Uji', bilangan: '2' } }));
      assert.equal(k.bilangan, 2);
      await Promise.all([1, 1, 1].map((d) => post({ action: 'increment', sheet: 'KITAB', id: k.id, pin: PIN, delta: d })));
      assert.equal(ok(await get()).KITAB.find((r) => r.id === k.id).bilangan, 5);
      const z = ok(await post({ action: 'increment', sheet: 'KITAB', id: k.id, pin: PIN, delta: -99 }));
      assert.equal(z.bilangan, 0);
      err(await post({ action: 'increment', sheet: 'PANEL', id: k.id, pin: PIN, delta: 1 }), /KITAB/);
    });

    await test('delete + missing record + bad sheet/action', async () => {
      ok(await post({ action: 'delete', sheet: 'UPCOMING', id: up.id, pin: PIN }));
      assert.ok(!ok(await get()).UPCOMING.some((r) => r.id === up.id));
      err(await post({ action: 'delete', sheet: 'UPCOMING', id: up.id, pin: PIN }), /tidak dijumpai/);
      err(await post({ action: 'create', sheet: 'NOPE', pin: PIN, item: {} }), /Sheet tidak sah/);
      err(await post({ action: 'explode', sheet: 'PANEL', pin: PIN }), /tidak dikenali/);
      const bad = await (await fetch(URL_, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: '{not json' })).json();
      assert.equal(bad.ok, false);
    });

    await test('Date & time cells typed manually into the Sheet are normalised', async () => {
      // Dates must come from the script's own realm (as real Sheets values do) for instanceof Date.
      const D = (...a) => require('node:vm').runInContext(`new Date(${a.join(',')})`, rt.gs);
      const sh = rt.sheets.get('PANEL');
      sh.data.push(['manual1', 'Tajuk manual', 'Panel manual', D(2026, 11, 25)]);
      const u = rt.sheets.get('UPCOMING');
      u.data.push(['manual2', 9, '', D(2026, 11, 26), D(1899, 11, 30, 21, 0), 'T', 'P']);
      u.data.push(['', '', '', '', '', '', '']); // blank row is skipped
      const d = ok(await get());
      assert.equal(d.PANEL.find((r) => r.id === 'manual1').tarikh, '2026-12-25');
      const m = d.UPCOMING.find((r) => r.id === 'manual2');
      assert.equal(m.tarikh, '2026-12-26');
      // a time typed into a non-text cell is a 1899-12-30 Date in Sheets -> must read back as HH:mm
      assert.equal(m.masa, '21:00');
    });

    await test('PANEL.tarikh: ISO date and "Belum Ditentukan" round-trip unchanged', async () => {
      const a = ok(await post({ action: 'create', sheet: 'PANEL', pin: PIN, item: { tajuk: 'Sync A', nama_panel: 'Ustaz A', tarikh: '2026-12-03' } }));
      const b = ok(await post({ action: 'create', sheet: 'PANEL', pin: PIN, item: { tajuk: 'Sync B', nama_panel: 'Ustaz B', tarikh: 'Belum Ditentukan' } }));
      let d = ok(await get()).PANEL;
      assert.equal(d.find((r) => r.id === a.id).tarikh, '2026-12-03');
      assert.equal(d.find((r) => r.id === b.id).tarikh, 'Belum Ditentukan');
      // date -> TBD and TBD -> date via update
      ok(await post({ action: 'update', sheet: 'PANEL', id: a.id, pin: PIN, patch: { tarikh: 'Belum Ditentukan' } }));
      ok(await post({ action: 'update', sheet: 'PANEL', id: b.id, pin: PIN, patch: { tarikh: '2027-01-15' } }));
      d = ok(await get()).PANEL;
      assert.equal(d.find((r) => r.id === a.id).tarikh, 'Belum Ditentukan');
      assert.equal(d.find((r) => r.id === b.id).tarikh, '2027-01-15');
      // unknown UI-only fields (e.g. `tbd`) are never written as columns
      ok(await post({ action: 'create', sheet: 'PANEL', pin: PIN, item: { tajuk: 'X', nama_panel: 'Y', tarikh: '2026-12-09', tbd: false } }));
      assert.ok(!rt.sheets.get('PANEL').data[0].includes('tbd'));
    });

    await test('PANEL.masa: time round-trips; a manually typed time cell reads back as HH:mm', async () => {
      const r = ok(await post({ action: 'create', sheet: 'PANEL', pin: PIN, item: { tajuk: 'Masa', nama_panel: 'Ustaz M', tarikh: '2026-12-05', masa: '20:30' } }));
      assert.equal(ok(await get()).PANEL.find((x) => x.id === r.id).masa, '20:30');
      ok(await post({ action: 'update', sheet: 'PANEL', id: r.id, pin: PIN, patch: { masa: '09:15' } }));
      assert.equal(ok(await get()).PANEL.find((x) => x.id === r.id).masa, '09:15');
      const D = (...a) => require('node:vm').runInContext(`new Date(${a.join(',')})`, rt.gs);
      const sh = rt.sheets.get('PANEL');
      const col = sh.data[0].indexOf('masa');
      sh.data.find((row) => row[0] === r.id)[col] = D(1899, 11, 30, 21, 0); // Sheets' time-only value
      assert.equal(ok(await get()).PANEL.find((x) => x.id === r.id).masa, '21:00');
    });

    await test('self-healing headers: an existing PANEL tab without "masa" gets the column, times persist', async () => {
      const sh = rt.sheets.get('PANEL');
      const col = sh.data[0].indexOf('masa');
      sh.data.forEach((row) => row.splice(col, 1)); // the live Sheet before this change
      ok(await get());
      assert.equal(sh.data[0].filter((h) => h === 'masa').length, 1);
      const r = ok(await post({ action: 'create', sheet: 'PANEL', pin: PIN, item: { tajuk: 'Heal M', nama_panel: 'Ustaz HM', tarikh: '2026-12-06', masa: '21:00' } }));
      assert.equal(ok(await get()).PANEL.find((x) => x.id === r.id).masa, '21:00');
    });

    await test('self-healing headers: PANEL tab missing "tarikh" gets it back and dates persist', async () => {
      const sh = rt.sheets.get('PANEL');
      const col = sh.data[0].indexOf('tarikh');
      sh.data.forEach((row) => row.splice(col, 1)); // simulate a hand-made tab without tarikh
      assert.ok(!sh.data[0].includes('tarikh'));
      ok(await get()); // a plain read heals the header row
      assert.equal(sh.data[0].filter((h) => h === 'tarikh').length, 1, 'tarikh appended exactly once');
      ok(await get());
      assert.equal(sh.data[0].filter((h) => h === 'tarikh').length, 1, 'idempotent');
      const c = ok(await post({ action: 'create', sheet: 'PANEL', pin: PIN, item: { tajuk: 'Heal', nama_panel: 'Ustaz H', tarikh: '2026-12-24' } }));
      assert.equal(ok(await get()).PANEL.find((r) => r.id === c.id).tarikh, '2026-12-24');
      // healing also works when the very first request is a write
      const sh2 = rt.sheets.get('KITAB');
      const bc = sh2.data[0].indexOf('bilangan');
      sh2.data.forEach((row) => row.splice(bc, 1));
      const k = ok(await post({ action: 'create', sheet: 'KITAB', pin: PIN, item: { nama_kitab: 'Heal K', bilangan: 3 } }));
      assert.equal(k.bilangan, 3);
      assert.equal(ok(await get()).KITAB.find((r) => r.id === k.id).bilangan, 3);
    });

    // ------------------------------ auto-translation BM -> AR ------------------------------
    const AR = (t) => `ترجمة: ${t}`;
    const LA = () => rt.gs.LanguageApp;
    const cell = (sheet, id, col) => { const sh = rt.sheets.get(sheet); const i = sh.data[0].indexOf(col); return sh.data.find((r) => r[0] === id)[i]; };

    await test('translate: every source field in all 6 content tabs gets an _ar value on create', async () => {
      const cases = {
        PANEL: { tajuk: 'Adab Ilmu', nama_panel: 'Ustaz Ali', tarikh: '2026-12-10', masa: '21:00' },
        PANDUAN: { kategori: 'PANEL', tajuk: 'Panduan Baharu', keterangan: 'Baca sebelum rakaman', gdrive_url: 'https://drive.google.com/file/d/1AbCdEfGhIjK/view' },
        PERINGATAN: { petikan: 'Niat kerana Allah', arab: 'إِنَّمَا الأَعْمَالُ', konteks: 'Taklimat Panel' },
        KITAB: { nama_kitab: 'Riyadhus Solihin', bilangan: 0 },
        YOUTUBE: { tajuk: 'EP20 Sabar', youtube_url: 'https://youtu.be/dQw4w9WgXcQ' },
        CADANGAN: { catatan: 'Tambah sari kata', balasan_admin: 'Baik, terima kasih' },
      };
      for (const [sheet, item] of Object.entries(cases)) {
        const r = ok(await post({ action: 'create', sheet, pin: PIN, item }));
        const fields = { PANEL: ['tajuk', 'nama_panel'], PANDUAN: ['tajuk', 'keterangan'], PERINGATAN: ['petikan', 'konteks'], KITAB: ['nama_kitab'], YOUTUBE: ['tajuk'], CADANGAN: ['catatan', 'balasan_admin'] }[sheet];
        const live = ok(await get())[sheet].find((x) => x.id === r.id);
        for (const f of fields) {
          assert.equal(r[`${f}_ar`], AR(item[f]), `${sheet}.${f}_ar in response`);
          assert.equal(live[`${f}_ar`], AR(item[f]), `${sheet}.${f}_ar via getAll`);
          assert.equal(live[f], item[f], `${sheet}.${f} source unchanged`);
        }
        if (sheet === 'PERINGATAN') assert.equal(live.arab_ar, undefined, 'arab is not translated');
      }
    });

    await test('translate: public suggestion + admin reply are translated; public cannot write _ar', async () => {
      const r = ok(await post({ action: 'create', sheet: 'CADANGAN', ownerKey: 'k-tr', item: { catatan: 'Cadangan awam', catatan_ar: 'HACK' } }));
      assert.equal(r.catatan_ar, AR('Cadangan awam'));
      const u = ok(await post({ action: 'update', sheet: 'CADANGAN', id: r.id, ownerKey: 'k-tr', patch: { catatan: 'Cadangan awam v2', catatan_ar: 'HACK' } }));
      assert.equal(u.catatan_ar, AR('Cadangan awam v2'));
      const u2 = ok(await post({ action: 'update', sheet: 'CADANGAN', id: r.id, ownerKey: 'k-tr', patch: { catatan_ar: 'HACK' } }));
      assert.equal(u2.catatan_ar, AR('Cadangan awam v2'), 'public _ar write ignored');
      const a = ok(await post({ action: 'update', sheet: 'CADANGAN', id: r.id, pin: PIN, patch: { balasan_admin: 'Akan dilaksanakan' } }));
      assert.equal(a.balasan_admin_ar, AR('Akan dilaksanakan'));
    });

    await test('translate: Arabic / URL / numbers copied, empty stays empty, no translator call', async () => {
      const before = LA().calls;
      const r = ok(await post({ action: 'create', sheet: 'PANDUAN', pin: PIN, item: { kategori: 'PANEL', tajuk: 'دليل الضيوف', keterangan: '', gdrive_url: 'https://x.y/z' } }));
      assert.equal(r.tajuk_ar, 'دليل الضيوف');
      assert.equal(r.keterangan_ar, '');
      const y = ok(await post({ action: 'create', sheet: 'YOUTUBE', pin: PIN, item: { tajuk: '2026 · 12', youtube_url: 'https://youtu.be/dQw4w9WgXcQ' } }));
      assert.equal(y.tajuk_ar, '2026 · 12');
      const k = ok(await post({ action: 'create', sheet: 'KITAB', pin: PIN, item: { nama_kitab: 'https://kitab.example/x' } }));
      assert.equal(k.nama_kitab_ar, 'https://kitab.example/x');
      assert.equal(LA().calls, before, 'no LanguageApp calls');
    });

    let tr;
    await test('translate: failure leaves _ar blank (app falls back to BM) and the row still saves', async () => {
      tr = ok(await post({ action: 'create', sheet: 'PANEL', pin: PIN, item: { tajuk: 'Topik GAGAL_TERJEMAH', nama_panel: 'Ustaz Fail', tarikh: '2026-12-11' } }));
      assert.equal(tr.tajuk_ar, '');
      assert.equal(tr.nama_panel_ar, AR('Ustaz Fail'));
      assert.ok(ok(await get()).PANEL.find((x) => x.id === tr.id));
    });

    await test('translate: unchanged source = no re-translation; admin correction kept; source change re-translates', async () => {
      const r = ok(await post({ action: 'create', sheet: 'KITAB', pin: PIN, item: { nama_kitab: 'Al-Hikam' } }));
      let calls = LA().calls;
      // the edit form sends the whole row back unchanged (including the old _ar)
      ok(await post({ action: 'update', sheet: 'KITAB', id: r.id, pin: PIN, patch: { nama_kitab: 'Al-Hikam', nama_kitab_ar: AR('Al-Hikam'), bilangan: 2 } }));
      assert.equal(LA().calls, calls, 'no translate call when source unchanged');
      // admin corrects the Arabic (e.g. in the Sheet or via API)
      ok(await post({ action: 'update', sheet: 'KITAB', id: r.id, pin: PIN, patch: { nama_kitab_ar: 'الحِكَم العطائية' } }));
      ok(await post({ action: 'update', sheet: 'KITAB', id: r.id, pin: PIN, patch: { nama_kitab: 'Al-Hikam', bilangan: 3 } }));
      assert.equal(cell('KITAB', r.id, 'nama_kitab_ar'), 'الحِكَم العطائية', 'correction survives unrelated edits');
      // Malay source changes -> fresh translation wins over the stale client value
      const u = ok(await post({ action: 'update', sheet: 'KITAB', id: r.id, pin: PIN, patch: { nama_kitab: 'Al-Hikam Syarah', nama_kitab_ar: 'الحِكَم العطائية' } }));
      assert.equal(u.nama_kitab_ar, AR('Al-Hikam Syarah'));
    });

    await test('CADANGAN admin reply: saved reply gets balasan_admin_ar; backfill fixes missing/untranslated replies', async () => {
      const c = ok(await post({ action: 'create', sheet: 'CADANGAN', item: { catatan: 'Suara panel kurang jelas' } }));
      const u = ok(await post({ action: 'update', sheet: 'CADANGAN', id: c.id, pin: PIN, patch: { balasan_admin: 'Baik kami ambil maklum', status: 'SELESAI' } }));
      assert.equal(u.balasan_admin_ar, AR('Baik kami ambil maklum'));
      assert.equal(cell('CADANGAN', c.id, 'balasan_admin_ar'), AR('Baik kami ambil maklum'));
      // reply typed into the Sheet / copied Malay in _ar -> translateAllExistingRows() repairs it
      const sh = rt.sheets.get('CADANGAN'); const h = sh.data[0];
      const row = sh.data.find((r) => r[0] === c.id);
      row[h.indexOf('balasan_admin')] = 'Terima kasih banyak';
      row[h.indexOf('balasan_admin_ar')] = 'Terima kasih banyak';
      rt.gs.translateAllExistingRows();
      assert.equal(cell('CADANGAN', c.id, 'balasan_admin_ar'), AR('Terima kasih banyak'));
    });

    await test('translateAllExistingRows(): fills only missing _ar cells, retries failures, idempotent', async () => {
      const sh = rt.sheets.get('PANEL');
      const iT = sh.data[0].indexOf('tajuk_ar');
      // simulate pre-existing rows from before this feature: blank their _ar cells
      const blanks = sh.data.slice(1).filter((r) => r[0] && r[0] !== tr.id).slice(0, 3);
      blanks.forEach((r) => { r[iT] = ''; });
      // the earlier failed row: fix its source so the retry can succeed
      sh.data.find((r) => r[0] === tr.id)[sh.data[0].indexOf('tajuk')] = 'Topik Dibetulkan';
      const res = rt.gs.translateAllExistingRows();
      assert.ok(res.translated >= blanks.length + 1, JSON.stringify(res));
      for (const r of blanks) assert.equal(r[iT], AR(r[sh.data[0].indexOf('tajuk')]));
      assert.equal(cell('PANEL', tr.id, 'tajuk_ar'), AR('Topik Dibetulkan'));
      const again = rt.gs.translateAllExistingRows();
      assert.equal(again.translated, 0, 'second run has nothing to do');
    });

    await test('translate: a tab without _ar columns gets them automatically, then fills them', async () => {
      const sh = rt.sheets.get('YOUTUBE');
      const i = sh.data[0].indexOf('tajuk_ar');
      sh.data.forEach((r) => r.splice(i, 1)); // the live Sheet before this feature
      ok(await get());
      assert.ok(sh.data[0].includes('tajuk_ar'));
      const res = rt.gs.translateAllExistingRows();
      assert.ok(res.translated >= 1);
      assert.ok(ok(await get()).YOUTUBE.every((r) => !/[A-Za-z]/.test(r.tajuk) || r.tajuk_ar));
    });

    await test('PIN brute-force guard locks after 10 failures', async () => {
      rt.cache.clear();
      for (let i = 0; i < 10; i++) err(await post({ action: 'verifyPin', pin: 'x' + i }), /PIN salah/);
      err(await post({ action: 'verifyPin', pin: PIN }), /Terlalu banyak/);
      rt.cache.clear();
    });

    await test('global anti-spam ceiling on public CADANGAN', async () => {
      rt.cache.clear();
      let blocked = 0;
      for (let i = 0; i < 32; i++) {
        const r = await post({ action: 'create', sheet: 'CADANGAN', item: { catatan: 'spam ' + i } });
        if (!r.ok) blocked++;
      }
      assert.equal(blocked, 2);
      rt.cache.clear();
    });

    console.log(`\n${passed} API tests passed`);
  } finally {
    server.close();
  }
})().catch((e) => { console.error('\n✗', e.message); process.exit(1); });
