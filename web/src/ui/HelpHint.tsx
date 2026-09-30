import { useEffect, useId, useLayoutEffect, useRef, useState, type FocusEvent } from 'react';
import { Icon } from './icons';
import styles from './HelpHint.module.css';

/**
 * A small "?" that explains one thing that needs explaining. Opens on tap/click (and toggles), on
 * mouse hover and on keyboard focus; Esc or a tap elsewhere closes it. Use sparingly: at most one
 * per area, a sentence or two.
 */
export function HelpHint({ text, label = 'Hilfe' }: { text: string; label?: string }) {
  const bubbleId = useId();
  const root = useRef<HTMLSpanElement>(null);
  const bubble = useRef<HTMLSpanElement>(null);
  const [pinned, setPinned] = useState(false);
  const [hover, setHover] = useState(false);
  const [focused, setFocused] = useState(false);
  const [shift, setShift] = useState(0);
  const visible = pinned || hover || focused;

  // Keep the bubble inside the viewport (the "?" can sit at either edge of a narrow screen). The
  // shift is derived from the *unshifted* position, so it settles in one step and cannot oscillate.
  useLayoutEffect(() => {
    if (!visible || !bubble.current) return setShift(0);
    const rect = bubble.current.getBoundingClientRect();
    const margin = 8;
    const width = document.documentElement.clientWidth;
    const left = rect.left - shift;
    const right = rect.right - shift;
    let next = 0;
    if (right > width - margin) next = width - margin - right;
    if (left + next < margin) next = margin - left;
    if (next !== shift) setShift(next);
  }, [visible, shift]);

  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation(); // do not close a dialog that contains the hint
        e.preventDefault(); // a native <dialog> closes on Esc as the default action
        setPinned(false);
        setHover(false);
        setFocused(false);
      }
    };
    const onPointer = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setPinned(false);
    };
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('pointerdown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [visible]);

  function onFocus(e: FocusEvent<HTMLButtonElement>) {
    // Only keyboard focus opens the hint; a tap focuses too but is handled by the click.
    try {
      setFocused(e.currentTarget.matches(':focus-visible'));
    } catch {
      setFocused(false); // engines without :focus-visible
    }
  }

  return (
    <span
      ref={root}
      className={styles.root}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <button
        type="button"
        className={styles.button}
        aria-label={label}
        aria-expanded={visible}
        aria-describedby={visible ? bubbleId : undefined}
        onClick={() => setPinned((p) => !p)}
        onFocus={onFocus}
        onBlur={() => setFocused(false)}
      >
        <Icon name="help" size={18} />
      </button>
      {visible ? (
        <span
          ref={bubble}
          id={bubbleId}
          role="tooltip"
          className={styles.bubble}
          style={{ transform: `translateX(${shift}px)` }}
        >
          {text}
        </span>
      ) : null}
    </span>
  );
}
