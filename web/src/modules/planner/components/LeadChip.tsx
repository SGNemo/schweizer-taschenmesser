/**
 * The lead chip A2 before the field's input (planner hub 2, package 9; hand-off 09, A11Y „Appointment“): „vor Friseur,
 * Mi“. Two controls – the chip itself is a small menu button (name A6 „{vor Friseur, Mi}. Ändern“, with the short day it
 * shows: WCAG 2.5.3) offering A3
 * „am Tag davor“ / „am Tag danach“ (hidden when there is no such day to offer), and a separate ✕ (A6 „Entfernen“).
 * While the line K1 shows a kind that is no task, the chip is drawn struck through and carries A7 as its description.
 */
import { useEffect, useId, useRef, useState } from 'react';
import { dayName } from '@/core/plan/explain';
import { t } from '@/strings';
import { Icon } from '@/ui';
import { leadDay, type FieldLead } from '../actions';
import styles from '../routes/planner.module.css';

export function leadLabel(lead: FieldLead, day = dayName(leadDay(lead))): string {
  const a = t.planner.appointment;
  return (lead.rel === 'before' ? a.chipBefore : a.chipAfter)(lead.title, day);
}

export function LeadChip({
  lead,
  today,
  onChange,
  onRemove,
  struckFor,
}: {
  lead: FieldLead;
  today: string;
  onChange: (lead: FieldLead) => void;
  onRemove: () => void;
  /** The kind K1 shows when it is no task: the chip is not applied. */
  struckFor?: string;
}) {
  const a = t.planner.appointment;
  const id = useId();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLSpanElement>(null);
  const label = leadLabel(lead);
  // A6 names the full weekday; the name must hold what the chip shows (WCAG 2.5.3), so it is the shown text + „Ändern“.
  const full = label;
  // „am Tag davor“ only when that day is still ahead; „am Tag danach“ always is.
  const choice =
    lead.rel === 'after' || lead.date > today
      ? { label: lead.rel === 'before' ? a.dayBefore : a.dayAfter }
      : undefined;
  useEffect(() => {
    if (!open) return;
    root.current?.querySelector<HTMLElement>('[role="menuitemcheckbox"]')?.focus();
    const away = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [open]);
  const describedBy = struckFor ? `${id}-not` : undefined;
  const chipClass = struckFor ? `${styles.leadChip} ${styles.leadStruck}` : styles.leadChip;
  return (
    <span
      ref={root}
      className={styles.leadWrap}
      data-testid="planner-lead"
      onKeyDown={(e) => {
        if (e.key === 'Escape' && open) {
          e.stopPropagation();
          setOpen(false);
          root.current?.querySelector<HTMLButtonElement>('button')?.focus();
        }
      }}
    >
      {choice ? (
        <button
          type="button"
          className={chipClass}
          aria-label={a.change(full)}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={open ? `${id}-menu` : undefined}
          aria-describedby={describedBy}
          onClick={() => setOpen((o) => !o)}
        >
          {label}
        </button>
      ) : (
        <span className={chipClass} aria-describedby={describedBy}>
          {label}
        </span>
      )}
      <button type="button" className={styles.leadRemove} aria-label={a.remove} onClick={onRemove}>
        <Icon name="close" size={16} />
      </button>
      {struckFor ? (
        <span id={`${id}-not`} className="sr-only">
          {a.notFor(label, struckFor)}
        </span>
      ) : null}
      {open && choice ? (
        <ul id={`${id}-menu`} role="menu" aria-label={a.change(full)} className={styles.leadMenu}>
          <li role="none">
            <button
              type="button"
              role="menuitemcheckbox"
              aria-checked={lead.shift}
              className={styles.leadItem}
              onClick={() => {
                onChange({ ...lead, shift: !lead.shift });
                setOpen(false);
                root.current?.querySelector<HTMLButtonElement>('button')?.focus();
              }}
            >
              {lead.shift ? <Icon name="check" size={16} /> : null}
              {choice.label}
            </button>
          </li>
        </ul>
      ) : null}
    </span>
  );
}
