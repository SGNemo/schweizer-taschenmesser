import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { aiModules } from '@/core/ai/scope';
import { prepareProposal } from '@/core/ai/write/prepare';
import type { PreparedOp } from '@/core/ai/write/types';
import {
  listNotices,
  removeNotices,
  undoRunById,
  useAutomationLog,
  type AutomationNotice,
} from '@/core/automation';
import type { LogRow } from '@/core/automation/log';
import { db } from '@/core/db/db';
import { loadModuleStates } from '@/core/modules/activation';
import { availableManifests } from '@/core/modules/available';
import { activeManifests } from '@/core/modules/contributions';
import { formatDateTime } from '@/core/time/dates';
import { today } from '@/core/time/now';
import { WritePreview } from '@/layout/assistant/WritePreview';
import { useUiStore } from '@/stores/ui';
import { tAuto } from '@/strings.automation';
import { Button, Dialog, ItemList, ItemRow, SettingsGroup } from '@/ui';

const SECTION = 'automation-log';
/** Only the latest few runs: the log is for a glance, not a history page. */
const MAX_ROWS = 8;

/**
 * Settings → Benachrichtigungen → "Regel-Protokoll": the latest rule runs as a list (like "Zuletzt
 * gelöscht"), each run that wrote something with "Rückgängig", and the suggestions rules prepared,
 * which are confirmed in the same preview the assistant uses. Only existing parts.
 */
export function AutomationLogSection() {
  const s = tAuto.use().log;
  const toast = useUiStore((st) => st.toast);
  const rows = useAutomationLog(MAX_ROWS);
  const notices = useLiveQuery(() => listNotices(), []);
  const suggestions = (notices ?? []).filter((n) => n.suggestion);
  const [review, setReview] = useState<{ notice: AutomationNotice; ops: PreparedOp[] }>();

  const meta = (row: LogRow): string => {
    const parts = [formatDateTime(row.at), s.results[row.result] ?? row.result];
    if (row.reason) parts.push(s.reasons[row.reason] ?? row.reason);
    for (const note of new Set(row.actions.map((a) => a.note).filter((n): n is string => !!n))) {
      if (note !== 'dry' || row.result !== 'dry') parts.push(s.notes[note] ?? note);
    }
    if (row.undone) parts.push(s.undone);
    return parts.join(' · ');
  };

  const undo = async (groupId: string) => {
    const r = await undoRunById(groupId);
    toast(s.undoneDetail(r.removed, r.kept));
  };

  const open = async (notice: AutomationNotice) => {
    if (!notice.suggestion) return;
    const states = await loadModuleStates();
    const ops = await prepareProposal([notice.suggestion], {
      manifests: aiModules(activeManifests(states)),
      known: availableManifests(),
      database: db,
      today: today(),
    });
    setReview({ notice, ops });
  };

  return (
    <SettingsGroup id={SECTION} title={s.title} description={s.description}>
      {suggestions.length > 0 && (
        <>
          <h3>{s.suggestions}</h3>
          <p>{s.suggestionsHint}</p>
          <ItemList label={s.suggestions}>
            {suggestions.map((n) => (
              <ItemRow
                key={n.id}
                title={n.title}
                meta={formatDateTime(n.at)}
                end={
                  <>
                    <Button size="sm" onClick={() => void open(n)}>
                      {s.review}
                    </Button>
                    <Button size="sm" onClick={() => void removeNotices({ id: n.id })}>
                      {s.dismiss}
                    </Button>
                  </>
                }
              />
            ))}
          </ItemList>
        </>
      )}
      {rows && rows.length === 0 ? (
        <p role="status" data-testid="automation-log-empty">
          {s.empty}
        </p>
      ) : (
        <ItemList label={s.listLabel}>
          {(rows ?? []).map((row) => (
            <ItemRow
              key={row.id}
              title={row.ruleTitle}
              meta={meta(row)}
              end={
                row.groupId && !row.undone ? (
                  <Button size="sm" onClick={() => void undo(row.groupId!)}>
                    {s.undo}
                  </Button>
                ) : undefined
              }
            />
          ))}
        </ItemList>
      )}
      <Dialog
        open={review !== undefined}
        onClose={() => setReview(undefined)}
        title={s.reviewTitle}
      >
        {review && (
          <WritePreview
            result={{ kind: 'write', stage: 'rule', ops: review.ops, confidence: 1 }}
            onDone={() => {
              void removeNotices({ id: review.notice.id });
              setReview(undefined);
            }}
          />
        )}
      </Dialog>
    </SettingsGroup>
  );
}
