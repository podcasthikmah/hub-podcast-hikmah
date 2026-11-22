import { useEffect, useState } from 'react';
import { CloudOff, Moon, RefreshCw, ShieldCheck, Sun, Check } from 'lucide-react';
import { useData } from '../lib/store.jsx';
import { useI18n } from '../lib/i18n.jsx';
import { cx } from '../lib/utils.js';
import { Star8 } from './Pattern.jsx';
import { TABS } from './nav.js';

function useTheme() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    // Keep the browser/status-bar colour in sync with a manual toggle.
    document.querySelectorAll('meta[name="theme-color"]').forEach((m) => {
      m.setAttribute('content', dark ? '#081C15' : '#0F4C3A');
      m.removeAttribute('media');
    });
  }, [dark]);
  const toggle = () =>
    setDark((d) => {
      try { localStorage.setItem('hph_theme', d ? 'light' : 'dark'); } catch { /* noop */ }
      return !d;
    });
  return [dark, toggle];
}

/** BM | عربي pill. Each option is a full 44px target; the active one is filled. */
export function LangToggle() {
  const { lang, setLang, t } = useI18n();
  const opts = [['ms', 'BM', 'Bahasa Melayu'], ['ar', 'عربي', 'العربية']];
  return (
    <div role="group" aria-label={t('lang.switch')} className="mx-0.5 flex h-12 shrink-0 items-center rounded-full border border-line bg-surface p-0.5">
      {opts.map(([code, label, name]) => (
        <button
          key={code}
          type="button"
          lang={code}
          dir={code === 'ar' ? 'rtl' : 'ltr'}
          onClick={() => setLang(code)}
          aria-pressed={lang === code}
          aria-label={name}
          data-lang-option={code}
          className={cx(
            'h-11 min-w-11 rounded-full px-2.5 text-[13px] font-bold leading-none transition',
            code === 'ar' && 'font-ui_ar text-[14px]',
            lang === code ? 'bg-brand text-on-brand shadow-sm dark:text-accent dark:ring-1 dark:ring-accent/40' : 'text-muted hover:text-ink',
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export function SyncBadge() {
  const { syncing, error, lastSync, mode, refresh } = useData();
  const { t, lang } = useI18n();
  const time = lastSync ? new Date(lastSync).toLocaleTimeString(lang === 'ar' ? 'ar-u-nu-latn' : 'ms-MY', { hour: '2-digit', minute: '2-digit' }) : null;
  let icon, text, tone;
  if (syncing) { icon = <RefreshCw size={13} className="animate-spin" />; text = t('sync.syncing'); tone = 'text-muted'; }
  else if (error) { icon = <CloudOff size={13} />; text = t('sync.offline'); tone = 'text-accent'; }
  else { icon = <Check size={13} />; text = time ? t('sync.updated', { time }) : t('sync.ready'); tone = 'text-muted'; }
  return (
    <button
      onClick={() => refresh({ silent: false })}
      title={error ? t('sync.errorTitle', { error }) : t('sync.retryTitle')}
      className={cx('hidden min-h-11 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium hover:bg-ink/5 sm:inline-flex', tone)}
    >
      {icon}<span className={cx('whitespace-nowrap', !error && 'lg:hidden 2xl:inline')}>{text}</span>
      {mode === 'mock' && <span className="ms-1 rounded-full bg-accent/20 px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-ink">{t('demo')}</span>}
    </button>
  );
}

export function Header({ tab, setTab }) {
  const [dark, toggle] = useTheme();
  const { isAdmin, logout, syncing, error, refresh } = useData();
  const { t } = useI18n();

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/85 backdrop-blur-md supports-[backdrop-filter]:bg-bg/75">
      <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2 sm:px-6 lg:gap-3 lg:py-3">
        <a href="#upcoming" onClick={() => setTab('upcoming')} className="flex min-h-11 min-w-0 items-center gap-2.5 rounded-btn">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[11px] bg-brand text-accent dark:border dark:border-accent/40">
            <Star8 className="h-5 w-5" />
          </span>
          <span className="min-w-0 leading-tight">
            {/* phones: brand wraps to 2 lines instead of being cut off; tagline from sm up */}
            <span lang="en" dir="ltr" className="line-clamp-2 block text-[14px] font-extrabold leading-[1.15] tracking-tight text-ink rtl:text-end sm:truncate sm:text-[15px] sm:leading-tight">HUB PODCAST HIKMAH</span>
            <span className="hidden truncate text-xs font-medium text-muted sm:block">{t('app.tagline')}</span>
          </span>
        </a>

        {/* Desktop navigation (mobile/tablet uses the bottom tab bar) */}
        <nav className="ms-auto hidden items-center gap-0.5 lg:flex" aria-label={t('nav.aria')}>
          {TABS.map((tb) => (
            <a
              key={tb.id}
              href={`#${tb.id}`}
              onClick={() => setTab(tb.id)}
              aria-current={tab === tb.id ? 'page' : undefined}
              className={cx(
                'flex min-h-11 items-center whitespace-nowrap rounded-btn px-2.5 text-[13px] font-semibold transition xl:px-3',
                tab === tb.id ? 'bg-brand text-on-brand dark:text-accent dark:ring-1 dark:ring-accent/40' : 'text-muted hover:bg-ink/5 hover:text-ink',
              )}
            >
              {t(`nav.${tb.id}`)}
            </a>
          ))}
        </nav>

        <div className="ms-auto flex shrink-0 items-center lg:ms-2">
          {error && !syncing ? (
            <button className="btn-icon text-accent sm:hidden" onClick={() => refresh({ silent: false })} aria-label={t('sync.offlineRetry')}>
              <CloudOff size={19} />
            </button>
          ) : (
            <span className={cx('mx-1 h-2 w-2 rounded-full sm:hidden', syncing ? 'animate-pulse bg-accent' : 'bg-transparent')} aria-hidden />
          )}
          <SyncBadge />
          {isAdmin && (
            <button onClick={logout} data-testid="admin-chip" className="hit hidden min-w-11 justify-center px-0.5 sm:inline-flex" title={t('admin.logout')} aria-label={t('admin.logout')}>
              {/* icon-only below sm to leave room for the language pill */}
              <span className="chip bg-accent py-1.5 text-on-accent hover:brightness-105">
                <ShieldCheck size={15} /><span className="hidden sm:inline">{t('admin')}</span>
              </span>
            </button>
          )}
          <LangToggle />
          <button className="btn-icon" onClick={toggle} aria-label={dark ? t('theme.light') : t('theme.dark')}>
            {dark ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </div>
      </div>
    </header>
  );
}
