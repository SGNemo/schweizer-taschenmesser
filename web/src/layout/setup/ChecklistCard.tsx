import { showChecklist, useChecklist } from '@/core/setup/checklist';
import { useSetupHost } from '@/core/setup/host';
import { setChecklistHidden } from '@/core/setup/state';
import { t } from '@/strings';
import { Badge, Button, Card } from '@/ui';

const MAX_SHOWN = 5;

/** Dashboard card with what is still open of the setup; hidden once everything is done. */
export function ChecklistCard() {
  const checklist = useChecklist();
  const open = useSetupHost((s) => s.openWizard);
  if (!checklist || !showChecklist(checklist.state, checklist.list)) return null;
  const { list } = checklist;
  return (
    <div data-testid="setup-checklist" style={{ marginBottom: 'var(--space-5)' }}>
      <Card>
        <h2>{t.setup.title}</h2>
        <p style={{ color: 'var(--text-muted)' }}>
          {t.setup.checklistProgress(list.done, list.total)}
        </p>
        <progress
          value={list.done}
          max={list.total}
          aria-label={t.setup.progressLabel}
          style={{ width: '100%' }}
        />
        <ul
          style={{
            listStyle: 'none',
            margin: 0,
            padding: 0,
            display: 'grid',
            gap: 'var(--space-1)',
          }}
        >
          {list.open.slice(0, MAX_SHOWN).map((item) => (
            <li
              key={item.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 'var(--space-2)',
                minHeight: 44,
              }}
            >
              <span>
                {item.title} {item.isNew ? <Badge tone="accent">{t.setup.isNew}</Badge> : null}
                {item.progress === 'skipped' ? <Badge>{t.setup.statusSkipped}</Badge> : null}
              </span>
              <Button aria-label={`${item.title}: ${t.setup.open}`} onClick={() => open(item.id)}>
                {t.setup.open}
              </Button>
            </li>
          ))}
        </ul>
        {list.open.length > MAX_SHOWN ? (
          <p style={{ color: 'var(--text-muted)' }}>
            {t.setup.moreOpen(list.open.length - MAX_SHOWN)}
          </p>
        ) : null}
        <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
          <Button variant="primary" onClick={() => open()}>
            {t.setup.resume}
          </Button>
          <Button onClick={() => void setChecklistHidden(true)}>{t.setup.hideChecklist}</Button>
        </div>
      </Card>
    </div>
  );
}
