/**
 * LIST PANEL is the single source of truth for the podcast schedule.
 * UPCOMING PODCAST and the Hero Spotlight are *derived* from PANEL rows here —
 * there is no separate schedule to keep in sync.
 *
 * PANEL.tarikh is either an ISO date ('YYYY-MM-DD') or the literal 'Belum Ditentukan'.
 * Hari (day name) is always derived from the date, never stored, so it can't drift.
 */
import { daysUntil, formatTarikh, hariFromISO } from './utils.js';

export const TBD = 'Belum Ditentukan';

/** True when the value is a real calendar date (anything else = not yet decided). */
export const isDated = (t) => /^\d{4}-\d{2}-\d{2}/.test(String(t ?? '').trim());

/** 'Khamis, 3 Disember 2026' (or short: 'Khamis, 3 Dis 2026'), or 'Belum Ditentukan'. */
export function formatTarikhHari(t, { short = false } = {}) {
  if (!isDated(t)) return TBD;
  const iso = String(t).trim().slice(0, 10);
  return `${hariFromISO(iso)}, ${formatTarikh(iso, { short })}`;
}

/** 'HH:mm' (24h) when the value is a recognisable time ('21:00', '9:05', '21.30'), else ''. */
export function normalizeMasa(m) {
  const x = String(m ?? '').trim().match(/^(\d{1,2})[:.](\d{2})(?::\d{2})?$/);
  if (!x) return '';
  const h = Number(x[1]);
  const min = Number(x[2]);
  if (h > 23 || min > 59) return '';
  return `${String(h).padStart(2, '0')}:${x[2]}`;
}

/**
 * Human time of day. ms: '9:00 malam' · '2:30 petang' · '12:00 tengah hari' · '6:00 pagi'
 * ar: '9:00 مساءً' · '3:00 عصرًا' · '12:30 ظهرًا' · '6:00 صباحًا'. Unrecognised text is shown as entered.
 */
export function formatMasa(m, lang = 'ms') {
  const n = normalizeMasa(m);
  if (!n) return String(m ?? '').trim();
  const [h, min] = n.split(':').map(Number);
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const t = `${h12}:${String(min).padStart(2, '0')}`;
  if (lang === 'ar') {
    const p = h < 12 ? 'صباحًا' : h < 15 ? 'ظهرًا' : h < 18 ? 'عصرًا' : 'مساءً';
    return `${t} ${p}`;
  }
  const p = h < 12 ? 'pagi' : h < 14 ? 'tengah hari' : h < 19 ? 'petang' : 'malam';
  return `${t} ${p}`;
}

/** ['A'] -> 'A'; ['A','B'] -> 'A & B'; ['A','B','C'] -> 'A, B & C' */
export function joinNames(names) {
  const n = names.filter(Boolean);
  if (n.length <= 1) return n[0] || '';
  return `${n.slice(0, -1).join(', ')} & ${n[n.length - 1]}`;
}

const key = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * PANEL rows (one per panelist) -> schedule slots (one per podcast).
 * Rows with the same date + same tajuk merge into one slot with all panelists.
 * Excludes 'Belum Ditentukan'; by default only today and later. Nearest date first.
 */
export function deriveSchedule(panelRows = [], { includePast = false } = {}) {
  const slots = new Map();
  for (const r of panelRows) {
    if (!isDated(r.tarikh)) continue;
    const tarikh = String(r.tarikh).trim().slice(0, 10);
    const n = daysUntil(tarikh);
    if (!includePast && (n === null || n < 0)) continue;
    const k = `${tarikh}|${key(r.tajuk)}`;
    if (!slots.has(k)) slots.set(k, { id: k, tarikh, hari: hariFromISO(tarikh), tajuk: String(r.tajuk || '').trim(), masa: '', names: [], ids: [] });
    const s = slots.get(k);
    // shooting time: the earliest valid time among the slot's panelists
    const m = normalizeMasa(r.masa);
    if (m && (!s.masa || m < s.masa)) s.masa = m;
    const name = String(r.nama_panel || '').trim();
    if (name && !s.names.some((x) => key(x) === key(name))) s.names.push(name);
    s.ids.push(r.id);
  }
  return [...slots.values()]
    .map((s) => ({ ...s, panel: joinNames(s.names) }))
    // nearest date first; same day -> earlier time first (no time last)
    .sort((a, b) => a.tarikh.localeCompare(b.tarikh) || (a.masa || '99:99').localeCompare(b.masa || '99:99') || a.tajuk.localeCompare(b.tajuk));
}

/** Nearest upcoming slot (today or later) for the Hero Spotlight, or undefined. */
export const nextScheduled = (panelRows) => deriveSchedule(panelRows)[0];
