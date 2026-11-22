import { addDays } from './utils.js';

/** Realistic Bahasa Melayu seed data. Dates are relative to today so the demo never looks stale. */
export function buildSeed() {
  return {
    // LIST PANEL is the schedule source of truth; UPCOMING is derived from it (see lib/schedule.js).
    UPCOMING: [],
    PANEL: [
      { id: 'pn1', tajuk: 'Mengurus Hati di Era Media Sosial', nama_panel: 'Ustaz Hafiz Rahman', tarikh: addDays(3), masa: '21:00' },
      { id: 'pn2', tajuk: 'Mengurus Hati di Era Media Sosial', nama_panel: 'Dr. Nurul Huda Ismail', tarikh: addDays(3), masa: '21:00' },
      { id: 'pn3', tajuk: "Adab Penuntut Ilmu: Belajar dari Kitab Ta'lim al-Muta'allim", nama_panel: 'Ustaz Amirul Hakim', tarikh: addDays(10), masa: '20:30' },
      { id: 'pn4', tajuk: "Adab Penuntut Ilmu: Belajar dari Kitab Ta'lim al-Muta'allim", nama_panel: 'Sdr. Faiz Azman', tarikh: addDays(10), masa: '20:30' },
      { id: 'pn5', tajuk: 'Keluarga Sakinah: Komunikasi Suami Isteri', nama_panel: 'Ustazah Siti Aisyah', tarikh: addDays(17), masa: '21:00' },
      { id: 'pn11', tajuk: 'Rezeki & Tawakal: Antara Usaha dan Doa', nama_panel: 'Ustaz Zulkifli Hassan', tarikh: 'Belum Ditentukan' },
      { id: 'pn6', tajuk: 'Hikmah di Sebalik Ujian', nama_panel: 'Ustaz Muhammad Syafiq', tarikh: addDays(-7) },
      { id: 'pn7', tajuk: 'Hikmah di Sebalik Ujian', nama_panel: 'Pn. Rohani Abdullah', tarikh: addDays(-7) },
      { id: 'pn8', tajuk: 'Solat Khusyuk: Dari Teori ke Amalan', nama_panel: 'Ustaz Hafiz Rahman', tarikh: addDays(-14) },
      { id: 'pn9', tajuk: 'Belia & Masjid: Membina Semula Hubungan', nama_panel: 'Sdr. Danial Iskandar', tarikh: addDays(-21) },
      { id: 'pn10', tajuk: 'Belia & Masjid: Membina Semula Hubungan', nama_panel: 'Dr. Ahmad Fauzi Yusof', tarikh: addDays(-21) },
    ],
    PANDUAN: [
      { id: 'pd1', order: 1, kategori: 'PANEL', tajuk: 'Panduan Lengkap Panel Jemputan', keterangan: 'Aliran rakaman, format soalan, tempoh masa setiap segmen dan perkara yang perlu disediakan sebelum hari rakaman.', gdrive_url: 'https://drive.google.com/file/d/CONTOH_PANDUAN_PANEL/view' },
      { id: 'pd2', order: 2, kategori: 'PANEL', tajuk: 'SOP Moderator', keterangan: 'Skrip pembukaan & penutup, pengurusan masa, cara mengendalikan soalan penonton secara langsung.', gdrive_url: 'https://drive.google.com/file/d/CONTOH_SOP_MODERATOR/view' },
      { id: 'pd3', order: 3, kategori: 'PANEL', tajuk: 'Garis Panduan Teknikal & Pakaian', keterangan: 'Tetapan audio/video, latar belakang, pencahayaan dan kod pakaian sepanjang rakaman.', gdrive_url: 'https://drive.google.com/file/d/CONTOH_TEKNIKAL/view' },
      { id: 'pd4', order: 4, kategori: 'SKRIP_PROMOSI', tajuk: 'Contoh Skrip Promosi Kitab', keterangan: 'Skrip ringkas 60–90 saat untuk promosi kitab di akhir episod.', gdrive_url: 'https://drive.google.com/file/d/CONTOH_SKRIP_PROMOSI/view' },
    ],
    PERINGATAN: [
      { id: 'pr1', order: 1, petikan: 'Niatkan setiap perkongsian kerana Allah. Jangan jadikan majlis ilmu sebagai pentas untuk menonjolkan diri.', arab: 'إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ', konteks: 'Taklimat Panel, Muharram 1448H' },
      { id: 'pr2', order: 2, petikan: 'Jika tidak pasti tentang sesuatu hukum, katakan "saya tidak pasti". Itu tanda kejujuran ilmu, bukan kelemahan.', arab: '', konteks: 'Majlis Ilmu Bulanan' },
      { id: 'pr3', order: 3, petikan: 'Hormati masa. Hadir lebih awal 15 minit sebelum rakaman supaya hati tenang dan persiapan rapi.', arab: '', konteks: 'Pesanan kepada Moderator' },
      { id: 'pr4', order: 4, petikan: 'Bercakaplah dengan bahasa yang memudahkan, bukan menyukarkan. Sampaikan dengan lembut walaupun tegas pada prinsip.', arab: 'يَسِّرُوا وَلَا تُعَسِّرُوا', konteks: 'Usrah Pengurusan Podcast' },
    ],
    KITAB: [
      { id: 'kb1', nama_kitab: 'Ihya\' Ulum al-Din (Terjemahan)', bilangan: 7 },
      { id: 'kb2', nama_kitab: 'Riyadhus Solihin', bilangan: 5 },
      { id: 'kb3', nama_kitab: 'Al-Hikam Ibn \'Atha\'illah', bilangan: 4 },
      { id: 'kb4', nama_kitab: 'Bidayatul Hidayah', bilangan: 2 },
      { id: 'kb5', nama_kitab: 'Ta\'lim al-Muta\'allim', bilangan: 1 },
      { id: 'kb6', nama_kitab: 'Risalah al-Mu\'awanah', bilangan: 0 },
    ],
    YOUTUBE: [
      { id: 'yt1', order: 1, tajuk: 'EP12 · Hikmah di Sebalik Ujian', youtube_url: 'https://www.youtube.com/watch?v=CONTOHEP012', custom_thumbnail: '', tarikh: addDays(-7) },
      { id: 'yt2', order: 2, tajuk: 'EP11 · Solat Khusyuk: Dari Teori ke Amalan', youtube_url: 'https://youtu.be/CONTOHEP011', custom_thumbnail: '', tarikh: addDays(-14) },
      { id: 'yt3', order: 3, tajuk: 'EP10 · Belia & Masjid', youtube_url: 'https://www.youtube.com/live/CONTOHEP010', custom_thumbnail: '', tarikh: addDays(-21) },
      { id: 'yt4', order: 4, tajuk: 'EP09 · Sabar Itu Indah', youtube_url: 'https://www.youtube.com/shorts/CONTOHEP009', custom_thumbnail: '', tarikh: addDays(-28) },
    ],
    CADANGAN: [
      { id: 'cd1', tarikh: addDays(-2), catatan: 'Cadangkan tambah segmen soal jawab langsung dari penonton YouTube pada 10 minit terakhir.', status: 'BELUM', balasan_admin: '', created_at: addDays(-2) },
      { id: 'cd2', tarikh: addDays(-6), catatan: 'Mohon panduan panel dihantar sekurang-kurangnya 3 hari sebelum rakaman.', status: 'SELESAI', balasan_admin: 'Terima kasih! Kini pautan hub ini dikongsi sebaik sahaja panel disahkan.', created_at: addDays(-6) },
      { id: 'cd3', tarikh: addDays(-9), catatan: 'Boleh tak sediakan thumbnail yang konsisten untuk semua episod?', status: 'BELUM', balasan_admin: 'Sedang dibincangkan bersama pasukan grafik.', created_at: addDays(-9) },
    ],
  };
}
