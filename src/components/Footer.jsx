import { useRef, useState } from 'react';
import { Lock, LockOpen } from 'lucide-react';
import { useData } from '../lib/store.jsx';
import { CONFIG } from '../config.js';
import { Modal } from './ui.jsx';
import { useI18n } from '../lib/i18n.jsx';
import { Star8 } from './Pattern.jsx';

function AdminPinModal({ open, onClose }) {
  const { login, mode } = useData();
  const { t, serverError } = useI18n();
  const [pin, setPin] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      await login(pin.trim());
      setPin('');
      onClose();
    } catch (e2) {
      setErr(e2.message === 'PIN salah' ? t('pin.wrong') : serverError(e2.message));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={t('pin.title')} size="sm">
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-muted">{t('pin.intro')}</p>
        <input
          className="input min-h-12 text-center text-xl tracking-[0.5em]"
          type="password"
          inputMode="numeric"
          autoComplete="off"
          placeholder="••••"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          aria-label={t('pin.label')}
          dir="ltr"
          required
        />
        {err && <p className="text-sm font-medium text-danger">{err}</p>}
        {mode === 'mock' && <p className="text-xs text-muted">{t('pin.demo', { pin: CONFIG.MOCK_ADMIN_PIN, file: 'src/config.js' })}</p>}
        <button className="btn-gold min-h-12 w-full text-base sm:text-sm" disabled={busy || !pin}>{busy ? t('pin.checking') : t('pin.unlock')}</button>
      </form>
    </Modal>
  );
}

export function Footer() {
  const { isAdmin, logout } = useData();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const taps = useRef([]);

  const onTap = () => {
    const now = Date.now();
    taps.current = [...taps.current.filter((t) => now - t < 2500), now];
    if (taps.current.length >= 5) {
      taps.current = [];
      isAdmin ? logout() : setOpen(true);
    }
  };

  return (
    <footer className="mt-12 border-t border-line sm:mt-16">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-2 px-4 pb-4 pt-7 text-center sm:px-6 sm:py-8">
        <Star8 className="h-5 w-5 text-accent" />
        <p className="max-w-md text-[13px] leading-relaxed text-muted">
          {t('footer.about')}
        </p>
        <div className="flex items-center">
          <button onClick={onTap} data-testid="copyright" className="min-h-11 select-none px-2 text-[13px] text-muted/80" aria-label={t('footer.copyright')}>
            © {new Date().getFullYear()} <span lang="ms" dir="ltr">{CONFIG.ORG_NAME}</span>
          </button>
          <button
            onClick={() => (isAdmin ? logout() : setOpen(true))}
            className="grid h-11 w-11 place-items-center rounded-btn text-muted/40 transition hover:text-muted"
            data-testid="admin-lock"
            aria-label={isAdmin ? t('admin.logout') : t('admin.login')}
            title={isAdmin ? t('admin.logout') : t('admin')}
          >
            {isAdmin ? <LockOpen size={14} /> : <Lock size={14} />}
          </button>
        </div>
      </div>
      <AdminPinModal open={open} onClose={() => setOpen(false)} />
    </footer>
  );
}
