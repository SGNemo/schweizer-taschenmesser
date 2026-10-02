import { useCallback, useEffect, useRef, useState } from 'react';
import { isTypingTarget } from '@/core/keyboard/typing';

/**
 * Multi-select for a list: tick a row, Shift-click a second one to take the whole range between,
 * `Esc` clears. `order` is the ids as shown, which defines "between".
 */
export function useSelection(order: readonly string[]) {
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const anchor = useRef<string | null>(null);

  const toggle = useCallback(
    (id: string, extend = false) => {
      setSelected((current) => {
        const next = new Set(current);
        const from = anchor.current !== null ? order.indexOf(anchor.current) : -1;
        const to = order.indexOf(id);
        if (extend && from >= 0 && to >= 0) {
          const [lo, hi] = from < to ? [from, to] : [to, from];
          for (const rangeId of order.slice(lo, hi + 1)) next.add(rangeId);
        } else if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
      if (!extend) anchor.current = id;
    },
    [order],
  );

  const clear = useCallback(() => {
    anchor.current = null;
    setSelected(new Set());
  }, []);

  const selectAll = useCallback(() => setSelected(new Set(order)), [order]);

  const active = selected.size > 0;
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (
        e.key === 'Escape' &&
        !isTypingTarget(e.target) &&
        !document.querySelector('dialog[open]')
      )
        clear();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, clear]);

  return {
    selected,
    ids: order.filter((id) => selected.has(id)),
    count: selected.size,
    isSelected: (id: string) => selected.has(id),
    toggle,
    clear,
    selectAll,
  };
}
