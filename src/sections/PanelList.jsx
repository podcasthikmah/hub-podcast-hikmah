import { useMemo, useState } from 'react';
import { CalendarClock, CalendarDays, Search, UserRound, Users, X } from 'lucide-react';
import { useData } from '../lib/store.jsx';
import { cx, daysUntil } from '../lib/utils.js';
import { TBD, isDated } from '../lib/schedule.js';
import { useI18n } from '../lib/i18n.jsx';
import { AddButton, ConfirmModal, Empty, FormModal, RowActions, SectionHeader, useEditor } from '../components/ui.jsx';

/** Live preview under the date field: the derived Bahasa Melayu day + full date. */
function HariPreview({ values }) {
  const { t, fmt } = useI18n();
  if (values.tbd) {
    return <p className="mt-2 text-[13px] font-medium text-muted">{t('panel.preview.tbd')}</p>;
  }
  if (!isDated(values.tarikh)) return null;
  const n = daysUntil(values.tarikh);
  return (
    <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-btn bg-brand/5 px-3 py-2 text-[13px] dark:bg-accent/10">
      <CalendarDays size={15} className="shrink-0 text-primary" />
      <span className="font-semibold text-ink" data-testid="hari-preview">{fmt.tarikhHari(values.tarikh)}</span>
      {n !== null && <span className="text-muted">· {n < 0 ? t('panel.preview.past') : `${fmt.relative(values.tarikh)} · ${t('panel.preview.shown')}`}</span>}
    </p>
  );
}

const fields = (t) => [
  { name: 'tajuk', label: t('panel.f.tajuk'), required: true, placeholder: t('panel.f.tajukPh') },
  {
    name: 'nama_panel', label: t('panel.f.nama'), required: true, placeholder: t('panel.f.namaPh'),
    help: t('panel.f.namaHelp'),
  },
  {
    name: 'tarikh', label: t('panel.f.tarikh'), type: 'date',
    requiredWhen: (v) => !v.tbd,
    disabledWhen: (v) => Boolean(v.tbd),
    preview: (v) => <HariPreview values={v} />,
  },
  { name: 'tbd', label: t('panel.f.tbd'), type: 'checkbox', help: t('panel.f.tbdHelp') },
];

const norm = (s) => String(s || '').toLowerCase().normalize('NFKD');

/** Upcoming (nearest first) -> Belum Ditentukan -> past (most recent first). */
function rank(r) {
  if (!isDated(r.tarikh)) return 1;
  const n = daysUntil(r.tarikh);
  return n !== null && n >= 0 ? 0 : 2;
}

function DateLine({ tarikh }) {
  const { t, fmt } = useI18n();
  if (!isDated(tarikh)) {
    return (
      <span className="chip mt-1.5 border border-dashed border-muted/50 bg-transparent text-muted">
        <CalendarClock size={13} /> {t('date.tbd')}
      </span>
    );
  }
  const n = daysUntil(tarikh);
  const future = n !== null && n >= 0;
  return (
    <p className={cx('mt-1 flex flex-wrap items-center gap-x-1.5 text-[13px] font-medium', future ? 'text-primary' : 'text-muted')}>
      <CalendarDays size={14} className="shrink-0" />
      <span>{fmt.tarikhHari(tarikh, { short: true })}</span>
      {future && <span className="font-normal text-muted">· {fmt.relative(tarikh)}</span>}
    </p>
  );
}

export default function PanelList() {
  const { db, isAdmin, create, update, remove, toast } = useData();
  const { t } = useI18n();
  const { editing, setEditing, deleting, setDeleting } = useEditor();
  const [q, setQ] = useState('');
  const [when, setWhen] = useState('semua');

  const rows = useMemo(() => {
    const term = norm(q).trim();
    return [...db.PANEL]
      .filter((r) => !term || norm(`${r.tajuk} ${r.nama_panel}`).includes(term))
      .filter((r) => {
        if (when === 'semua') return true;
        const k = rank(r);
        return when === 'akan' ? k <= 1 : k === 2; // "Akan datang" includes Belum Ditentukan
      })
      .sort((a, b) => {
        const ra = rank(a);
        const rb = rank(b);
        if (ra !== rb) return ra - rb;
        const da = String(a.tarikh || '');
        const db_ = String(b.tarikh || '');
        const byDate = ra === 0 ? da.localeCompare(db_) : db_.localeCompare(da);
        return byDate || norm(a.tajuk).localeCompare(norm(b.tajuk));
      });
  }, [db.PANEL, q, when]);

  const openEditor = (r) =>
    setEditing(
      r?.id
        ? { ...r, tarikh: isDated(r.tarikh) ? String(r.tarikh).slice(0, 10) : '', tbd: !isDated(r.tarikh) }
        : { tbd: false },
    );

  const save = async (v) => {
    if (!v.tbd && !isDated(v.tarikh)) {
      toast(t('panel.needDate'), 'err');
      return false;
    }
    // Only the sheet columns go to the backend; `tbd` is UI state.
    const item = { tajuk: String(v.tajuk || '').trim(), nama_panel: String(v.nama_panel || '').trim(), tarikh: v.tbd ? TBD : v.tarikh };
    const n = v.tbd ? null : daysUntil(v.tarikh);
    const msg = v.tbd ? t('panel.savedTbd') : n !== null && n >= 0 ? t('panel.savedUp') : t('panel.savedPast');
    return editing?.id ? update('PANEL', editing.id, item, msg) : create('PANEL', item, msg);
  };

  return (
    <section aria-labelledby="h-panel">
      <SectionHeader
        eyebrow={t('panel.eyebrow')}
        title={<span id="h-panel">{t('panel.title')}</span>}
        desc={
          isAdmin
            ? t('panel.descAdmin')
            : t('panel.desc')
        }
        action={isAdmin && <AddButton onClick={() => openEditor(null)}>{t('panel.add')}</AddButton>}
      />

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="relative flex-1">
          <span className="sr-only">{t('panel.searchLabel')}</span>
          <Search size={17} className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-muted" />
          <input type="search" enterKeyHint="search" className="input bg-surface pe-12 ps-10" placeholder={t('panel.search')} value={q} onChange={(e) => setQ(e.target.value)} />
          {q && (
            <button className="btn-icon absolute end-0 top-1/2 -translate-y-1/2" onClick={() => setQ('')} aria-label={t('panel.clear')}><X size={17} /></button>
          )}
        </label>
        <div className="segmented" role="tablist" aria-label={t('panel.filterLabel')}>
          {[['semua', t('ui.all')], ['akan', t('panel.upcoming')], ['lepas', t('panel.past')]].map(([v, l]) => (
            <button key={v} role="tab" aria-selected={when === v} onClick={() => setWhen(v)}
              className={cx('segment sm:px-3', when === v ? 'bg-brand text-on-brand dark:text-accent' : 'text-muted hover:text-ink')}>
              {l}
            </button>
          ))}
        </div>
      </div>

      <p className="mb-3 text-[13px] font-medium text-muted">{t('panel.count', { n: rows.length })}</p>

      {rows.length === 0 ? (
        <Empty icon={Users} title={q ? t('panel.noMatch') : t('panel.none')} hint={q ? t('panel.noMatchHint', { q }) : undefined} />
      ) : (
        <ul className="card divide-y divide-line overflow-hidden">
          {rows.map((r) => (
            <li key={r.id} data-panel-id={r.id} className={cx('flex min-h-[72px] items-center gap-3 px-4 py-3 sm:gap-3.5 sm:px-5', rank(r) === 2 && 'opacity-80')}>
              <span className="grid h-10 w-10 shrink-0 place-items-center self-start rounded-full bg-brand/10 text-primary dark:bg-accent/15 sm:self-center"><UserRound size={18} /></span>
              <div className="min-w-0 flex-1">
                <p dir="auto" className="line-clamp-2 font-semibold leading-snug text-ink wrap-anywhere">{r.nama_panel}</p>
                <p dir="auto" className="mt-0.5 line-clamp-2 text-sm leading-snug text-muted wrap-anywhere">{r.tajuk}</p>
                <DateLine tarikh={r.tarikh} />
              </div>
              {isAdmin && <RowActions onEdit={() => openEditor(r)} onDelete={() => setDeleting(r)} />}
            </li>
          ))}
        </ul>
      )}

      <FormModal open={Boolean(editing)} onClose={() => setEditing(null)} title={editing?.id ? t('panel.edit') : t('panel.add')} fields={fields(t)} initial={editing} onSubmit={save} />
      <ConfirmModal
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={() => remove('PANEL', deleting.id)}
        message={`${t('panel.confirmDelete', { name: deleting?.nama_panel })}${isDated(deleting?.tarikh) ? t('panel.confirmDeleteUp') : ''}`}
      />
    </section>
  );
}
