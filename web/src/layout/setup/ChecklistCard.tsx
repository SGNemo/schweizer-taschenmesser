import { showChecklist, useChecklist } from '@/core/setup/checklist';
import { useSetupHost } from '@/core/setup/host';
import { MIGRATE_STEP_ID, setManualDone } from '@/core/setup/migrate';
import { setChecklistHidden } from '@/core/setup/state';
import { t } from '@/strings';
import { Badge, Button, Card, patternStyles } from '@/ui';

const MAX_SHOWN = 5;

/** Dashboard card with what is still open of the setup; hidden once everything is done. */
export function ChecklistCard() {
  const checklist = useChecklist();
  const open = useSetupHost((s) => s.openWizard);
  if (!checklist || !showChecklist(checklist.state, checklist.list)) return null;
  const { list } = checklist;
  // Same number of rows as always; the "Umzug" row takes the last place when it would be folded away.
  const head = list.open.slice(0, MAX_SHOWN);
  const move = list.open.find((i) => i.id === MIGRATE_STEP_ID);
  const shown = move && !head.includes(move) ? [...head.slice(0, MAX_SHOWN - 1), move] : head;
  return (
    <div data-testid="setup-checklist" style={{ marginBottom: 'var(--space-5)' }}>
      <Card>
        <h2>{t.setup.title}</h2>
        <p className={patternStyles.muted}>{t.setup.checklistProgress(list.done, list.total)}</p>
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
          {shown.map((item) => (
            <li key={item.id}>
              <div
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
                <Button
                  aria-label={`${item.title}: ${t.setup.openStep}`}
                  onClick={() => open(item.id)}
                >
                  {t.setup.openStep}
                </Button>
              </div>
              {item.sub ? (
                <ul
                  aria-label={t.setup.steps.migrate.subLabel}
                  className={patternStyles.muted}
                  style={{ listStyle: 'none', margin: 0, padding: '0 0 0 var(--space-4)' }}
                >
                  {item.sub.map((sub) => (
                    <li
                      key={sub.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 'var(--space-2)',
                      }}
                    >
                      <span>
                        {sub.done ? '✓ ' : ''}
                        {t.setup.steps.migrate.items[sub.id]}
                      </span>
                      {sub.manual ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => void setManualDone(sub.id, !sub.done)}
                        >
                          {sub.done ? t.setup.steps.migrate.untick : t.setup.steps.migrate.tick}
                        </Button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
        {list.open.length > shown.length ? (
          <p className={patternStyles.muted}>{t.setup.moreOpen(list.open.length - shown.length)}</p>
        ) : null}
        <div className={patternStyles.hstackWrap}>
          <Button variant="primary" onClick={() => open()}>
            {t.setup.resume}
          </Button>
          <Button onClick={() => void setChecklistHidden(true)}>{t.setup.hideChecklist}</Button>
        </div>
      </Card>
    </div>
  );
}
