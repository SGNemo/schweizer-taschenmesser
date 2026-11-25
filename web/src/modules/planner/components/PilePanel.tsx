/**
 * A collective row's compartment (planner hub 2, package 2; hand-off 02, COPY P7, P8, X1, X19): its parts, each with
 * its head and the jump into the module's filtered view; each member as its module's `compact` panel (title, its one
 * end action or tick) and `▸`, which opens the member's full panel one level deeper, inside the pile (one at a time,
 * indented, no surface of its own); a part without members as the module's own line (budgets, the mail queue). The
 * planner draws the frame and writes nothing: every action is the member's module's own, with its own undo toast.
 */
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { availableManifests } from '@/core/modules/available';
import type { PlannableEntry } from '@/core/modules/contributions';
import { PanelHead, PlanPanelHost } from '@/core/modules/PlanPanelHost';
import type { PileGroup } from '@/core/modules/pile';
import { t } from '@/strings';
import { Button, Icon, PanelLine, PanelLines, SensitiveValue } from '@/ui';
import styles from '../routes/planner.module.css';
import { carrierOf } from './carrier';
import { MONEY } from './ThingRow';

/** Members shown before X19 „{n} weitere“; each tap shows this many more. */
const STEP = 5;

const hasPanel = (moduleId: string) =>
  !!availableManifests().find((m) => m.id === moduleId)?.contributions?.planPanel;
const moduleName = (moduleId: string) =>
  availableManifests().find((m) => m.id === moduleId)?.name ?? moduleId;

/** A source's detail line: a sum in it is a sensitive value („Werte ausblenden“ holds in the pile too). */
const detailOf = (detail: string | undefined) =>
  detail ? (
    MONEY.test(detail) ? (
      <SensitiveValue compact>{detail}</SensitiveValue>
    ) : (
      detail
    )
  ) : undefined;

function Member({
  entry,
  open,
  onToggle,
}: {
  entry: PlannableEntry;
  open: boolean;
  onToggle: () => void;
}) {
  const id = `pile-member-${entry.moduleId}-${entry.id}`.replace(/[^A-Za-z0-9_-]/g, '_');
  const carrier = open ? carrierOf(entry) : undefined;
  return (
    <li className={styles.pileMember} data-open={open || undefined}>
      <div className={styles.pileMemberLine}>
        <div className={styles.pileMemberBody}>
          {hasPanel(entry.moduleId) ? (
            <PlanPanelHost moduleId={entry.moduleId} id={entry.id} to={entry.to} compact />
          ) : (
            // A module without a panel of its own (Unterlagen): what the row knows, as one line.
            <PanelLines>
              <PanelLine {...(entry.detail ? { meta: detailOf(entry.detail) } : {})}>
                {entry.title}
              </PanelLine>
            </PanelLines>
          )}
        </div>
        <button
          type="button"
          data-pile-expand=""
          className={styles.pileExpand}
          aria-expanded={open}
          aria-controls={id}
          aria-label={`${entry.title}${open ? t.planner.panel.collapseHint : t.planner.panel.expandHint}`}
          onClick={onToggle}
        >
          <Icon name={open ? 'chevronDown' : 'chevronRight'} size={16} />
        </button>
      </div>
      {open ? (
        <div id={id} className={styles.pileMemberPanel} role="group" aria-label={entry.title}>
          <PlanPanelHost
            moduleId={entry.moduleId}
            id={entry.id}
            to={entry.to}
            {...(carrier ? { carrier } : {})}
            {...(entry.detail ? { detail: detailOf(entry.detail) } : {})}
          />
        </div>
      ) : null}
    </li>
  );
}

export function PilePanel({
  group,
  entries,
}: {
  group: PileGroup;
  /** The plan's things by item key (`<module>:<id>`). */
  entries: ReadonlyMap<string, PlannableEntry>;
}) {
  const [openKey, setOpenKey] = useState<string | undefined>();
  const [shown, setShown] = useState<Record<string, number>>({});
  const box = useRef<HTMLDivElement>(null);
  const keys = group.parts.flatMap((p) => p.members).join('|');
  // A member line that leaves (paid, ticked) takes the focus along: it goes to the next member's ▸, else the pile's
  // own title – never to the page's start.
  const [seenKeys, setSeenKeys] = useState(keys);
  if (seenKeys !== keys) setSeenKeys(keys);
  useEffect(() => {
    const el = box.current;
    if (!el || document.activeElement !== document.body) return;
    const next = el.querySelector<HTMLElement>('[data-pile-expand]');
    const title = el.closest('li')?.querySelector<HTMLElement>('button[data-row]');
    (next ?? title)?.focus({ preventScroll: true });
  }, [seenKeys]);
  // Esc closes the open member first, then the pile (A11Y). Native, on the panel: the compartment's own Esc listener
  // sits on the row above and skips a key this one has taken.
  const openNow = useRef(openKey);
  useEffect(() => {
    openNow.current = openKey;
  });
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented || !openNow.current) return;
      if (
        (e.target as HTMLElement | null)?.closest(
          '[role="menu"], [role="dialog"], [role="listbox"]',
        )
      )
        return;
      e.preventDefault();
      const back = el.querySelector<HTMLElement>('[data-pile-expand][aria-expanded="true"]');
      setOpenKey(undefined);
      back?.focus({ preventScroll: true });
    };
    el.addEventListener('keydown', onKey);
    return () => el.removeEventListener('keydown', onKey);
  }, []);
  return (
    <div ref={box} className={styles.pile}>
      {group.parts.map(({ pile, members }) => {
        const lines = members.flatMap((k) => (entries.get(k) ? [entries.get(k)!] : []));
        const line = pile.panel && pile.count > 0;
        if (lines.length === 0 && !line) return null;
        const partKey = `${pile.moduleId}:${pile.id}`;
        const limit = shown[partKey] ?? STEP;
        const rest = lines.length - limit;
        const jump = (
          <Link className={styles.pileJump} to={pile.to}>
            {t.planner.pile.jump(moduleName(pile.moduleId))}
          </Link>
        );
        return (
          <section key={partKey} className={styles.pilePart}>
            {pile.head ? (
              <div className={styles.pileHead}>
                <PanelHead>{pile.head}</PanelHead>
                <span className={styles.pileJumpWide}>{jump}</span>
              </div>
            ) : null}
            {line ? (
              <PlanPanelHost moduleId={pile.moduleId} id={pile.panel!} to={pile.to} compact />
            ) : null}
            {lines.length > 0 ? (
              <ul className={styles.pileMembers}>
                {lines.slice(0, limit).map((e) => {
                  const key = `${e.moduleId}:${e.id}`;
                  return (
                    <Member
                      key={key}
                      entry={e}
                      open={openKey === key}
                      onToggle={() => setOpenKey((k) => (k === key ? undefined : key))}
                    />
                  );
                })}
              </ul>
            ) : null}
            {rest > 0 ? (
              <Button
                variant="ghost"
                onClick={() => setShown((s) => ({ ...s, [partKey]: limit + STEP }))}
              >
                {t.planner.panel.more(rest)}
              </Button>
            ) : null}
            {pile.head ? <span className={styles.pileJumpNarrow}>{jump}</span> : null}
          </section>
        );
      })}
    </div>
  );
}
