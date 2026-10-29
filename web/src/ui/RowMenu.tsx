import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { menuSide, type MenuSide } from '@/core/shell/menuPlacement';
import { useBackClose } from '@/core/shell/useBackClose';
import { t } from '@/strings';
import { IconButton } from './Button';
import { Icon } from './icons';
import styles from './RowMenu.module.css';

export interface RowMenuItem {
  id: string;
  label: string;
  onSelect: () => void;
  /** Destructive entries are marked with the danger colour and a text hint in the label. */
  danger?: boolean;
  /** Entries with a heading start a new group (`Später`, `Bewegen` …). */
  group?: string;
  /** Marks the current choice (list filter, a switch that is on): `menuitemcheckbox` with `aria-checked`. */
  checked?: boolean;
}

/**
 * Overflow menu of a row ("⋯"): opens from the button, from a right-click or a long press on the
 * row (the browser sends `contextmenu`). Arrow keys move, Enter picks, Esc closes and returns the
 * focus. Every entry is also reachable without this menu (swipe, edit dialog); it is a shortcut.
 */
/** Gap between trigger and menu (`--space-1` in the stylesheet), counted when measuring the side. */
const MENU_GAP_PX = 8;

export function RowMenu({
  label,
  items,
  open,
  onOpenChange,
}: {
  label: string;
  items: RowMenuItem[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const root = useRef<HTMLSpanElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const [side, setSide] = useState<MenuSide>('down');

  // Near the bottom bar the menu opens upwards (thumb zone); measured before paint, so it never jumps.
  useLayoutEffect(() => {
    if (!open || !list.current || !button.current) return;
    const rect = button.current.getBoundingClientRect();
    // The menu is clipped by the page's scroll area, so measure against that, not the screen.
    let scroller: HTMLElement | null = button.current.parentElement;
    while (scroller && !/(auto|scroll)/.test(getComputedStyle(scroller).overflowY))
      scroller = scroller.parentElement;
    const area = scroller?.getBoundingClientRect();
    const screen = window.visualViewport?.height ?? window.innerHeight;
    const top = area?.top ?? 0;
    const bottom = Math.min(area?.bottom ?? screen, screen);
    const bar = document.querySelector('[data-bottom-bar]')?.getBoundingClientRect();
    setSide(
      menuSide({
        triggerTop: rect.top - top,
        triggerBottom: rect.bottom - top,
        menuHeight: list.current.offsetHeight + MENU_GAP_PX,
        viewportHeight: bottom - top,
        bottomReserve: bar && bar.height > 0 ? Math.max(0, bottom - bar.top) : 0,
      }),
    );
  }, [open]);

  useBackClose(open, () => onOpenChange(false));

  useEffect(() => {
    if (!open) return;
    const first = root.current?.querySelector<HTMLButtonElement>('[role^="menuitem"]');
    first?.focus();
    const away = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) onOpenChange(false);
    };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [open, onOpenChange]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open) return;
    if (e.key === 'Escape') {
      e.stopPropagation();
      onOpenChange(false);
      button.current?.focus();
      return;
    }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const all = [
      ...(root.current?.querySelectorAll<HTMLButtonElement>('[role^="menuitem"]') ?? []),
    ];
    const at = all.indexOf(document.activeElement as HTMLButtonElement);
    const next = (at + (e.key === 'ArrowDown' ? 1 : -1) + all.length) % all.length;
    all[next]?.focus();
  }

  let lastGroup: string | undefined;
  const entries: ReactNode[] = [];
  for (const item of items) {
    if (item.group && item.group !== lastGroup) {
      entries.push(
        <li key={`g-${item.group}`} role="presentation" className={styles.group}>
          {item.group}
        </li>,
      );
    }
    lastGroup = item.group ?? lastGroup;
    entries.push(
      <li key={item.id} role="none">
        <button
          type="button"
          role={item.checked === undefined ? 'menuitem' : 'menuitemcheckbox'}
          aria-checked={item.checked}
          className={`${styles.item} ${item.danger ? styles.danger : ''}`}
          onClick={() => {
            onOpenChange(false);
            item.onSelect();
          }}
        >
          {item.label}
          {item.checked ? <Icon name="check" size={16} /> : null}
        </button>
      </li>,
    );
  }

  return (
    <span className={styles.root} ref={root} onKeyDown={onKeyDown}>
      <IconButton
        ref={button}
        label={label || t.ui.rowMenu}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => onOpenChange(!open)}
      >
        <Icon name="more" size={18} />
      </IconButton>
      {open ? (
        <ul
          ref={list}
          role="menu"
          aria-label={label}
          className={`${styles.menu} ${side === 'up' ? styles.up : ''}`}
        >
          {entries}
        </ul>
      ) : null}
    </span>
  );
}
