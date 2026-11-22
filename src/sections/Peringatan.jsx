import { useMemo } from 'react';
import { MessageSquareQuote, Quote } from 'lucide-react';
import { useData } from '../lib/store.jsx';
import { useI18n } from '../lib/i18n.jsx';
import { byOrder } from '../lib/utils.js';
import { Star8 } from '../components/Pattern.jsx';
import { AddButton, ConfirmModal, Empty, FormModal, RowActions, SectionHeader, moved, useEditor } from '../components/ui.jsx';

const fields = (t) => [
  { name: 'arab', label: t('pr.f.arab'), type: 'textarea', rows: 2, dir: 'rtl', placeholder: 'إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ' },
  { name: 'petikan', label: t('pr.f.petikan'), type: 'textarea', rows: 4, required: true },
  { name: 'konteks', label: t('pr.f.konteks'), placeholder: t('pr.f.konteksPh') },
];

export default function Peringatan() {
  const { db, isAdmin, create, update, remove, reorder } = useData();
  const { t, tr } = useI18n();
  const { editing, setEditing, deleting, setDeleting } = useEditor();
  const rows = useMemo(() => [...db.PERINGATAN].sort(byOrder), [db.PERINGATAN]);
  const save = (v) => (editing?.id ? update('PERINGATAN', editing.id, v) : create('PERINGATAN', v));

  return (
    <section aria-labelledby="h-peringatan">
      <SectionHeader
        eyebrow={t('pr.eyebrow')}
        title={<span id="h-peringatan">{t('pr.title')}</span>}
        desc={t('pr.desc')}
        action={isAdmin && <AddButton onClick={() => setEditing({})}>{t('pr.add')}</AddButton>}
      />

      {rows.length === 0 ? (
        <Empty icon={MessageSquareQuote} title={t('pr.empty')} />
      ) : (
        <ul className="grid gap-x-5 gap-y-6 md:grid-cols-2 sm:gap-y-7">
          {rows.map((r, i) => (
            <li key={r.id} className="flex gap-3">
              {/* speaker avatar */}
              <div className="hidden shrink-0 flex-col items-center sm:flex">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-brand text-accent ring-4 ring-bg dark:border dark:border-accent/40">
                  <Star8 className="h-5 w-5" />
                </span>
              </div>
              <figure className="relative flex-1">
                <figcaption className="mb-2 flex items-center gap-2 ps-1 text-[13px] font-semibold text-muted">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand text-accent sm:hidden dark:border dark:border-accent/40">
                    <Star8 className="h-3.5 w-3.5" />
                  </span>
                  <span className="min-w-0 flex-1 leading-snug">
                    <span className="text-primary">{t('pr.speaker')}</span>
                    {r.konteks && <span className="wrap-anywhere"><span aria-hidden> · </span><bdi dir="auto">{tr(r, 'konteks')}</bdi></span>}
                  </span>
                  <Quote size={20} className="shrink-0 text-accent/50" aria-hidden />
                </figcaption>
                {/* bubble */}
                <div className="relative rounded-card rounded-ss-[4px] border border-line bg-surface p-4 shadow-soft sm:p-5">
                  {/* bubble tail: on the start side, mirrored for RTL */}
                  <span aria-hidden className="absolute -start-[7px] top-0 hidden h-3.5 w-3.5 border-s border-t border-line bg-surface [clip-path:polygon(0_0,100%_0,100%_100%)] rtl:[clip-path:polygon(0_0,100%_0,0_100%)] sm:block" />
                  {r.arab && (
                    <p dir="rtl" lang="ar" className="arabic mb-3 border-b border-line/70 pb-3 text-right text-2xl text-primary wrap-anywhere sm:text-[28px]">
                      {r.arab}
                    </p>
                  )}
                  <blockquote dir="auto" className="text-base leading-[1.75] text-ink wrap-anywhere sm:text-[15px]">{tr(r, 'petikan')}</blockquote>
                  {isAdmin && (
                    <RowActions
                      className="-mx-2 -mb-2 mt-3 justify-end border-t border-line pt-1"
                      onUp={i > 0 ? () => reorder('PERINGATAN', moved(rows, i, -1)) : undefined}
                      onDown={i < rows.length - 1 ? () => reorder('PERINGATAN', moved(rows, i, 1)) : undefined}
                      onEdit={() => setEditing(r)}
                      onDelete={() => setDeleting(r)}
                    />
                  )}
                </div>
              </figure>
            </li>
          ))}
        </ul>
      )}

      <FormModal open={Boolean(editing)} onClose={() => setEditing(null)} title={editing?.id ? t('pr.edit') : t('pr.add')} fields={fields(t)} initial={editing} onSubmit={save} />
      <ConfirmModal open={Boolean(deleting)} onClose={() => setDeleting(null)} onConfirm={() => remove('PERINGATAN', deleting.id)} />
    </section>
  );
}
