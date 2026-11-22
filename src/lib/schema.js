/**
 * Single source of truth for sheet names & columns.
 * MUST match HEADERS in google-apps-script/Code.gs.
 */
export const SHEETS = {
  // Legacy: kept so existing Sheets keep loading; the UI no longer reads or writes it.
  UPCOMING: ['id', 'order', 'hari', 'tarikh', 'masa', 'tajuk', 'panel'],
  // Schedule source of truth. tarikh = 'YYYY-MM-DD' | 'Belum Ditentukan'. Hari is derived.
  // masa = shooting time 'HH:mm' (24h, optional).
  PANEL: ['id', 'tajuk', 'nama_panel', 'tarikh', 'masa'],
  PANDUAN: ['id', 'order', 'kategori', 'tajuk', 'keterangan', 'gdrive_url'],
  PERINGATAN: ['id', 'order', 'petikan', 'arab', 'konteks'],
  KITAB: ['id', 'nama_kitab', 'bilangan'],
  YOUTUBE: ['id', 'order', 'tajuk', 'youtube_url', 'custom_thumbnail', 'tarikh'],
  CADANGAN: ['id', 'tarikh', 'catatan', 'status', 'balasan_admin', 'created_at'],
};

// Auto-translated Arabic columns written by Code.gs (mirrors TRANSLATE there). Read-only for the UI.
export const TRANSLATED = {
  PANEL: ['tajuk', 'nama_panel'],
  PANDUAN: ['tajuk', 'keterangan'],
  PERINGATAN: ['petikan', 'konteks'],
  KITAB: ['nama_kitab'],
  YOUTUBE: ['tajuk'],
  CADANGAN: ['catatan', 'balasan_admin'],
};

export const PANDUAN_KATEGORI = { PANEL: 'PANEL', SKRIP: 'SKRIP_PROMOSI' };
export const STATUS = { BELUM: 'BELUM', SELESAI: 'SELESAI' };

export const emptyDB = () =>
  Object.fromEntries(Object.keys(SHEETS).map((k) => [k, []]));
