import { useState } from 'react';
import { ChevronDown, DatabaseZap, RefreshCw, Stethoscope, Wrench } from 'lucide-react';
import { useData } from '../lib/store.jsx';
import { useI18n } from '../lib/i18n.jsx';
import { cx } from '../lib/utils.js';

const TONE = {
  ok: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  warn: 'bg-amber-500/20 text-amber-800 dark:text-amber-300',
  bad: 'bg-danger/15 text-danger',
};

function Badge({ tone, children }) {
  return <span data-tone={tone} className={cx('chip shrink-0 font-semibold', TONE[tone])}>{children}</span>;
}

/** Admin-only utilities: clear cache + force sync, Google Sheet health check. */
export function AdminTools() {
  const { clearCache, health } = useData();
  const { t, serverError } = useI18n();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState('');
  const [report, setReport] = useState(null);
  const [err, setErr] = useState('');

  const runClear = async () => {
    setBusy('cache');
    try { await clearCache(); } finally { setBusy(''); }
  };
  const runHealth = async () => {
    setBusy('health'); setErr(''); setReport(null);
    try { setReport(await health()); } catch (e) {
      // a Code.gs deployed before this feature answers "Tindakan tidak dikenali"
      setErr(/tidak dikenali/i.test(e.message) ? t('tools.oldBackend') : serverError(e.message) || e.message);
    } finally { setBusy(''); }
  };

  const label = (tone) => t(`tools.s.${tone}`);
  const latTone = report ? (report.latency < 2000 ? 'ok' : report.latency < 5000 ? 'warn' : 'bad') : 'ok';
  const tabTone = (x) => (!x.exists ? 'bad' : x.missing.length ? 'warn' : 'ok');
  const overall = report
    ? [latTone, report.pinSet ? 'ok' : 'bad', ...report.tabs.map(tabTone)].reduce((a, b) => (a === 'bad' || b === 'bad' ? 'bad' : a === 'warn' || b === 'warn' ? 'warn' : 'ok'))
    : null;

  return (
    <div className="mx-auto max-w-6xl px-4 pb-2 sm:px-6" data-testid="admin-tools">
      <button
        className="inline-flex min-h-11 items-center gap-2 text-[13px] font-semibold text-ink"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <Wrench size={15} /> {t('tools.title')}
        <ChevronDown size={15} className={cx('transition', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="card mb-2 space-y-3 p-4 font-normal">
          <div className="flex flex-col gap-2 sm:flex-row">
            <button className="btn-ghost justify-center border border-line" onClick={runClear} disabled={Boolean(busy)}>
              {busy === 'cache' ? <RefreshCw size={16} className="animate-spin" /> : <DatabaseZap size={16} />} {t('tools.cache')}
            </button>
            <button className="btn-ghost justify-center border border-line" onClick={runHealth} disabled={Boolean(busy)}>
              {busy === 'health' ? <RefreshCw size={16} className="animate-spin" /> : <Stethoscope size={16} />} {t('tools.health')}
            </button>
          </div>
          <p className="text-xs text-muted">{t('tools.cacheHint')}</p>

          {err && <p className="flex items-center gap-2 text-sm text-danger"><Badge tone="bad">{label('bad')}</Badge> {err}</p>}

          {report && (
            <div data-testid="health-report" className="space-y-2 text-sm text-ink">
              <div className="flex flex-wrap items-center gap-2 font-semibold">
                {t('tools.overall')} <Badge tone={overall}>{label(overall)}</Badge>
              </div>
              <ul className="divide-y divide-line rounded-card border border-line">
                <li className="flex items-center justify-between gap-3 px-3 py-2">
                  <span>{t('tools.api')} <span className="text-muted" dir="ltr">({report.latency} ms)</span></span>
                  <Badge tone={latTone}>{label(latTone)}</Badge>
                </li>
                <li className="flex items-center justify-between gap-3 px-3 py-2">
                  <span>{t('tools.pin')}</span>
                  <Badge tone={report.pinSet ? 'ok' : 'bad'}>{report.pinSet ? label('ok') : t('tools.pinMissing')}</Badge>
                </li>
                {report.tabs.map((x) => (
                  <li key={x.name} data-tab={x.name} className="flex items-start justify-between gap-3 px-3 py-2">
                    <span className="min-w-0">
                      <span className="font-semibold" dir="ltr">{x.name}</span>{' '}
                      <span className="text-muted">{x.exists ? t('tools.rows', { n: x.rows }) : t('tools.noTab')}</span>
                      {x.exists && x.missing.length > 0 && (
                        <span className="block text-xs text-muted wrap-anywhere">
                          {t('tools.missing')} <span dir="ltr">{x.missing.join(', ')}</span>
                        </span>
                      )}
                    </span>
                    <Badge tone={tabTone(x)}>{label(tabTone(x))}</Badge>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted" dir="auto">
                {t('tools.meta', { v: report.version, tz: report.sheetTz })}
                {report.scriptTz !== report.sheetTz && ` · ${t('tools.tzWarn', { a: report.scriptTz, b: report.sheetTz })}`}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
