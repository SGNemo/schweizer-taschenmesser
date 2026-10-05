import type { ReactNode } from 'react';
import { t } from '@/strings';
import { useUiStore } from '@/stores/ui';
import { Icon } from './icons';
import styles from './GroupedList.module.css';

export interface GroupedListGroup {
  id: string;
  /** Header text ("Überfällig", "Diese Woche" …), small and muted. */
  label: string;
  /** Number of entries, shown next to the label. */
  count: number;
  /** The rows (`ItemRow`s) of this group. */
  children: ReactNode;
  /** Mark urgent groups (overdue): the header gets the danger tone, always with its text. */
  tone?: 'overdue' | 'today';
}

/**
 * Lists grouped by time or status (DESIGN-SPEC §7b): the group header is a small muted toggle with a count, groups are
 * separated by space and one hairline (never between every entry), and each group can be folded. The fold state is
 * device-local and keyed by `listId:groupId`. Rows inside are normal `ItemRow`s in an `ItemList`-like surface.
 */
export function GroupedList({
  listId,
  groups,
  label,
}: {
  listId: string;
  groups: readonly GroupedListGroup[];
  label?: string;
}) {
  const closed = useUiStore((s) => s.closedGroups);
  const toggle = useUiStore((s) => s.toggleGroupOpen);
  return (
    <div className={styles.root} role="group" aria-label={label}>
      {groups.map((g) => {
        const key = `${listId}:${g.id}`;
        const open = !closed.includes(key);
        const bodyId = `grp-${listId}-${g.id}`;
        return (
          <section key={g.id} className={styles.group} data-group={g.id}>
            <h2 className={styles.head} data-tone={g.tone}>
              <button
                type="button"
                className={styles.toggle}
                aria-expanded={open}
                aria-controls={bodyId}
                aria-label={open ? t.groups.collapse(g.label) : t.groups.expand(g.label)}
                onClick={() => toggle(key)}
              >
                <Icon name={open ? 'chevronDown' : 'chevronRight'} size={16} />
                <span>{g.label}</span>
                <span className={styles.count} aria-label={t.groups.count(g.count)}>
                  {g.count}
                </span>
              </button>
            </h2>
            <div id={bodyId} hidden={!open} className={styles.body}>
              {g.children}
            </div>
          </section>
        );
      })}
    </div>
  );
}
