import { useMemo, useState } from 'react';
import { Play, PlaySquare } from 'lucide-react';
import { useData } from '../lib/store.jsx';
import { byOrder, getYouTubeId, isUrl, ytThumb, ytWatch } from '../lib/utils.js';
import { useI18n } from '../lib/i18n.jsx';
import { StarPattern } from '../components/Pattern.jsx';
import { AddButton, ConfirmModal, Empty, FormModal, RowActions, SectionHeader, moved, useEditor } from '../components/ui.jsx';

function Thumb({ item, className = '' }) {
  const { tr } = useI18n();
  const id = getYouTubeId(item.youtube_url);
  const custom = isUrl(item.custom_thumbnail) ? item.custom_thumbnail : '';
  // Demo seed IDs (CONTOH…) don't exist on YouTube: skip the request instead of logging 404s.
  const src = custom || (id && !/^CONTOH/.test(id) ? ytThumb(id) : '');
  const [failed, setFailed] = useState(false);
  const [lastSrc, setLastSrc] = useState(src);
  if (src !== lastSrc) { setLastSrc(src); setFailed(false); }

  return (
    <div className={`relative aspect-video overflow-hidden bg-brand ${className}`}>
      {src && !failed ? (
        <img
          src={src}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
          onError={() => setFailed(true)}
          // YouTube serves a 120×90 grey placeholder for unknown IDs — treat as missing.
          onLoad={(e) => !custom && e.currentTarget.naturalWidth <= 120 && setFailed(true)}
        />
      ) : (
        <div className="absolute inset-0 grid place-items-center text-accent">
          <StarPattern id={`yt-${item.id}`} opacity={0.08} />
          <span dir="auto" className="relative line-clamp-3 px-6 text-center text-sm font-semibold text-on-brand/85 wrap-anywhere">{tr(item, 'tajuk')}</span>
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
      <span className="absolute bottom-3 start-3 grid h-11 w-11 place-items-center rounded-full bg-accent text-on-accent shadow-lg transition group-hover:scale-110">
        <Play size={17} fill="currentColor" className="translate-x-[1px]" />
      </span>
    </div>
  );
}

const fields = (t) => [
  { name: 'tajuk', label: t('yt.f.tajuk'), required: true, placeholder: t('yt.f.tajukPh') },
  {
    name: 'youtube_url', label: t('yt.f.url'), type: 'url', required: true,
    placeholder: t('yt.f.urlPh'),
    help: t('yt.f.urlHelp'),
    preview: (v) => {
      const id = getYouTubeId(v.youtube_url);
      if (!v.youtube_url) return null;
      return id ? (
        <div className="mt-3 flex items-center gap-3 rounded-btn border border-line p-2">
          <img src={(isUrl(v.custom_thumbnail) && v.custom_thumbnail) || ytThumb(id, 'mqdefault')} alt="" className="h-12 w-20 rounded object-cover" />
          <span className="text-[13px] text-muted">{t('yt.detected')} <code dir="ltr" className="font-semibold text-ink">{id}</code></span>
        </div>
      ) : (
        <p className="mt-2 text-[13px] font-medium text-danger">{t('yt.unknown')}</p>
      );
    },
  },
  { name: 'custom_thumbnail', label: t('yt.f.thumb'), type: 'url', placeholder: 'https://…/gambar.jpg', help: t('yt.f.thumbHelp') },
  { name: 'tarikh', label: t('yt.f.tarikh'), type: 'date' },
];

export default function Youtube() {
  const { db, isAdmin, create, update, remove, reorder, toast } = useData();
  const { t, fmt, tr } = useI18n();
  const { editing, setEditing, deleting, setDeleting } = useEditor();
  const rows = useMemo(() => [...db.YOUTUBE].sort(byOrder), [db.YOUTUBE]);

  const save = (v) => {
    if (!getYouTubeId(v.youtube_url)) {
      toast(t('yt.invalid'), 'err');
      return false;
    }
    return editing?.id ? update('YOUTUBE', editing.id, v) : create('YOUTUBE', v);
  };

  return (
    <section aria-labelledby="h-youtube">
      <SectionHeader
        eyebrow={t('yt.eyebrow')}
        title={<span id="h-youtube">{t('yt.title')}</span>}
        desc={t('yt.desc')}
        action={isAdmin && <AddButton onClick={() => setEditing({})}>{t('yt.add')}</AddButton>}
      />

      {rows.length === 0 ? (
        <Empty icon={PlaySquare} title={t('yt.empty')} />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
          {rows.map((r, i) => {
            const id = getYouTubeId(r.youtube_url);
            return (
              <li key={r.id} className="card group flex flex-col overflow-hidden">
                <a href={id ? ytWatch(id) : r.youtube_url} target="_blank" rel="noopener noreferrer" className="flex flex-1 flex-col focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent">
                  <Thumb item={r} />
                  <div className="flex flex-1 flex-col gap-1 p-4">
                    <h3 dir="auto" className="line-clamp-2 text-[17px] font-bold leading-snug text-ink wrap-anywhere group-hover:text-primary sm:text-base">{tr(r, 'tajuk')}</h3>
                    {r.tarikh && <p className="text-[13px] text-muted">{fmt.date(r.tarikh)}</p>}
                  </div>
                </a>
                {isAdmin && (
                  <RowActions
                    className="justify-end border-t border-line px-1 py-0.5"
                    onUp={i > 0 ? () => reorder('YOUTUBE', moved(rows, i, -1)) : undefined}
                    onDown={i < rows.length - 1 ? () => reorder('YOUTUBE', moved(rows, i, 1)) : undefined}
                    onEdit={() => setEditing(r)}
                    onDelete={() => setDeleting(r)}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}

      <FormModal open={Boolean(editing)} onClose={() => setEditing(null)} title={editing?.id ? t('yt.edit') : t('yt.add')} fields={fields(t)} initial={editing} onSubmit={save} />
      <ConfirmModal open={Boolean(deleting)} onClose={() => setDeleting(null)} onConfirm={() => remove('YOUTUBE', deleting.id)} message={t('ui.deleteNamed', { name: tr(deleting, 'tajuk') })} />
    </section>
  );
}
