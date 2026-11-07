import { useState } from 'react';
import { useChecklist } from '@/core/setup/checklist';
import { useSetupHost } from '@/core/setup/host';
import { useSetupState } from '@/core/setup/hooks';
import { setChecklistHidden } from '@/core/setup/state';
import { t } from '@/strings';
import { tSettingsV31 } from '@/strings.settingsV31';
import { Button, SettingRow, SettingsGroup, Switch } from '@/ui';
import { Ring } from '@/ui/identity';
import { StatusCard } from './components/StatusCard';
import styles from './SetupSection.module.css';

/**
 * Settings → "Einrichtung" (own tab since settings identity v3.1): the progress in the tab's status card with the one
 * primary action (start, resume, view), the open steps with the next one on top, the checklist switch. Reads the
 * device-local progress only (`core/setup`); starts the assistant on a click – also months later, on an app full of
 * data – never by itself.
 */
/** Open steps shown before "n weitere" (the dashboard checklist shows five; the tab keeps its first screen calm). */
const MAX_SHOWN = 4;

export function SetupSection() {
  const state = useSetupState();
  const checklist = useChecklist();
  const open = useSetupHost((s) => s.openWizard);
  const o = tSettingsV31.use().setup;
  const [all, setAll] = useState(false);
  // Nothing until the progress and the checklist are read: a half-done setup never flashes "Noch nicht begonnen".
  // Without a progress row (`null`, before the start migration) the checklist never loads: that is "not started".
  if (state === undefined || (state && !checklist)) return null;
  const started = !!state && (state.doneSteps.length > 0 || state.status === 'inProgress');
  const list = checklist?.list;
  // Steps done elsewhere count too (a module already on): the card then says how far it is, the button still starts.
  const progress = started || (!!list && list.done > 0);
  const next = list?.open[0];
  const allDone = !!list && list.total > 0 && list.open.length === 0;

  const title = allDone
    ? o.allDone
    : list && progress
      ? t.setup.checklistProgress(list.done, list.total)
      : o.notStarted;
  const line = allDone ? o.allDoneLine : next && progress ? o.next(next.title) : o.notStartedLine;
  const action = allDone ? o.review : started ? t.setup.resume : t.setup.start;

  return (
    <div id="setup" className={styles.stack} data-testid="setup-section">
      <StatusCard
        testId="setup-status"
        title={title}
        line={line}
        figure={
          list && list.total > 0 ? (
            <Ring
              size={3}
              label={t.setup.checklistProgress(list.done, list.total)}
              parts={[
                { label: t.setup.checklistProgress(list.done, list.total), share: list.done },
                { label: o.openTitle, share: list.total - list.done },
              ]}
            />
          ) : undefined
        }
        icon={list && list.total > 0 ? undefined : 'checklist'}
        action={
          <Button variant="primary" onClick={() => open()}>
            {action}
          </Button>
        }
      />
      {list && list.open.length > 0 ? (
        <SettingsGroup id="setup-open" title={o.openTitle} plain>
          {(all ? list.open : list.open.slice(0, MAX_SHOWN)).map((item) => (
            <SettingRow
              key={item.id}
              label={item.title}
              description={
                item.progress === 'skipped'
                  ? t.setup.statusSkipped
                  : item.isNew
                    ? t.setup.isNew
                    : undefined
              }
            >
              <Button
                aria-label={`${item.title}: ${t.setup.openStep}`}
                onClick={() => open(item.id)}
              >
                {t.setup.openStep}
              </Button>
            </SettingRow>
          ))}
          {list.open.length > MAX_SHOWN && !all ? (
            <div className={styles.more}>
              <Button variant="ghost" onClick={() => setAll(true)}>
                {o.showAll(list.open.length - MAX_SHOWN)}
              </Button>
            </div>
          ) : null}
        </SettingsGroup>
      ) : null}
      {state ? (
        <SettingsGroup id="setup-overview" title={o.overviewTitle} plain>
          <SettingRow
            id="setup--checklist"
            label={t.setup.showChecklist}
            description={o.checklistLine}
          >
            <Switch
              label={t.setup.showChecklist}
              labelHidden
              checked={!state.checklistHidden}
              onChange={(on) => void setChecklistHidden(!on)}
            />
          </SettingRow>
        </SettingsGroup>
      ) : null}
    </div>
  );
}
