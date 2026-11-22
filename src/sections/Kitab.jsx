import { useMemo, useState } from 'react';
import { ArrowDownUp, BookMarked, Minus, Plus } from 'lucide-react';
import { useData } from '../lib/store.jsx';
import { byOrder, cx } from '../lib/utils.js';
import { PANDUAN_KATEGORI } from '../lib/schema.js';
import { DriveCard, driveFields } from '../components/DriveCard.jsx';
import { useI18n } from '../lib/i18n.jsx';
import { AddButton, ConfirmModal, Empty, FormModal, RowActions, SectionHeader, useEditor } from '../components/ui.jsx';

const fields = (t) => [
  { name: 'nama_kitab', label: t('kb.f.nama'), required: true, placeholder: t('kb.f.namaPh') },
  { name: 'bilangan', label: t('kb.f.bil'), type: 'number', min: 0, placeholder: '0' },
];

function Badge({ n }) {
  const { t } = useI18n();
  return (
    <span
      className={cx('grid h-11 min-w-[3.25rem] shrink-0 place-items-center rounded-full px-2.5 text-base font-extrabold tabular-nums', n === 0 ? 'bg-ink/5 text-muted' : 'bg-accent text-on-accent')}
      aria-label={t('kb.timesAria', { n })}
      title={t('kb.times')}
    >
      {n}×
    </span>
  );
}

// Promosi Kitab shows book names and script titles exactly as entered, in both languages
// (the *_ar translations are deliberately not used here). Static UI text is still translated.
export default function Kitab() {
  const { db, isAdmin, create, update, remove, increment } = useData();
  const { t } = useI18n();
  const book = useEditor();
  const script = useEditor();
  const [asc, setAsc] = useState(true);

  const rows = useMemo(
    () => [...db.KITAB].sort((a, b) => (asc ? 1 : -1) * ((Number(a.bilangan) || 0) - (Number(b.bilangan) || 0)) || String(a.nama_kitab).localeCompare(b.nama_kitab)),
    [db.KITAB, asc],
  );
  const max = Math.max(1, ...rows.map((r) => Number(r.bilangan) || 0));
  const scripts = useMemo(() => db.PANDUAN.filter((r) => r.kategori === PANDUAN_KATEGORI.SKRIP).sort(byOrder), [db.PANDUAN]);

  const saveBook = (v) => {
    const item = { ...v, bilangan: Number(v.bilangan) || 0 };
    return book.editing?.id ? update('KITAB', book.editing.id, item) : create('KITAB', item);
  };
  const saveScript = (v) =>
    script.editing?.id ? update('PANDUAN', script.editing.id, v) : create('PANDUAN', { ...v, kategori: PANDUAN_KATEGORI.SKRIP });

  return (
    <section aria-labelledby="h-kitab">
      <SectionHeader
        eyebrow={t('kb.eyebrow')}
        title={<span id="h-kitab">{t('kb.title')}</span>}
        desc={t('kb.desc')}
        action={isAdmin && <AddButton onClick={() => book.setEditing({ bilangan: 0 })}>{t('kb.add')}</AddButton>}
      />

      {/* grid-cols-1 + min-w-0: a long nowrap kitab name must not widen the column past the screen */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0">
          <div className="mb-1 flex items-center justify-between gap-3">
            <p className="text-[13px] font-medium text-muted">{t('kb.count', { n: rows.length })}</p>
            <button className="hit -me-2 gap-1.5 rounded-btn px-2 text-[13px] font-semibold text-muted hover:text-ink" onClick={() => setAsc((a) => !a)}>
              <ArrowDownUp size={14} /> {asc ? t('kb.sortAsc') : t('kb.sortDesc')}
            </button>
          </div>
          {rows.length === 0 ? (
            <Empty icon={BookMarked} title={t('kb.empty')} />
          ) : (
            <ul className="card divide-y divide-line overflow-hidden">
              {rows.map((r) => {
                const n = Number(r.bilangan) || 0;
                return (
                  <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3.5 sm:flex-nowrap sm:px-5">
                    <BookMarked size={20} className="shrink-0 self-start text-primary sm:self-center" strokeWidth={1.8} />
                    <div className="min-w-0 flex-1">
                      <p dir="auto" className="font-semibold leading-snug text-ink wrap-anywhere">{r.nama_kitab}</p>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-line" aria-hidden>
                        <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${(n / max) * 100}%` }} />
                      </div>
                    </div>
                    {!isAdmin && <Badge n={n} />}
                    {isAdmin && (
                      <div className="-ms-2 flex w-full items-center justify-end gap-2 sm:ms-0 sm:w-auto">
                        <RowActions className="me-auto sm:order-last sm:me-0" onEdit={() => book.setEditing(r)} onDelete={() => book.setDeleting(r)} />
                        <button className="btn-icon border border-line" onClick={() => increment('KITAB', r.id, -1)} disabled={n <= 0} aria-label={t('kb.dec', { name: r.nama_kitab })}>
                          <Minus size={15} />
                        </button>
                        <Badge n={n} />
                        <button className="btn-icon border border-line" onClick={() => increment('KITAB', r.id, 1)} aria-label={t('kb.inc', { name: r.nama_kitab })}>
                          <Plus size={15} />
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <aside className="min-w-0 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted">{t('kb.scripts')}</h3>
            {isAdmin && <button className="hit -me-2 rounded-btn px-2 text-sm font-semibold text-primary hover:underline" onClick={() => script.setEditing({})}>{t('kb.addScript')}</button>}
          </div>
          {scripts.length === 0 ? (
            <Empty title={t('kb.noScript')} hint={t('kb.noScriptHint')} />
          ) : (
            scripts.map((s) => (
              <DriveCard key={s.id} item={s} featured original isAdmin={isAdmin} onEdit={() => script.setEditing(s)} onDelete={() => script.setDeleting(s)} />
            ))
          )}
        </aside>
      </div>

      <FormModal open={Boolean(book.editing)} onClose={() => book.setEditing(null)} title={book.editing?.id ? t('kb.edit') : t('kb.add')} fields={fields(t)} initial={book.editing} onSubmit={saveBook} />
      <ConfirmModal open={Boolean(book.deleting)} onClose={() => book.setDeleting(null)} onConfirm={() => remove('KITAB', book.deleting.id)} message={t('ui.deleteNamed', { name: book.deleting?.nama_kitab })} />
      <FormModal open={Boolean(script.editing)} onClose={() => script.setEditing(null)} title={script.editing?.id ? t('kb.editScript') : t('kb.addScriptTitle')} fields={driveFields(t)} initial={script.editing} onSubmit={saveScript} />
      <ConfirmModal open={Boolean(script.deleting)} onClose={() => script.setDeleting(null)} onConfirm={() => remove('PANDUAN', script.deleting.id)} />
    </section>
  );
}
