import { useState, type ReactNode } from 'react';
import type { ToolManifest } from '@/core/tools/types';
import { t } from '@/strings';
import { Badge, Button, HuePlate, RowMenu, Switch, type RowMenuItem } from '@/ui';
import styles from './ToolRow.module.css';

export interface ToolRowProps {
  tool: ToolManifest;
  on: boolean;
  /** Accessible name of the switch (the visible name stands beside it). */
  switchLabel: string;
  onToggle: (on: boolean) => void;
  disabled?: boolean;
  /** "<Name> öffnen": shown while the tool is on. */
  open?: { label: string; run: () => void };
  /** Order in the toolbar, in the row's "⋯" menu while the tool is on; a missing direction is the list's end. */
  move?: { up?: { label: string; run: () => void }; down?: { label: string; run: () => void } };
  /** A drag handle (`SortableList`), before the plate. */
  handle?: ReactNode;
  /** Size of the plate: the tool page shows it large. */
  plate?: 'md' | 'lg';
}

/**
 * One tool as a row (Identity 4.0, package 0b-E part E-2): plate in the tool's hue, name, one line of description,
 * the switch. The same row on `/tools` and in Einstellungen → Werkzeugkasten. What only a tool that is on can do
 * ("Öffnen", its place in the toolbar) shows only then, so a tool that is off carries one control, not four.
 */
export function ToolRow({
  tool,
  on,
  switchLabel,
  onToggle,
  disabled,
  open,
  move,
  handle,
  plate = 'md',
}: ToolRowProps) {
  const [menu, setMenu] = useState(false);
  const s = t.tools.library;
  const items: RowMenuItem[] = [];
  if (on && move?.up) items.push({ id: 'up', label: move.up.label, onSelect: move.up.run });
  if (on && move?.down) items.push({ id: 'down', label: move.down.label, onSelect: move.down.run });
  return (
    <div className={styles.row}>
      {/* The grip only for a tool that is on; its place stays, so the plates of a list stand in one line. */}
      {handle ? <span className={styles.handle}>{on ? handle : null}</span> : null}
      <HuePlate hue={tool.identity.hue} icon={tool.icon} size={plate} />
      <div className={styles.text}>
        <span className={styles.name}>
          {tool.name}
          {tool.maturity === 'preview' ? <Badge>{t.settings.maturity.badge}</Badge> : null}
        </span>
        <span className={styles.description}>
          {tool.description}
          {/* Most tools work without the internet: only the exception is said. */}
          {tool.offline ? null : <span className={styles.online}> · {s.online}</span>}
        </span>
      </div>
      <div className={styles.actions}>
        {on && open ? (
          <Button onClick={open.run} aria-label={open.label}>
            {t.settings.linkRow.open}
          </Button>
        ) : null}
        {items.length > 0 ? (
          <RowMenu label={t.ui.rowMenu} items={items} open={menu} onOpenChange={setMenu} />
        ) : null}
        <Switch
          label={switchLabel}
          labelHidden
          checked={on}
          disabled={disabled}
          onChange={onToggle}
        />
      </div>
    </div>
  );
}
