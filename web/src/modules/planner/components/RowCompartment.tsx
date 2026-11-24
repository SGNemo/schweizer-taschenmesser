/**
 * The compartment under an expanded plan row (planner hub 2, package 4a; hand-off 04 direction A „Fach unter der
 * Zeile“): a `--surface-2` box inside the row's list item that holds the thing's plan panel (`PlanPanelHost`). No
 * border, no shadow, no height animation – the content fades in, the rows below jump once, on his tap.
 *
 * One row is open at a time (`useOpenRow`, page state – nothing is stored, a reload closes it). Esc anywhere in the
 * row (title or compartment) closes it and gives the focus back to the title.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import styles from './RowCompartment.module.css';

/** The DOM id of a row's compartment (the title button's `aria-controls`). */
export const compartmentId = (unitId: string): string =>
  `plan-row-${unitId.replace(/[^A-Za-z0-9_-]/g, '_')}`;

/** Which row is open: one at a time, by its unit id; page state only. */
export function useOpenRow() {
  const [open, setOpen] = useState<string | undefined>(undefined);
  const toggle = useCallback(
    (unitId: string) => setOpen((cur) => (cur === unitId ? undefined : unitId)),
    [],
  );
  const close = useCallback(() => setOpen(undefined), []);
  return { open, toggle, close };
}

export function RowCompartment({
  id,
  label,
  onClose,
  children,
}: {
  /** `compartmentId(unitId)`. */
  id: string;
  /** The row's title: the group's name. */
  label: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  // The row after this one: where the focus goes when this row leaves while the focus is in it (done, taken out).
  const after = useRef<Element | null>(null);
  useLayoutEffect(() => {
    close.current = onClose;
    after.current = ref.current?.closest('li')?.nextElementSibling ?? null;
  });
  useEffect(
    () => () => {
      const next = after.current;
      // After the commit: only a focus that fell to the page is moved (Esc and „Ganz öffnen“ placed theirs).
      setTimeout(() => {
        const lost = !document.activeElement || document.activeElement === document.body;
        if (lost && next?.isConnected) next.querySelector<HTMLElement>('[data-row]')?.focus();
      });
    },
    [],
  );
  useEffect(() => {
    const row = ref.current?.closest('li');
    if (!row) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      // A menu or a dialog inside the row closes itself first.
      const target = e.target as HTMLElement | null;
      if (target?.closest('[role="menu"], [role="dialog"], [role="listbox"]')) return;
      e.preventDefault();
      e.stopPropagation();
      row.querySelector<HTMLElement>('[data-row]')?.focus();
      close.current();
    };
    row.addEventListener('keydown', onKey);
    return () => row.removeEventListener('keydown', onKey);
  }, []);
  return (
    <div
      ref={ref}
      id={id}
      role="group"
      aria-label={label}
      className={styles.compartment}
      data-testid="row-compartment"
      // The row's ⋯ opens on a right-click on the row, never on the panel's own text.
      onContextMenu={(e) => e.stopPropagation()}
    >
      {children}
    </div>
  );
}
