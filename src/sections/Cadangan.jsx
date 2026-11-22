import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, CircleDashed, Lightbulb, Lock, Pencil, RotateCcw, Send, ShieldCheck, Trash2 } from 'lucide-react';
import { useData } from '../lib/store.jsx';
import { cx, storage, store, todayISO } from '../lib/utils.js';
import { useI18n } from '../lib/i18n.jsx';
import { STATUS } from '../lib/schema.js';
import { ConfirmModal, Empty, FormModal, SectionHeader, useEditor } from '../components/ui.jsx';

const COOLDOWN_MS = 30_000;
const LAST_KEY = 'hph_last_cadangan';
const MAX = 1000;

const editFields = (t) => [
  { name: 'tarikh', label: t('cd.tarikh'), type: 'date', required: true },
  { name: 'catatan', label: t('cd.catatan'), type: 'textarea', rows: 5, required: true, maxLength: MAX },
];

function NewForm() {
  const { create, toast } = useData();
  const { t, tr } = useI18n();
  const [tarikh, setTarikh] = useState(todayISO);
  const [catatan, setCatatan] = useState('');
  const [hp, setHp] = useState(''); // honeypot
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (hp) return; // bot
    const text = catatan.trim();
    if (text.length < 5) return toast(t('cd.tooShort'), 'err');
    const last = storage(LAST_KEY, 0);
    const wait = Math.ceil((COOLDOWN_MS - (Date.now() - last)) / 1000);
    if (wait > 0) return toast(t('cd.wait', { s: wait }), 'err');
    setBusy(true);
    const row = await create('CADANGAN', { tarikh, catatan: text, status: STATUS.BELUM, balasan_admin: '' }, t('cd.thanks'));
    setBusy(false);
    if (row) {
      store(LAST_KEY, Date.now());
      setCatatan('');
      setTarikh(todayISO());
    }
  };

  return (
    <form onSubmit={submit} className="card relative mb-7 overflow-hidden p-4 sm:mb-8 sm:p-6">
      <div className="absolute inset-x-0 top-0 h-1 bg-accent" aria-hidden />
      <h3 className="mb-1 text-[17px] font-bold text-ink sm:text-base">{t('cd.formTitle')}</h3>
      <p className="mb-4 text-[15px] leading-relaxed text-muted sm:text-sm">{t('cd.formBody')}</p>
      <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
        <div>
          <label className="label" htmlFor="cad-tarikh">{t('cd.tarikh')}</label>
          <input id="cad-tarikh" type="date" className="input" value={tarikh} onChange={(e) => setTarikh(e.target.value)} required />
        </div>
        <div>
          <label className="label" htmlFor="cad-catatan">{t('cd.catatan')}</label>
          <textarea id="cad-catatan" rows={4} className="input resize-y" maxLength={MAX} dir="auto" placeholder={t('cd.placeholder')} value={catatan} onChange={(e) => setCatatan(e.target.value)} required />
          <p className="mt-1 text-end text-xs tabular-nums text-muted">{catatan.length}/{MAX}</p>
        </div>
      </div>
      {/* honeypot: hidden from humans */}
      <input type="text" tabIndex={-1} autoComplete="off" value={hp} onChange={(e) => setHp(e.target.value)} className="absolute -left-[9999px] h-0 w-0 opacity-0" aria-hidden="true" name="website" />
      <div className="mt-2 flex sm:justify-end">
        <button className="btn-gold w-full min-h-12 text-base sm:w-auto sm:text-sm" disabled={busy}><Send size={16} /> {busy ? t('cd.sending') : t('cd.send')}</button>
      </div>
    </form>
  );
}

function AdminReply({ item }) {
  const { update } = useData();
  const { t, tr } = useI18n();
  const [val, setVal] = useState(item.balasan_admin || '');
  useEffect(() => setVal(item.balasan_admin || ''), [item.balasan_admin]);
  const dirty = val !== (item.balasan_admin || '');
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
      <textarea
        rows={2}
        className="input flex-1 bg-surface"
        dir="auto"
        placeholder={t('cd.replyPh')}
        maxLength={2000}
        value={val}
        onChange={(e) => setVal(e.target.value)}
        aria-label={t('cd.reply')}
      />
      <button className="btn-brand w-full shrink-0 sm:w-auto" disabled={!dirty} onClick={() => update('CADANGAN', item.id, { balasan_admin: val }, t('cd.replySaved'))}>
        {t('ui.save')}
      </button>
    </div>
  );
}

function Bubble({ item, onEdit, onDelete }) {
  const { isAdmin, isMine, update } = useData();
  const { t, fmt, tr } = useI18n();
  const done = item.status === STATUS.SELESAI;
  const mine = isMine(item.id);
  const canEdit = isAdmin || (mine && !done);

  return (
    <li className={cx('overflow-hidden rounded-card border shadow-soft transition', done ? 'border-accent/50' : 'border-line')}>
      {/* User part */}
      <div className="bg-surface p-4 sm:p-5">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="text-[13px] font-semibold text-muted">{fmt.date(item.tarikh)}</span>
          {mine && <span className="chip bg-brand/10 text-primary dark:bg-accent/15">{t('cd.mine')}</span>}
          <div className="-my-2 -me-2 ms-auto flex items-center">
            {canEdit && <button className="btn-icon" onClick={onEdit} aria-label={t('cd.edit')}><Pencil size={15} /></button>}
            {mine && done && !isAdmin && <span className="inline-flex min-h-11 items-center gap-1 px-2 text-xs text-muted" title={t('cd.lockedTitle')}><Lock size={13} /> {t('cd.locked')}</span>}
            {isAdmin && <button className="btn-icon hover:!text-danger" onClick={onDelete} aria-label={t('cd.delete')}><Trash2 size={15} /></button>}
          </div>
        </div>
        <p dir="auto" className={cx('whitespace-pre-line text-base leading-relaxed text-ink wrap-anywhere sm:text-[15px]', done && 'text-ink/70')}>{tr(item, 'catatan')}</p>
      </div>

      {/* Admin part */}
      <div className={cx('border-t p-4 sm:px-5', done ? 'border-accent/40 bg-accent/10' : 'border-line bg-bg')}>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          {isAdmin ? (
            <button
              onClick={() => update('CADANGAN', item.id, { status: done ? STATUS.BELUM : STATUS.SELESAI }, done ? t('cd.markedOpen') : t('cd.markedDone'))}
              className={cx('inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-sm font-semibold transition', done ? 'border-transparent bg-accent text-on-accent' : 'border-line bg-surface text-ink hover:border-accent')}
              aria-pressed={done}
            >
              {done ? <CheckCircle2 size={17} /> : <CircleDashed size={17} />}
              {done ? t('cd.done') : t('cd.markDone')}
              {done && <RotateCcw size={14} className="ms-0.5 opacity-60" />}
            </button>
          ) : (
            <span className={cx('chip', done ? 'bg-accent text-on-accent' : 'bg-ink/5 text-muted')}>
              {done ? <CheckCircle2 size={14} /> : <CircleDashed size={14} />} {done ? t('cd.statusDone') : t('cd.statusOpen')}
            </span>
          )}
          <span className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-muted"><ShieldCheck size={13} /> {t('cd.reply')}</span>
        </div>
        {isAdmin ? (
          <AdminReply item={item} />
        ) : item.balasan_admin ? (
          <p dir="auto" className="whitespace-pre-line text-[15px] leading-relaxed text-ink wrap-anywhere sm:text-sm">{tr(item, 'balasan_admin')}</p>
        ) : (
          <p className="text-[15px] italic text-muted sm:text-sm">{t('cd.waiting')}</p>
        )}
      </div>
    </li>
  );
}

export default function Cadangan() {
  const { db, update, remove, isAdmin } = useData();
  const { t, tr } = useI18n();
  const { editing, setEditing, deleting, setDeleting } = useEditor();
  const [filter, setFilter] = useState('semua');

  const all = useMemo(
    () => [...db.CADANGAN].sort((a, b) => String(b.tarikh).localeCompare(String(a.tarikh)) || String(b.created_at).localeCompare(String(a.created_at))),
    [db.CADANGAN],
  );
  const counts = {
    semua: all.length,
    belum: all.filter((r) => r.status !== STATUS.SELESAI).length,
    selesai: all.filter((r) => r.status === STATUS.SELESAI).length,
  };
  const rows = all.filter((r) => (filter === 'semua' ? true : filter === 'selesai' ? r.status === STATUS.SELESAI : r.status !== STATUS.SELESAI));

  return (
    <section aria-labelledby="h-cadangan">
      <SectionHeader
        eyebrow={t('cd.eyebrow')}
        title={<span id="h-cadangan">{t('cd.title')}</span>}
        desc={t('cd.desc')}
      />

      <NewForm />

      <div className="segmented mb-5 sm:inline-flex" role="tablist" aria-label={t('cd.filterLabel')}>
        {[['semua', t('ui.all')], ['belum', t('cd.statusOpen')], ['selesai', t('cd.statusDone')]].map(([v, l]) => (
          <button key={v} role="tab" aria-selected={filter === v} onClick={() => setFilter(v)}
            className={cx('segment', filter === v ? 'bg-brand text-on-brand dark:text-accent' : 'text-muted hover:text-ink')}>
            {l} <span className="text-xs tabular-nums opacity-70">{counts[v]}</span>
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <Empty icon={Lightbulb} title={t('cd.empty')} hint={filter === 'semua' ? t('cd.emptyHint') : undefined} />
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2">
          {rows.map((r) => <Bubble key={r.id} item={r} onEdit={() => setEditing(r)} onDelete={() => setDeleting(r)} />)}
        </ul>
      )}

      <FormModal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={t('cd.editTitle')}
        fields={editFields(t)}
        initial={editing ? { tarikh: editing.tarikh, catatan: editing.catatan } : null}
        onSubmit={(v) => update('CADANGAN', editing.id, isAdmin ? v : { tarikh: v.tarikh, catatan: v.catatan })}
      />
      <ConfirmModal open={Boolean(deleting)} onClose={() => setDeleting(null)} onConfirm={() => remove('CADANGAN', deleting.id)} message={t('cd.deleteConfirm')} />
    </section>
  );
}
