import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api } from './api.js';
import { emptyDB, TRANSLATED } from './schema.js';
import { buildSeed } from './seed.js';
import { storage, store, uid } from './utils.js';
import { useI18n } from './i18n.jsx';

const CACHE_KEY = 'hph_cache_v1';
const MINE_KEY = 'hph_my_cadangan';   // { [id]: ownerKey }
const PIN_KEY = 'hph_admin_pin';      // sessionStorage only

const DataCtx = createContext(null);
const ToastCtx = createContext(() => {});

export const useData = () => useContext(DataCtx);
export const useToast = () => useContext(ToastCtx);

function readPin() {
  try { return sessionStorage.getItem(PIN_KEY) || ''; } catch { return ''; }
}

export function DataProvider({ children }) {
  const { t, serverError, lang } = useI18n();
  // refresh() reads t via a ref so a language switch doesn't recreate it (and re-fetch).
  const tRef = useRef(t);
  tRef.current = t;
  // Stale-while-revalidate: render cached JSON instantly (or seed on very first mock run).
  const cached = storage(CACHE_KEY, null);
  const [db, setDb] = useState(() => cached?.data || (api.mode === 'mock' ? buildSeed() : emptyDB()));
  const [lastSync, setLastSync] = useState(cached?.at || null);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState(null);
  const [hasData, setHasData] = useState(Boolean(cached?.data) || api.mode === 'mock');
  const [pin, setPin] = useState(readPin);
  const [mine, setMine] = useState(() => storage(MINE_KEY, {}));
  const [toasts, setToasts] = useState([]);
  const pending = useRef(0);

  const toast = useCallback((msg, type = 'ok') => {
    const id = uid();
    setToasts((t) => [...t, { id, msg, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);

  const refresh = useCallback(async ({ silent = true } = {}) => {
    setSyncing(true);
    try {
      const data = await api.getAll();
      const merged = { ...emptyDB(), ...data };
      // Don't clobber optimistic state while writes are in flight.
      if (pending.current === 0) setDb(merged);
      const at = new Date().toISOString();
      store(CACHE_KEY, { data: merged, at });
      setLastSync(at);
      setHasData(true);
      setError(null);
      return true;
    } catch (e) {
      setError(e.message || 'Gagal menyegerak');
      if (!silent) toast(tRef.current('toast.syncFailed'), 'err');
      return false;
    } finally {
      setSyncing(false);
    }
  }, [toast]);

  useEffect(() => {
    refresh();
    const onFocus = () => document.visibilityState === 'visible' && refresh();
    document.addEventListener('visibilitychange', onFocus);
    return () => document.removeEventListener('visibilitychange', onFocus);
  }, [refresh]);

  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  const dropPin = () => {
    try { sessionStorage.removeItem(PIN_KEY); } catch { /* noop */ }
    setPin('');
  };

  /** Rows created optimistically carry a temp id until the server answers. */
  const notReady = (...ids) => {
    if (ids.flat().some((id) => String(id).startsWith('tmp_'))) {
      toast(t('toast.wait'), 'err');
      return true;
    }
    return false;
  };

  const persistLocal = (next) => store(CACHE_KEY, { data: next, at: lastSync });

  /** Optimistic mutation: apply locally, call backend, reconcile. */
  const mutate = useCallback(async (optimistic, payload, okMsg) => {
    let snapshot;
    let failed = false;
    setDb((cur) => {
      snapshot = cur;
      const next = optimistic(cur);
      persistLocal(next);
      return next;
    });
    pending.current += 1;
    setSyncing(true);
    try {
      const res = await api.post({ ...payload, pin: pin || undefined });
      if (okMsg) toast(okMsg);
      return res;
    } catch (e) {
      setDb(snapshot);
      persistLocal(snapshot);
      toast(serverError(e.message) || t('toast.unexpected'), 'err');
      failed = true;
      if (e.message === 'PIN salah') dropPin(); // PIN changed on server -> leave admin mode
      return null; // callers treat null as failure
    } finally {
      pending.current -= 1;
      setSyncing(false);
      // Other optimistic writes may have succeeded server-side after our snapshot: re-sync.
      if (failed && pending.current === 0) setTimeout(() => refreshRef.current(), 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin, toast, lastSync, serverError, t]);

  const replaceRow = (sheet, tempId, row) =>
    setDb((cur) => {
      const next = { ...cur, [sheet]: cur[sheet].map((r) => (r.id === tempId ? row : r)) };
      persistLocal(next);
      return next;
    });

  /** A live row saved without any `_ar` key means the deployed Code.gs predates auto-translation. */
  const checkTranslated = (sheet, row) => {
    if (api.mode === 'mock' || !row || !TRANSLATED[sheet]) return;
    if (TRANSLATED[sheet].some((f) => String(row[f] || '').trim() && !(`${f}_ar` in row))) toast(t('toast.oldBackend'), 'err');
  };

  const actions = useMemo(() => ({
    async create(sheet, item, msg = t('toast.added')) {
      const tempId = uid('tmp_');
      const isPublicCad = sheet === 'CADANGAN';
      const ownerKey = isPublicCad ? uid('k_') + uid() : undefined;
      const row = await mutate(
        (cur) => ({ ...cur, [sheet]: [...cur[sheet], { ...item, id: tempId }] }),
        { action: 'create', sheet, item, ownerKey },
        msg,
      );
      if (!row) return null;
      replaceRow(sheet, tempId, row);
      checkTranslated(sheet, row);
      if (isPublicCad && row?.id) {
        setMine((m) => {
          const n = { ...m, [row.id]: ownerKey };
          store(MINE_KEY, n);
          return n;
        });
      }
      return row;
    },
    async update(sheet, id, patch, msg = t('toast.saved')) {
      if (notReady(id)) return null;
      const row = await mutate(
        (cur) => ({ ...cur, [sheet]: cur[sheet].map((r) => (r.id === id ? { ...r, ...patch } : r)) }),
        { action: 'update', sheet, id, patch, ownerKey: mine[id] },
        msg,
      );
      if (row?.id) { replaceRow(sheet, id, row); checkTranslated(sheet, row); }
      return row;
    },
    remove(sheet, id) {
      if (notReady(id)) return Promise.resolve(null);
      return mutate(
        (cur) => ({ ...cur, [sheet]: cur[sheet].filter((r) => r.id !== id) }),
        { action: 'delete', sheet, id },
        t('toast.deleted'),
      );
    },
    reorder(sheet, ids) {
      if (!ids || notReady(ids)) return Promise.resolve(null);
      return mutate(
        (cur) => ({
          ...cur,
          [sheet]: cur[sheet].map((r) => {
            const i = ids.indexOf(r.id);
            return i >= 0 ? { ...r, order: i + 1 } : r;
          }),
        }),
        { action: 'reorder', sheet, ids },
      );
    },
    increment(sheet, id, delta) {
      if (notReady(id)) return Promise.resolve(null);
      return mutate(
        (cur) => ({
          ...cur,
          [sheet]: cur[sheet].map((r) =>
            r.id === id ? { ...r, bilangan: Math.max(0, (Number(r.bilangan) || 0) + delta) } : r,
          ),
        }),
        { action: 'increment', sheet, id, delta },
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [mutate, mine, t]);

  const login = useCallback(async (p) => {
    await api.post({ action: 'verifyPin', pin: p });
    try { sessionStorage.setItem(PIN_KEY, p); } catch { /* noop */ }
    setPin(p);
    toast(t('toast.adminOn'));
  }, [toast, t]);

  const logout = useCallback(() => {
    dropPin();
    toast(t('toast.adminOff'));
  }, [toast, t]);

  /** Admin tool: wipe the app's cached data (keeps language, admin session & "my suggestions"), then refetch. */
  const clearCache = useCallback(async () => {
    try { localStorage.removeItem(CACHE_KEY); } catch { /* noop */ }
    setLastSync(null);
    const ok = await refresh({ silent: false });
    if (ok) toast(t('tools.cacheDone', { time: new Date().toLocaleTimeString(lang === 'ar' ? 'ar' : 'ms-MY', { hour: 'numeric', minute: '2-digit', second: '2-digit' }) }));
    return ok;
  }, [refresh, toast, t, lang]);

  /** Admin tool: backend health report + round-trip latency. */
  const health = useCallback(async () => {
    const t0 = performance.now();
    const data = await api.post({ action: 'health', pin });
    return { ...data, latency: Math.round(performance.now() - t0) };
  }, [pin]);

  const value = {
    db, syncing, error, lastSync, hasData, mode: api.mode,
    isAdmin: Boolean(pin), login, logout,
    isMine: (id) => Boolean(mine[id]),
    refresh, toast, clearCache, health, ...actions,
  };

  return (
    <ToastCtx.Provider value={toast}>
      <DataCtx.Provider value={value}>
        {children}
        {/* Top of screen: bottom sheets keep their action buttons at the bottom edge. */}
        <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex flex-col items-center gap-2 px-4 pt-[max(0.75rem,env(safe-area-inset-top))]">
          {toasts.map((t) => (
            <div
              key={t.id}
              role="status"
              className={`animate-fade-up max-w-sm rounded-btn px-4 py-2.5 text-sm font-medium shadow-soft ${
                t.type === 'err' ? 'bg-danger text-white' : 'bg-ink text-bg'
              }`}
            >
              {t.msg}
            </div>
          ))}
        </div>
      </DataCtx.Provider>
    </ToastCtx.Provider>
  );
}
