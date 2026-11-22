import { useMemo, useState } from 'react';
import { ArrowRight, CalendarDays, Check, Clock, Copy, Users } from 'lucide-react';
import { useData } from '../lib/store.jsx';
import { copyText, cx, daysUntil, parseISO } from '../lib/utils.js';
import { useI18n } from '../lib/i18n.jsx';
import { deriveSchedule } from '../lib/schedule.js';
import { buildWaMessage } from '../lib/wa.js';
import { Empty, SectionHeader } from '../components/ui.jsx';

/** Admin-only: the component itself refuses to render for public users, wherever it is placed. */
function CopyWa({ item }) {
  const [done, setDone] = useState(false);
  const { toast, isAdmin } = useData();
  const { t, lang, fmt, tr } = useI18n();
  if (!isAdmin) return null;
  const onCopy = async () => {
    const ok = await copyText(buildWaMessage(item, { lang, fmt, tr })); // message follows the UI language
    if (ok) {
      setDone(true);
      toast(t('wa.toast'));
      setTimeout(() => setDone(false), 2000);
    } else toast(t('wa.failed'), 'err');
  };
  return (
    <button onClick={onCopy} className={cx('btn-ghost w-full sm:w-auto', done && 'border-accent text-primary')}>
      {done ? <Check size={16} /> : <Copy size={16} />} {done ? t('wa.copied') : t('wa.copy')}
    </button>
  );
}

/** Jumps to List Panel, where the schedule is managed. */
function ManageLink({ className = '' }) {
  const { t, tr } = useI18n();
  return (
    <a
      href="#panel"
      onClick={() => window.scrollTo({ top: 0, behavior: 'instant' })}
      className={cx('btn-ghost self-start sm:self-auto', className)}
    >
      {t('up.manage')} <ArrowRight size={16} className="flip-rtl" />
    </a>
  );
}

/**
 * Read-only schedule derived from LIST PANEL (single source of truth):
 * dated entries from today onward, grouped by tajuk + tarikh, nearest first.
 */
export default function Upcoming() {
  const { db, isAdmin } = useData();
  const { t, fmt, lang, tr } = useI18n();
  const rows = useMemo(() => deriveSchedule(db.PANEL), [db.PANEL]);

  return (
    <section aria-labelledby="h-upcoming">
      <SectionHeader
        eyebrow={t('up.eyebrow')}
        title={<span id="h-upcoming">{t('up.title')}</span>}
        desc={
          isAdmin
            ? t('up.descAdmin')
            : t('up.desc')
        }
        action={isAdmin && <ManageLink />}
      />

      {rows.length === 0 ? (
        <Empty
          icon={CalendarDays}
          title={t('up.emptyTitle')}
          hint={isAdmin ? t('up.emptyAdmin') : t('up.empty')}
        />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {rows.map((r) => {
            const d = parseISO(r.tarikh);
            const n = daysUntil(r.tarikh);
            return (
              <li key={r.id} data-slot={r.id} className="card relative flex flex-col gap-4 p-4 sm:p-5">
                <div className="flex gap-3.5 sm:gap-4">
                  <div className="flex w-[64px] shrink-0 flex-col items-center justify-center self-start rounded-btn border border-accent/40 bg-accent/10 py-2 text-center">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted">{lang === 'ar' ? fmt.hari(r.tarikh) : fmt.hari(r.tarikh).slice(0, 3)}</span>
                    <span className="text-2xl font-extrabold leading-none text-primary">{d.getDate()}</span>
                    <span className="text-xs font-semibold text-muted">{lang === 'ar' ? fmt.monthShort(r.tarikh) : `${fmt.monthShort(r.tarikh)} ${String(d.getFullYear()).slice(2)}`}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="mb-1.5 flex flex-wrap items-center gap-2">
                      <span className={cx('chip', n <= 3 ? 'bg-accent text-on-accent' : 'bg-brand/10 text-primary dark:bg-accent/15')}>
                        {fmt.relative(r.tarikh)}
                      </span>
                      <span className="text-[13px] font-medium text-muted">{fmt.hari(r.tarikh)}</span>
                      {r.masa && (
                        <span data-testid="slot-masa" className="inline-flex items-center gap-1 text-[13px] font-semibold text-primary">
                          <Clock size={13} /> {fmt.masa(r.masa)}
                        </span>
                      )}
                    </div>
                    <h3 dir="auto" className="text-[17px] font-bold leading-snug text-ink wrap-anywhere sm:text-base">{tr(r, 'tajuk')}</h3>
                    <p className="mt-1.5 flex items-start gap-1.5 text-[15px] leading-snug text-muted wrap-anywhere sm:text-sm">
                      <Users size={15} className="mt-0.5 shrink-0" />
                      <span dir="auto" data-testid="slot-panel">{tr(r, 'panel')}</span>
                    </p>
                  </div>
                </div>
                {/* Admin-only footer: Salin Info WA. Public cards end at the content. */}
                {isAdmin && (
                  <div className="mt-auto border-t border-line pt-3.5">
                    <CopyWa item={r} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
