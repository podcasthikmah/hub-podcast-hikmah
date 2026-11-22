import { useMemo } from 'react';
import { BookOpenCheck, Info } from 'lucide-react';
import { useData } from '../lib/store.jsx';
import { byOrder } from '../lib/utils.js';
import { PANDUAN_KATEGORI } from '../lib/schema.js';
import { DriveCard, driveFields } from '../components/DriveCard.jsx';
import { useI18n } from '../lib/i18n.jsx';
import { AddButton, ConfirmModal, Empty, FormModal, SectionHeader, moved, useEditor } from '../components/ui.jsx';

export default function Panduan() {
  const { db, isAdmin, create, update, remove, reorder } = useData();
  const { t } = useI18n();
  const { editing, setEditing, deleting, setDeleting } = useEditor();
  const rows = useMemo(() => db.PANDUAN.filter((r) => (r.kategori || 'PANEL') === PANDUAN_KATEGORI.PANEL).sort(byOrder), [db.PANDUAN]);

  const save = (v) =>
    editing?.id ? update('PANDUAN', editing.id, v) : create('PANDUAN', { ...v, kategori: PANDUAN_KATEGORI.PANEL });

  return (
    <section aria-labelledby="h-panduan">
      <SectionHeader
        eyebrow={t('pd.eyebrow')}
        title={<span id="h-panduan">{t('pd.title')}</span>}
        desc={t('pd.desc')}
        action={isAdmin && <AddButton onClick={() => setEditing({})}>{t('pd.add')}</AddButton>}
      />

      <div className="mb-6 flex gap-3 rounded-card border border-accent/40 bg-accent/10 p-4 text-sm text-ink">
        <Info size={18} className="mt-0.5 shrink-0 text-primary" />
        <p><b>{t('pd.newTitle')}</b> {t('pd.newBody')}</p>
      </div>

      {rows.length === 0 ? (
        <Empty icon={BookOpenCheck} title={t('pd.empty')} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((r, i) => (
            <DriveCard
              key={r.id}
              item={r}
              featured={i === 0}
              isAdmin={isAdmin}
              onEdit={() => setEditing(r)}
              onDelete={() => setDeleting(r)}
              onUp={i > 0 ? () => reorder('PANDUAN', moved(rows, i, -1)) : undefined}
              onDown={i < rows.length - 1 ? () => reorder('PANDUAN', moved(rows, i, 1)) : undefined}
            />
          ))}
        </div>
      )}

      <FormModal open={Boolean(editing)} onClose={() => setEditing(null)} title={editing?.id ? t('pd.edit') : t('pd.addTitle')} fields={driveFields(t)} initial={editing} onSubmit={save} />
      <ConfirmModal open={Boolean(deleting)} onClose={() => setDeleting(null)} onConfirm={() => remove('PANDUAN', deleting.id)} message={t('ui.deleteNamed', { name: deleting?.tajuk })} />
    </section>
  );
}
