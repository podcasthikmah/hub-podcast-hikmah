# HUB PODCAST HIKMAH 🎙️

Progressive Web App yang mobile-first dan berfungsi sebagai pusat maklumat untuk penganjur, moderator dan panel Podcast Hikmah. Hantar satu pautan kepada panel baharu dan mereka boleh baca semuanya sendiri, jadi penerangan yang sama tak perlu diulang dalam group WhatsApp.

**Stack:** React 18 · Vite 5 · Tailwind CSS 3 · Google Sheets + Apps Script (backend percuma) · GitHub Pages
**Reka bentuk:** *Islamic Modern* ([`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md)) dengan Mod Cerah & Gelap

## Ciri utama

| Seksyen | Ringkasan |
|---|---|
| **Hero Spotlight** | Podcast terdekat, kiraan hari dan pintasan ke Panduan Panel |
| **Upcoming Podcast** | Dijana automatik daripada List Panel yang bertarikh (tarikh paling dekat dahulu; panel dengan tajuk & tarikh sama digabungkan). Butang **Salin Info WA** untuk Admin sahaja |
| **List Panel** | **Sumber utama jadual.** Tajuk, Nama Panel dan Tarikh (dengan Hari automatik) atau *Belum Ditentukan*. Carian dan tapisan Akan datang / Lepas |
| **Panduan Panel** | Kad muat turun PDF dari Google Drive |
| **Peringatan Syeikhuna** | Kad petikan berbentuk *speech bubble* dengan sokongan teks Arab (Amiri) |
| **Promosi Kitab** | Penjejak kekerapan promosi dengan butang +/− yang segerak ke Sheets, serta kad skrip promosi |
| **Episode Podcast YT** | Galeri yang mengekstrak ID video secara automatik (watch, youtu.be, shorts, live, embed), dengan pilihan thumbnail tersuai |
| **Cadangan** | Orang awam boleh hantar dan edit cadangan sendiri. Admin boleh tandakan *Done* (cadangan itu terus dikunci) dan beri maklum balas. Tapisan status tersedia |

Ciri lain:
- **Dwibahasa BM / العربية:** butang `BM | عربي` di header (pilihan disimpan). Mod Arab menukar seluruh susun atur ke kanan-ke-kiri (RTL), menggunakan fon Tajawal, nama hari & bulan dalam bahasa Arab, dan menterjemah semua teks UI. Kandungan daripada Google Sheets diterjemah secara automatik ke bahasa Arab oleh `Code.gs` (lajur `*_ar`, boleh dibetulkan terus dalam Sheet) dan kembali ke teks BM asal jika terjemahan kosong. Mesej *Salin Info WA* mengikut bahasa yang dipilih.
- **Stale-while-revalidate:** data terakhir dipaparkan serta-merta dari `localStorage`, kemudian disegerak di latar belakang dengan penunjuk segerak.
- **PWA:** `manifest.json`, service worker, ikon *maskable* dan *Add to Home Screen*.
- **Mod Admin tersembunyi:** ketik © di footer 5× (atau ikon 🔒), kemudian masukkan PIN yang disahkan oleh server.
- **Anti-spam:** *honeypot*, *cooldown* 30 saat, had panjang teks, had kadar global di server, perlindungan *formula injection*, dan pemilikan cadangan disahkan dengan hash SHA-256.
- **Mod Demo:** berfungsi terus tanpa backend (data contoh BM dalam `localStorage`).

## Mula cepat

```bash
npm install
npm run dev        # http://localhost:5173 — Mod Demo, PIN admin: 1234
npm run build      # output ke dist/
```

## Ujian

```bash
npm run test:api   # 16 ujian kontrak API: Code.gs sebenar dijalankan dalam emulator Apps Script tempatan
npm run test:e2e   # 28 semakan Playwright: app (mod live) ↔ emulator, semua 7 seksyen, awam + admin, mudah alih, 0 ralat konsol
```

`tests/gas-emulator.cjs` menjalankan `Code.gs` yang sebenar (bukan salinan) dengan tiruan `SpreadsheetApp`, `CacheService` dan servis lain. Ia juga menolak preflight `OPTIONS` sama seperti Apps Script, jadi sebarang regresi CORS akan dikesan. Ujian E2E memerlukan Playwright + Chromium.

## Sambung ke Google Sheets

Lihat **[SETUP.md](SETUP.md)** untuk panduan langkah demi langkah: cipta 7 tab, deploy `Code.gs`, dan tampal URL ke `src/config.js`.

## Struktur

```
├── DESIGN_SYSTEM.md            # token warna, tipografi, peraturan UI
├── SETUP.md                    # panduan backend & deploy
├── google-apps-script/Code.gs  # API Web App (salin ke Apps Script)
├── public/                     # manifest.json, sw.js, icons/
├── scripts/generate-icons.mjs  # render ikon SVG → PNG (npm run icons)
└── src/
    ├── config.js               # ← tampal GAS_URL di sini
    ├── lib/                    # api (live+mock), store (SWR), schema, seed, utils
    ├── components/             # Header, Hero, Footer, UI primitives, corak geometri
    └── sections/               # 7 seksyen
```
