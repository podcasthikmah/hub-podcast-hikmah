import { useCallback, useEffect, useRef, useState } from 'react';
import { Header } from './components/Header.jsx';
import { BottomNav } from './components/BottomNav.jsx';
import { Hero } from './components/Hero.jsx';
import { Footer } from './components/Footer.jsx';
import { StarPattern } from './components/Pattern.jsx';
import { useData } from './lib/store.jsx';
import { useI18n } from './lib/i18n.jsx';
import Upcoming from './sections/Upcoming.jsx';
import PanelList from './sections/PanelList.jsx';
import Panduan from './sections/Panduan.jsx';
import Peringatan from './sections/Peringatan.jsx';
import Kitab from './sections/Kitab.jsx';
import Youtube from './sections/Youtube.jsx';
import Cadangan from './sections/Cadangan.jsx';

const SECTIONS = { upcoming: Upcoming, panel: PanelList, panduan: Panduan, peringatan: Peringatan, kitab: Kitab, youtube: Youtube, cadangan: Cadangan };
const fromHash = () => {
  const h = window.location.hash.replace('#', '');
  return SECTIONS[h] ? h : 'upcoming';
};

export default function App() {
  const [tab, setTabState] = useState(fromHash);
  const contentRef = useRef(null);
  const { isAdmin, mode, hasData, error, syncing, refresh, logout } = useData();
  const { t, lang } = useI18n();

  useEffect(() => {
    const onHash = () => setTabState(fromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const setTab = useCallback((id, { scroll = false } = {}) => {
    setTabState(id);
    if (window.location.hash !== `#${id}`) history.replaceState(null, '', `#${id}`);
    if (scroll === 'top') window.scrollTo({ top: 0, behavior: 'instant' }); // tab switch = fresh screen
    else if (scroll) requestAnimationFrame(() => contentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }, []);

  const Section = SECTIONS[tab];
  const title = t(`nav.${tab}.full`);
  useEffect(() => { document.title = `${title} · Hub Podcast Hikmah`; }, [title, lang]);

  return (
    // bottom padding = tab bar (64px) + home-indicator safe area on phones/tablets
    <div className="relative min-h-dvh pb-[calc(64px+env(safe-area-inset-bottom))] lg:pb-0">
      {/* page-wide watermark (gold, 4%) */}
      <div className="pointer-events-none fixed inset-0 -z-10 text-accent"><StarPattern id="page-star" opacity={0.04} /></div>

      <Header tab={tab} setTab={setTab} />

      {isAdmin && (
        <div data-testid="admin-banner" className="border-b border-accent/30 bg-accent/15 text-[13px] font-semibold text-ink">
          <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-1 sm:px-6 sm:py-2">
            <p className="flex-1 sm:text-center">{t('admin.banner')}</p>
            {/* phones: the header chip is hidden to save space, so logout lives here */}
            <button onClick={logout} className="btn-ghost min-h-11 shrink-0 bg-surface px-3 sm:hidden" title={t('admin.logout')}>
              {t('admin.logoutShort')}
            </button>
          </div>
        </div>
      )}

      <main className="mx-auto max-w-6xl px-4 pt-4 sm:px-6 sm:pt-8">
        <Hero compact={tab !== 'upcoming'} goTo={(id, opts) => setTab(id, opts || { scroll: true })} />
        <div ref={contentRef} className="scroll-mt-20 pt-7 sm:pt-12 lg:scroll-mt-24">
          {hasData ? (
            <div key={tab} className="animate-fade-up">
              <Section />
            </div>
          ) : error && !syncing ? (
            <div className="card flex flex-col items-center gap-3 px-6 py-12 text-center">
              <p className="font-semibold text-ink">{t('load.failed')}</p>
              <p className="max-w-sm text-sm text-muted">{error}</p>
              <button className="btn-gold" onClick={() => refresh({ silent: false })}>{t('load.retry')}</button>
            </div>
          ) : (
            <div className="space-y-4" aria-busy="true" aria-label={t('load.loading')}>
              <div className="h-7 w-48 animate-pulse rounded bg-line" />
              <div className="grid gap-4 md:grid-cols-2">
                {[0, 1, 2, 3].map((i) => <div key={i} className="h-40 animate-pulse rounded-card bg-line/70" />)}
              </div>
            </div>
          )}
        </div>
        {mode === 'mock' && (
          <p className="mt-10 rounded-btn border border-dashed border-line px-4 py-3 text-center text-xs text-muted">
            {t('mock.notice', { file: 'src/config.js' })}
          </p>
        )}
      </main>
      <Footer />
      <BottomNav tab={tab} setTab={setTab} />
    </div>
  );
}
