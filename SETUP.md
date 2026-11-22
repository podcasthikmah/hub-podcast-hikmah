# SETUP — Sambung Hub Podcast Hikmah ke Google Sheets

Masa diperlukan: lebih kurang 10 minit. Tak perlu server dan tak ada kos.

```
Browser (GitHub Pages)  ──GET ?action=getAll──▶  Google Apps Script Web App  ──▶  Google Sheet (7 tab)
                        ◀──── JSON ───────────
                        ──POST text/plain JSON──▶ (create / update / delete / reorder / increment)
```

---

## Langkah 1 — Cipta Google Sheet

1. Buka <https://sheets.new> dan namakan fail itu, contohnya **HUB PODCAST HIKMAH – DB**.
2. Klik **Extensions → Apps Script**.
3. Padam semua kod lalai dalam `Code.gs`, kemudian **tampal keseluruhan kandungan** fail [`google-apps-script/Code.gs`](google-apps-script/Code.gs). Tekan **Save** (💾).
4. Pada dropdown fungsi di toolbar, pilih **`setupSheets`** dan tekan **Run**.
   - Kali pertama, Google akan minta kebenaran: **Review permissions → pilih akaun → Advanced → Go to (unsafe) → Allow**. Ini normal kerana skrip ini milik anda sendiri.
   - Ketujuh-tujuh tab akan dicipta secara automatik bersama header yang tepat.

### Tab & header (jika mahu cipta secara manual)

Nama tab mesti **HURUF BESAR** dan sama seperti di bawah. Baris 1 ialah header.

| Tab | Header lajur (A → …) |
|---|---|
| `UPCOMING` | `id` · `order` · `hari` · `tarikh` · `masa` · `tajuk` · `panel` *(lama — tidak digunakan lagi, boleh dibiarkan)* |
| `PANEL` | `id` · `tajuk` · `nama_panel` · `tarikh` · `masa` |
| `PANDUAN` | `id` · `order` · `kategori` · `tajuk` · `keterangan` · `gdrive_url` |
| `PERINGATAN` | `id` · `order` · `petikan` · `arab` · `konteks` |
| `KITAB` | `id` · `nama_kitab` · `bilangan` |
| `YOUTUBE` | `id` · `order` · `tajuk` · `youtube_url` · `custom_thumbnail` · `tarikh` |
| `CADANGAN` | `id` · `tarikh` · `catatan` · `status` · `balasan_admin` · `created_at` · `owner_hash` |

Nota:
- `tarikh` dalam format **`YYYY-MM-DD`** (contoh `2026-12-04`). `setupSheets` sudah tetapkan lajur sebagai *Plain text* supaya Sheets tidak tukar format tarikh.
- **`PANEL` ialah sumber utama jadual.** Upcoming Podcast dan banner Hero dijana secara automatik daripada baris `PANEL` yang bertarikh (hari ini dan ke hadapan, tarikh paling dekat dahulu). Satu baris bagi setiap panel; baris dengan `tajuk` dan `tarikh` yang sama digabungkan menjadi satu slot. `PANEL.tarikh` ialah `YYYY-MM-DD` atau teks `Belum Ditentukan` (tidak dipaparkan di Upcoming). Hari (Isnin, Selasa, …) dikira daripada tarikh dan tidak perlu disimpan. `PANEL.masa` ialah waktu shooting dalam format 24 jam `HH:mm` (cth. `21:00`), pilihan; dipaparkan sebagai "9:00 malam".
- `Code.gs` menambah lajur yang hilang secara automatik (cth. `tarikh` pada tab `PANEL` yang dicipta secara manual), jadi tarikh tidak akan tercicir.
- **Terjemahan Arab automatik:** `Code.gs` menambah lajur `*_ar` (cth. `tajuk_ar`, `nama_panel_ar`, `keterangan_ar`, `petikan_ar`, `konteks_ar`, `nama_kitab_ar`, `catatan_ar`, `balasan_admin_ar`) dan mengisinya dengan `LanguageApp.translate` setiap kali rekod ditambah/diubah. Untuk data sedia ada, jalankan **`translateAllExistingRows`** sekali dari editor (jalankan semula jika log menyatakan masih ada baki). Terjemahan boleh dibetulkan terus dalam lajur `*_ar` — ia kekal sehingga teks BM asal diubah. Jika lajur `*_ar` kosong, app memaparkan teks BM asal.
- `PANDUAN.kategori` ada dua nilai: `PANEL` untuk dokumen di seksyen Panduan Panel, dan `SKRIP_PROMOSI` untuk kad skrip di seksyen Promosi Kitab.
- `CADANGAN.status` ialah `BELUM` atau `SELESAI`.
- `CADANGAN.owner_hash` disembunyikan. Ia menyimpan hash SHA-256 kunci pemilik supaya hanya pengirim asal (dari pelayar yang sama) boleh mengedit cadangannya. Jangan edit lajur ini.
- `id` dijana oleh sistem. Jika anda tambah baris terus dalam Sheet, isi `id` dengan apa-apa teks unik (cth. `m1`, `m2`). Baris tanpa `id` tidak akan dipaparkan.
- *(Pilihan)* Jalankan `seedSampleData` untuk masukkan beberapa baris contoh.

---

## Langkah 2 — Tetapkan PIN Admin

1. Dalam Apps Script, klik ⚙️ **Project Settings**.
2. Di bahagian **Script Properties**, klik **Add script property**:
   - Property: `ADMIN_PIN`
   - Value: PIN pilihan anda (cth. `786512`). Guna sekurang-kurangnya 6 digit.
3. **Save script properties**.

PIN ini tidak berada dalam kod frontend dan disemak di server. Selepas 10 cubaan salah, akses dikunci selama 10 minit.

---

## Langkah 3 — Deploy sebagai Web App

1. Klik **Deploy → New deployment**.
2. Klik ⚙️ di sebelah *Select type* dan pilih **Web app**.
3. Tetapkan:
   - **Description:** `Hub API v1`
   - **Execute as:** **Me** (akaun anda)
   - **Who has access:** **Anyone**
4. Klik **Deploy**, kemudian salin **Web app URL**. Ia berakhir dengan `/exec`, contohnya:
   `https://script.google.com/macros/s/AKfycbx.../exec`
5. Uji: buka `URL?action=getAll` dalam pelayar. Anda patut nampak `{"ok":true,"data":{...}}`.

> ⚠️ **Setiap kali anda ubah `Code.gs`**, pergi ke **Deploy → Manage deployments → ✏️ Edit → Version: New version → Deploy**. Dengan cara ini URL kekal sama. Kalau anda buat *New deployment*, URL akan berubah.

### Kenapa CORS berfungsi?
- **GET** daripada Apps Script membalas dengan `Access-Control-Allow-Origin: *` selepas redirect ke `googleusercontent.com`.
- **POST** dihantar dengan `Content-Type: text/plain`. Ini *simple request*, jadi pelayar tidak menghantar preflight `OPTIONS` (Apps Script tidak menyokong `OPTIONS`). `Code.gs` membaca JSON daripada `e.postData.contents`.

---

## Langkah 4 — Tampal URL ke dalam app

Edit [`src/config.js`](src/config.js):

```js
export const CONFIG = {
  GAS_URL: 'https://script.google.com/macros/s/AKfycbx.../exec', // ← tampal di sini
  HUB_URL: 'https://<username>.github.io/hub-podcast-hikmah/',    // pautan dalam mesej WA
  ...
};
```

Commit dan push. GitHub Actions akan build dan deploy semula secara automatik.

Selagi `GAS_URL` kosong, app berjalan dalam **Mod Demo**. Data contoh disimpan dalam `localStorage` pelayar sahaja, dan PIN demo ialah `1234`.

---

## Langkah 5 — Hos di GitHub Pages

1. Push repo ini ke GitHub (branch `main`).
2. Pergi ke **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Workflow [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) akan build `dist/` dan menerbitkannya.
4. Pautan awam anda: `https://<username>.github.io/<nama-repo>/`

`vite.config.js` menggunakan `base: './'`, jadi app berfungsi pada apa-apa sub-path tanpa perlu ubah konfigurasi.

---

## Cara guna Mod Admin

- Ketik teks **© Podcast Hikmah** di footer **5 kali** dengan pantas, atau ketik ikon 🔒 kecil di sebelahnya.
- Masukkan PIN. Mod Admin aktif sehingga tab pelayar ditutup (disimpan dalam `sessionStorage`).
- Untuk keluar, ketik lencana **Admin** di header atau ikon 🔓 di footer.

## Penyelesaian masalah

| Simptom | Punca & penyelesaian |
|---|---|
| Lencana "Luar talian" | URL salah, deployment bukan *Anyone*, atau anda belum deploy *New version*. Uji `URL?action=getAll`. |
| `Tab "X" tidak dijumpai` | Jalankan `setupSheets()` atau semak ejaan nama tab (huruf besar). |
| `ADMIN_PIN belum ditetapkan` | Tambah Script Property `ADMIN_PIN` (Langkah 2). |
| Tarikh jadi pelik | Pastikan lajur berformat *Plain text* (Format → Number → Plain text) dan tarikh ditulis `YYYY-MM-DD`. |
| Thumbnail YouTube kelabu | ID video tidak sah atau video peribadi. Isi `custom_thumbnail`. |
| Pautan PDF tidak boleh dibuka | Tetapkan perkongsian fail Google Drive kepada **Anyone with the link → Viewer**. |
