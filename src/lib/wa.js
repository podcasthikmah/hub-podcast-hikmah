import { CONFIG } from '../config.js';
import { formatTarikh, hariOf } from './utils.js';
import { formatMasa } from './schedule.js';

export const hubUrl = () => CONFIG.HUB_URL || `${window.location.origin}${window.location.pathname}`;

/** WhatsApp-formatted announcement (*bold*, _italic_). */
export function buildWaMessage(item) {
  if (!item.tajuk) return '';
  const lines = [
    '*🎙️ PODCAST HIKMAH — MAKLUMAN RAKAMAN*',
    '',
    `📌 *Tajuk:* ${item.tajuk}`,
    `📅 *Hari/Tarikh:* ${hariOf(item) ? `${hariOf(item)}, ` : ''}${formatTarikh(item.tarikh)}`,
  ];
  if (item.masa) lines.push(`⏰ *Masa:* ${formatMasa(item.masa, 'ms')}`); // WA message stays BM for the group
  if (item.panel) lines.push(`👥 *Panel:* ${item.panel}`);
  lines.push(
    '',
    'Panel & moderator dijemput menyemak *Panduan Panel*, peringatan Syeikhuna serta maklumat lanjut di hub rasmi:',
    `🔗 ${hubUrl()}#panduan`,
    '',
    '_Jazakumullahu khairan._',
  );
  return lines.join('\n');
}
