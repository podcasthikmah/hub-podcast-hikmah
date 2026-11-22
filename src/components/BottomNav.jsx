import { useState } from 'react';
import { ChevronRight, LayoutGrid } from 'lucide-react';
import { cx } from '../lib/utils.js';
import { PRIMARY, TABS } from './nav.js';
import { Modal } from './ui.jsx';
import { useI18n } from '../lib/i18n.jsx';

function Item({ t, active, onClick, className = '', label }) {
  const { t: tr } = useI18n();
  const Icon = t.icon;
  return (
    <a
      href={`#${t.id}`}
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={cx(
        'group flex min-h-[56px] min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 pt-1.5 text-xs font-semibold transition',
        active ? 'text-primary' : 'text-muted active:text-ink',
        className,
      )}
    >
      <span className={cx('grid h-8 w-14 place-items-center rounded-full transition', active ? 'bg-brand/10 dark:bg-accent/15' : 'group-active:bg-ink/5')}>
        <Icon size={21} strokeWidth={active ? 2.3 : 1.9} />
      </span>
      <span className="max-w-full truncate leading-none">{label || tr(`nav.${t.id}.short`)}</span>
    </a>
  );
}

/** Thumb-reachable tab bar for phones & tablets (hidden on desktop, which uses the header nav). */
export function BottomNav({ tab, setTab }) {
  const [more, setMore] = useState(false);
  const { t: tr } = useI18n();
  const primary = TABS.filter((t) => PRIMARY.includes(t.id));
  const extra = TABS.filter((t) => !PRIMARY.includes(t.id));
  const activeExtra = extra.find((t) => t.id === tab);
  const go = (id) => { setTab(id, { scroll: 'top' }); setMore(false); };

  return (
    <>
      <nav
        aria-label={tr('nav.aria')}
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md supports-[backdrop-filter]:bg-bg/80 lg:hidden"
      >
        <div className="mx-auto flex max-w-3xl items-stretch px-1">
          {/* phones: 4 primary + Lagi */}
          {primary.map((t) => (
            <Item key={t.id} t={t} active={tab === t.id} onClick={(e) => { e.preventDefault(); go(t.id); }} className="md:hidden" />
          ))}
          <button
            type="button"
            onClick={() => setMore(true)}
            aria-haspopup="dialog"
            aria-current={activeExtra ? 'page' : undefined}
            className={cx(
              'group flex min-h-[56px] min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 pt-1.5 text-xs font-semibold transition md:hidden',
              activeExtra ? 'text-primary' : 'text-muted',
            )}
          >
            <span className={cx('grid h-8 w-14 place-items-center rounded-full', activeExtra ? 'bg-brand/10 dark:bg-accent/15' : 'group-active:bg-ink/5')}>
              {activeExtra ? <activeExtra.icon size={21} strokeWidth={2.3} /> : <LayoutGrid size={21} strokeWidth={1.9} />}
            </span>
            <span className="max-w-full truncate leading-none">{activeExtra ? tr(`nav.${activeExtra.id}.short`) : tr('nav.more')}</span>
          </button>
          {/* tablets: all sections */}
          {TABS.map((t) => (
            <Item key={`md-${t.id}`} t={t} active={tab === t.id} onClick={(e) => { e.preventDefault(); go(t.id); }} className="hidden md:flex" />
          ))}
        </div>
      </nav>

      <Modal open={more} onClose={() => setMore(false)} title={tr('nav.moreTitle')}>
        <ul className="-mx-2 -my-2 space-y-1">
          {extra.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <li key={t.id}>
                <a
                  href={`#${t.id}`}
                  onClick={(e) => { e.preventDefault(); go(t.id); }}
                  aria-current={active ? 'page' : undefined}
                  className={cx('flex min-h-[64px] items-center gap-3.5 rounded-btn px-2 py-2 transition active:bg-ink/5', active && 'bg-brand/5 dark:bg-accent/10')}
                >
                  <span className={cx('grid h-11 w-11 shrink-0 place-items-center rounded-btn', active ? 'bg-brand text-accent' : 'bg-accent/15 text-primary')}>
                    <Icon size={21} strokeWidth={1.9} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-ink">{tr(`nav.${t.id}.full`)}</span>
                    <span className="block truncate text-sm text-muted">{tr(`nav.${t.id}.desc`)}</span>
                  </span>
                  <ChevronRight size={18} className="flip-rtl shrink-0 text-muted" />
                </a>
              </li>
            );
          })}
        </ul>
      </Modal>
    </>
  );
}
