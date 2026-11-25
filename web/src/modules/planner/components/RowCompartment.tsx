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
  // The rows beside this one: where the focus goes when this row leaves while the focus is in it (done, taken out) –
  // the next row's title, else the one before.
  const beside = useRef<(Element | null)[]>([]);
  // The focus is in this row (title or compartment); a tap that focuses nothing (Safari) never sets it.
  const inside = useRef(false);
  useLayoutEffect(() => {
    close.current = onClose;
    const li = ref.current?.closest('li');
    beside.current = [li?.nextElementSibling ?? null, li?.previousElementSibling ?? null];
  });
  useEffect(
    () => () => {
      if (!inside.current) return;
      const rows = beside.current;
      // After the commit: only a focus that fell to the page is moved (Esc and „Ganz öffnen“ placed theirs).
      setTimeout(() => {
        const lost = !document.activeElement || document.activeElement === document.body;
        if (!lost) return;
        for (const r of rows)
          if (r?.isConnected) {
            const title = r.querySelector<HTMLElement>('[data-row]');
            // Never a scroll the person did not ask for.
            if (title) return title.focus({ preventScroll: true });
          }
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
      if (target?.closest('dialog, [role="menu"], [role="dialog"], [role="listbox"]')) return;
      e.preventDefault();
      e.stopPropagation();
      row.querySelector<HTMLElement>('[data-row]')?.focus();
      close.current();
    };
    const onIn = () => {
      inside.current = true;
    };
    // Only a focus that went somewhere else ends it; the row leaving the page takes it with it (no target).
    const onOut = (e: FocusEvent) => {
      if (e.relatedTarget instanceof Node && !row.contains(e.relatedTarget)) inside.current = false;
    };
    if (row.contains(document.activeElement)) inside.current = true;
    row.addEventListener('keydown', onKey);
    row.addEventListener('focusin', onIn);
    row.addEventListener('focusout', onOut);
    return () => {
      row.removeEventListener('keydown', onKey);
      row.removeEventListener('focusin', onIn);
      row.removeEventListener('focusout', onOut);
    };
  }, []);
  return (
    <div
      ref={ref}
      id={id}
      role="group"
      aria-label={label}
      className={styles.compartment}
      data-testid="row-compartment"
      data-row-compartment=""
      // The row's ⋯ opens on a right-click on the row, never on the panel's own text.
      onContextMenu={(e) => e.stopPropagation()}
    >
      {children}
    </div>
  );
}
