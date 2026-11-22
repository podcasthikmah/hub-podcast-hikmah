import { CONFIG } from '../config.js';
import { formatTarikh, hariOf } from './utils.js';
import { formatMasa } from './schedule.js';

export const hubUrl = () => CONFIG.HUB_URL || `${window.location.origin}${window.location.pathname}`;

/**
 * WhatsApp-formatted announcement (*bold*, _italic_) in the UI language.
 * Arabic uses the auto-translated title/panelists (falls back to the BM text when a
 * translation is missing) and Arabic day/month/time. Pass { lang, fmt, tr } from useI18n().
 */
export function buildWaMessage(item, { lang = 'ms', fmt, tr } = {}) {
  if (!item.tajuk) return '';
  if (lang === 'ar' && fmt && tr) {
    const lines = [
      '*🎙️ بودكاست الحكمة — إعلان التسجيل*',
      '',
      `📌 *العنوان:* ${tr(item, 'tajuk')}`,
      `📅 *اليوم والتاريخ:* ${fmt.tarikhHari(item.tarikh)}`,
    ];
    if (item.masa) lines.push(`⏰ *الوقت:* ${fmt.masa(item.masa)}`);
    if (item.panel) lines.push(`👥 *الضيوف:* ${tr(item, 'panel')}`);
    lines.push(
      '',
      'ندعو الضيوف ومديري الحوار للاطلاع على *دليل الضيوف* وتوجيهات شيخنا والمعلومات الإضافية في المنصة الرسمية:',
      `🔗 ${hubUrl()}#panduan`,
      '',
      '_جزاكم الله خيرًا._',
    );
    return lines.join('\n');
  }
  const lines = [
    '*🎙️ PODCAST HIKMAH — MAKLUMAN RAKAMAN*',
    '',
    `📌 *Tajuk:* ${item.tajuk}`,
    `📅 *Hari/Tarikh:* ${hariOf(item) ? `${hariOf(item)}, ` : ''}${formatTarikh(item.tarikh)}`,
  ];
  if (item.masa) lines.push(`⏰ *Masa:* ${formatMasa(item.masa, 'ms')}`);
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
