import { Download, ExternalLink, FileText } from 'lucide-react';
import { cx } from '../lib/utils.js';
import { RowActions } from './ui.jsx';
import { useI18n } from '../lib/i18n.jsx';

export function driveId(url) {
  const s = String(url || '');
  const m = s.match(/\/d\/([\w-]{10,})/) || s.match(/[?&]id=([\w-]{10,})/);
  return m ? m[1] : null;
}
export function driveDownload(url) {
  const id = driveId(url);
  return id ? `https://drive.google.com/uc?export=download&id=${id}` : url;
}

/** `original`: always show the text exactly as entered (no *_ar translation) — used by Promosi Kitab. */
export function DriveCard({ item, isAdmin, onEdit, onDelete, onUp, onDown, featured = false, original = false }) {
  const hasUrl = Boolean(item.gdrive_url);
  const { t, tr: translate } = useI18n();
  const tr = original ? (row, f) => row?.[f] || '' : translate;
  return (
    <article
      className={cx(
        'relative flex h-full flex-col gap-4 rounded-card border p-5 shadow-soft',
        featured ? 'border-transparent bg-brand text-on-brand dark:border-accent/30' : 'border-line bg-surface',
      )}
    >
      <div className="flex items-start gap-3.5">
        <span className={cx('grid h-11 w-11 shrink-0 place-items-center rounded-btn', featured ? 'bg-white/10 text-accent' : 'bg-accent/15 text-primary')}>
          <FileText size={21} strokeWidth={1.8} />
        </span>
        <div className="min-w-0 flex-1">
          <p className={cx('mb-0.5 text-xs font-bold uppercase tracking-[0.14em]', featured ? 'text-accent' : 'text-muted')}><span lang="en" dir="ltr">PDF · Google Drive</span></p>
          <h3 dir="auto" className="text-[17px] font-bold leading-snug wrap-anywhere sm:text-base">{tr(item, 'tajuk')}</h3>
        </div>
      </div>
      {item.keterangan && <p dir="auto" className={cx('text-[15px] leading-relaxed wrap-anywhere sm:text-sm', featured ? 'text-on-brand/80' : 'text-muted')}>{tr(item, 'keterangan')}</p>}
      <div className="mt-auto flex gap-2">
        {hasUrl ? (
          <>
            <a className="btn-gold flex-1" href={driveDownload(item.gdrive_url)} target="_blank" rel="noopener noreferrer">
              <Download size={16} /> {t('drive.download')}
            </a>
            <a
              className={cx('btn min-w-11 border px-3 sm:px-4', featured ? 'border-white/20 text-on-brand hover:bg-white/10' : 'border-line text-ink hover:bg-ink/5')}
              href={item.gdrive_url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={t('drive.viewAria', { title: tr(item, 'tajuk') })}
            >
              <ExternalLink size={16} className="flip-rtl" /> <span className="hidden sm:inline">{t('drive.view')}</span>
            </a>
          </>
        ) : (
          <span className="text-sm italic opacity-70">{t('drive.noLink')}</span>
        )}
      </div>
      {isAdmin && (
        <RowActions
          tone={featured ? 'onBrand' : 'default'}
          className={cx('-mx-2 -mb-2 justify-end border-t pt-1', featured ? 'border-white/15' : 'border-line')}
          onUp={onUp} onDown={onDown} onEdit={onEdit} onDelete={onDelete}
        />
      )}
    </article>
  );
}

export const driveFields = (t) => [
  { name: 'tajuk', label: t('drive.f.tajuk'), required: true, placeholder: t('drive.f.tajukPh') },
  { name: 'keterangan', label: t('drive.f.ket'), type: 'textarea', rows: 3, placeholder: t('drive.f.ketPh') },
  {
    name: 'gdrive_url', label: t('drive.f.url'), type: 'url', required: true,
    placeholder: 'https://drive.google.com/file/d/…/view',
    help: t('drive.f.urlHelp'),
  },
];
