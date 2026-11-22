import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowDown, ArrowUp, Pencil, Trash2, X, Plus, Inbox } from 'lucide-react';
import { cx } from '../lib/utils.js';
import { useI18n } from '../lib/i18n.jsx';

export function Modal({ open, onClose, title, children, footer, size = 'md' }) {
  const { t } = useI18n();
  const ref = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  // Depend on `open` only: parents pass inline onClose, and re-running this effect
  // on every parent render would steal focus back to the first field mid-typing.
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement;
    const onKey = (e) => e.key === 'Escape' && closeRef.current();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    const t = setTimeout(() => {
      const panel = ref.current;
      if (!panel) return;
      // Touch devices: focus the sheet itself. Programmatically focusing an input on iOS
      // scrolls the visual viewport and can push the sheet off-screen.
      const touch = window.matchMedia?.('(pointer: coarse)').matches;
      const field = panel.querySelector('[data-modal-body] input:not([type=hidden]),[data-modal-body] textarea,[data-modal-body] select');
      (touch || !field ? panel : field).focus({ preventScroll: true });
    }, 30);
    return () => {
      clearTimeout(t);
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      prev?.focus?.({ preventScroll: true });
    };
  }, [open]);
  if (!open) return null;
  // Portal to <body>: an ancestor with transform/filter/animation would otherwise become the
  // containing block for position:fixed (Safari), shrinking the overlay to that ancestor.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 touch-none bg-black/45 backdrop-blur-[2px]" onClick={onClose} />
      <div
        ref={ref}
        tabIndex={-1}
        className={cx(
          'animate-fade-up relative flex max-h-[min(92dvh,100%)] w-full flex-col overflow-hidden rounded-t-[20px] border border-line bg-surface shadow-2xl outline-none sm:rounded-card',
          size === 'sm' ? 'sm:max-w-sm' : 'sm:max-w-lg',
        )}
      >
        {/* grab handle: visual cue that this is a bottom sheet (mobile) */}
        <div aria-hidden className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-line sm:hidden" />
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-line py-1.5 pl-5 pr-2 sm:py-2.5">
          <h3 className="min-w-0 text-[17px] font-bold text-ink sm:text-base">{title}</h3>
          <button className="btn-icon" onClick={onClose} aria-label={t('ui.close')}><X size={20} /></button>
        </div>
        <div data-modal-body className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 [-webkit-overflow-scrolling:touch]">{children}</div>
        {footer && (
          // Mobile: full-width split buttons within thumb reach; desktop: right-aligned.
          <div className="flex shrink-0 gap-2.5 border-t border-line px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:justify-end sm:px-5 [&>*]:flex-1 sm:[&>*]:flex-none">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

/**
 * Generic form modal. fields: [{ name, label, type: text|textarea|date|url|number|select, required, placeholder, help, options, dir }]
 * onSubmit(values) -> truthy to close.
 */
export function FormModal({ open, onClose, title, fields, initial, onSubmit, submitLabel, onChange }) {
  const { t } = useI18n();
  const [values, setValues] = useState(() => ({ ...(initial || {}) }));
  const [busy, setBusy] = useState(false);
  // Load `initial` the moment the modal opens, during render (not in an effect), so the
  // very first frame already shows the right values — an effect would paint stale/empty
  // values first and could overwrite a change made in that instant.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setValues({ ...(initial || {}) });
  }

  const set = (name, v) =>
    setValues((cur) => {
      const next = { ...cur, [name]: v };
      return onChange ? onChange(next, name) : next;
    });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    const ok = await onSubmit(values);
    setBusy(false);
    if (ok) onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <button type="button" className="btn-ghost" onClick={onClose}>{t('ui.cancel')}</button>
          <button type="submit" form="form-modal" className="btn-gold" disabled={busy}>{busy ? t('ui.saving') : submitLabel || t('ui.save')}</button>
        </>
      }
    >
      <form id="form-modal" onSubmit={submit} className="space-y-4">
        {fields.map((f) => {
          // Optional per-field rules that depend on the other values (e.g. a checkbox that
          // turns a date field off): disabledWhen(values) / requiredWhen(values).
          const disabled = f.disabledWhen ? f.disabledWhen(values) : false;
          const required = disabled ? false : f.requiredWhen ? f.requiredWhen(values) : f.required;
          if (f.type === 'checkbox') {
            return (
              <div key={f.name} className="-mt-1">
                <label
                  htmlFor={`f-${f.name}`}
                  className={cx(
                    'flex min-h-12 cursor-pointer items-center gap-3 rounded-btn border px-3.5 py-2.5 transition',
                    values[f.name] ? 'border-accent bg-accent/10' : 'border-line bg-bg hover:border-accent/60',
                  )}
                >
                  <input
                    id={`f-${f.name}`}
                    name={f.name}
                    type="checkbox"
                    className="h-5 w-5 shrink-0 cursor-pointer rounded accent-brand dark:accent-accent"
                    checked={Boolean(values[f.name])}
                    onChange={(e) => set(f.name, e.target.checked)}
                  />
                  <span className="min-w-0">
                    <span className="block text-[15px] font-semibold text-ink sm:text-sm">{f.label}</span>
                    {f.help && <span className="block text-[13px] text-muted sm:text-xs">{f.help}</span>}
                  </span>
                </label>
              </div>
            );
          }
          const common = {
            id: `f-${f.name}`,
            name: f.name,
            required,
            disabled,
            'aria-disabled': disabled || undefined,
            placeholder: f.placeholder,
            value: values[f.name] ?? '',
            onChange: (e) => set(f.name, e.target.value),
            className: cx('input', f.dir === 'rtl' && 'arabic text-right text-lg', disabled && 'cursor-not-allowed opacity-50'),
            dir: f.dir || (f.type === 'url' ? 'ltr' : undefined), // links always read LTR
            maxLength: f.maxLength,
          };
          return (
            <div key={f.name}>
              <label className={cx('label', disabled && 'opacity-50')} htmlFor={common.id}>
                {f.label} {required && <span className="text-accent">*</span>}
              </label>
              {f.type === 'textarea' ? (
                <textarea rows={f.rows || 4} {...common} />
              ) : f.type === 'select' ? (
                <select {...common}>
                  {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              ) : (
                <input type={f.type || 'text'} min={f.min} {...common} />
              )}
              {f.help && <p className="mt-1.5 text-xs text-muted">{f.help}</p>}
              {f.preview && f.preview(values)}
            </div>
          );
        })}
      </form>
    </Modal>
  );
}

export function ConfirmModal({ open, onClose, onConfirm, title, message }) {
  const { t } = useI18n();
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title || t('ui.confirmTitle')}
      size="sm"
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>{t('ui.cancel')}</button>
          <button className="btn bg-danger text-white hover:brightness-110" onClick={() => { onConfirm(); onClose(); }}>{t('ui.delete')}</button>
        </>
      }
    >
      <p className="text-sm text-muted">{message || t('ui.confirmBody')}</p>
    </Modal>
  );
}

export function SectionHeader({ eyebrow, title, desc, action }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && <p className="mb-1 text-xs font-bold uppercase tracking-[0.18em] text-primary">{eyebrow}</p>}
        <h2 className="section-title">{title}</h2>
        {desc && <p className="mt-1.5 max-w-xl text-sm text-muted">{desc}</p>}
      </div>
      {action}
    </div>
  );
}

export function AddButton({ onClick, children }) {
  const { t } = useI18n();
  return (
    <button className="btn-gold self-start sm:self-auto" onClick={onClick}>
      <Plus size={16} strokeWidth={2.4} /> {children || t('ui.add')}
    </button>
  );
}

/** Admin inline toolbar: edit / delete / move. */
export function RowActions({ onEdit, onDelete, onUp, onDown, className = '', tone = 'default' }) {
  const { t } = useI18n();
  const b = tone === 'onBrand' ? 'btn-icon text-on-brand/70 hover:bg-white/10 hover:text-on-brand' : 'btn-icon';
  return (
    <div className={cx('flex items-center gap-0.5', className)}>
      {onUp && <button className={b} onClick={onUp} aria-label={t('ui.up')}><ArrowUp size={16} /></button>}
      {onDown && <button className={b} onClick={onDown} aria-label={t('ui.down')}><ArrowDown size={16} /></button>}
      {onEdit && <button className={b} onClick={onEdit} aria-label={t('ui.edit')}><Pencil size={16} /></button>}
      {onDelete && (
        <button className={cx(b, 'hover:!text-danger')} onClick={onDelete} aria-label={t('ui.delete')}><Trash2 size={16} /></button>
      )}
    </div>
  );
}

export function Empty({ icon: Icon = Inbox, title, hint }) {
  const { t } = useI18n();
  return (
    <div className="card flex flex-col items-center gap-2 px-6 py-12 text-center">
      <span className="mb-1 grid h-12 w-12 place-items-center rounded-full bg-accent/15 text-primary"><Icon size={22} strokeWidth={1.8} /></span>
      <p className="font-semibold text-ink">{title || t('ui.empty')}</p>
      {hint && <p className="max-w-xs text-sm text-muted">{hint}</p>}
    </div>
  );
}

/** Reusable hook for edit/delete modals state. */
export function useEditor() {
  const [editing, setEditing] = useState(null); // null | {} (new) | row
  const [deleting, setDeleting] = useState(null);
  return { editing, setEditing, deleting, setDeleting };
}

/** Swap item with neighbour and return new id order. */
export function moved(list, index, dir) {
  const ids = list.map((x) => x.id);
  const j = index + dir;
  if (j < 0 || j >= ids.length) return null;
  [ids[index], ids[j]] = [ids[j], ids[index]];
  return ids;
}
