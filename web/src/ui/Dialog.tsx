import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { useBackClose } from '@/core/shell/useBackClose';
import { t } from '@/strings';
import { Button, IconButton } from './Button';
import { Icon } from './icons';
import styles from './Dialog.module.css';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  /** `full` fills the screen (setup assistant). Everything else is a centred dialog that becomes a bottom sheet on phones. */
  variant?: 'center' | 'full';
  /** Desktop width: `default` 34 rem (forms), `roomy` 40 rem (quick capture), `wide` 56 rem (tools), `xl` 76 rem (rich overviews, e.g. the weather). */
  size?: 'default' | 'roomy' | 'wide' | 'xl';
  /** Shown in the header before the title (e.g. a back button). */
  headerStart?: ReactNode;
  /** Fields were filled: closing asks "Entwurf verwerfen?" first. */
  dirty?: boolean;
  /** Editors: the dialog notices typing itself; once something was typed, closing asks first (an empty one closes at once). */
  askAfterTyping?: boolean;
  /** The parent registers "Back" itself (setup assistant): the dialog adds no entry of its own. */
  backHandled?: boolean;
}

/** Distance in px a sheet must be pulled down to close. */
const SWIPE_CLOSE_PX = 80;

/**
 * Modal built on the native <dialog>: focus trap, Esc handling and inert background for free.
 * Esc, backdrop, the close button and a swipe down on the sheet handle all go through one
 * `requestClose`, which asks before throwing away a `dirty` draft.
 */
/** Only text someone typed counts as a draft; a toggled checkbox or switch is saved as it is. */
function isTyping(target: EventTarget | null): boolean {
  if (target instanceof HTMLTextAreaElement) return true;
  if (target instanceof HTMLInputElement)
    return !['checkbox', 'radio', 'range', 'file', 'button', 'submit', 'reset', 'color'].includes(
      target.type,
    );
  return target instanceof HTMLElement && target.isContentEditable;
}

export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
  variant = 'center',
  size = 'default',
  headerStart,
  dirty: dirtyProp = false,
  askAfterTyping = false,
  backHandled = false,
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [confirming, setConfirming] = useState(false);
  // A closed dialog never reopens on the "discard?" question (adjusting state during render).
  const [wasOpen, setWasOpen] = useState(open);
  const [typed, setTyped] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (!open) {
      setConfirming(false);
      setTyped(false);
    }
  }
  const dirty = dirtyProp || (askAfterTyping && typed);
  const [dragY, setDragY] = useState(0);
  const dragFrom = useRef<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      if (typeof el.showModal === 'function') el.showModal();
      else el.setAttribute('open', '');
      // React's autoFocus runs before the dialog is open, so focus explicitly afterwards.
      el.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    } else if (!open && el.open) {
      if (typeof el.close === 'function') el.close();
      else el.removeAttribute('open');
    }
  }, [open]);

  // Esc, the backdrop, the X and the swipe all come here. At the "discard?" question they mean
  // "keep editing", like a second Back: only the explicit "Verwerfen" button throws a draft away.
  const requestClose = () => {
    if (confirming) setConfirming(false);
    else if (dirty) setConfirming(true);
    else onClose();
  };

  // "Back" (Android gesture, browser button) closes the dialog first; with a draft it asks, and
  // a second "Back" at the question means "keep editing".
  useBackClose(open && !backHandled, () => {
    if (confirming) {
      setConfirming(false);
      return 'keep';
    }
    if (dirty) {
      setConfirming(true);
      return 'keep';
    }
    onClose();
  });

  const onHandleDown = (e: React.PointerEvent) => {
    dragFrom.current = e.clientY;
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onHandleMove = (e: React.PointerEvent) => {
    if (dragFrom.current === null) return;
    setDragY(Math.max(0, e.clientY - dragFrom.current));
  };
  const onHandleUp = () => {
    if (dragFrom.current === null) return;
    const pulled = dragY;
    dragFrom.current = null;
    setDragY(0);
    if (pulled >= SWIPE_CLOSE_PX) requestClose();
  };

  return (
    <dialog
      ref={ref}
      className={[
        styles.dialog,
        size === 'wide' ? styles.wide : '',
        size === 'roomy' ? styles.roomy : '',
        size === 'xl' ? styles.xl : '',
        variant === 'full' ? styles.full : '',
      ].join(' ')}
      style={dragY > 0 ? { transform: `translateY(${dragY}px)` } : undefined}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        requestClose();
      }}
      onClick={(e) => {
        // Click on the backdrop (the dialog element itself) closes.
        if (e.target === ref.current) requestClose();
      }}
    >
      {open ? (
        <div
          className={styles.inner}
          onInput={
            askAfterTyping
              ? (e) => {
                  if (isTyping(e.target)) setTyped(true);
                }
              : undefined
          }
        >
          {variant === 'full' ? null : (
            <div
              className={styles.handle}
              role="presentation"
              title={t.ui.grabHandle}
              onPointerDown={onHandleDown}
              onPointerMove={onHandleMove}
              onPointerUp={onHandleUp}
              onPointerCancel={onHandleUp}
            />
          )}
          <div className={styles.head}>
            {headerStart}
            <h2 id={titleId} className={styles.title}>
              {title}
            </h2>
            <IconButton label={t.actions.close} onClick={requestClose}>
              <Icon name="close" />
            </IconButton>
          </div>
          {/* Stays mounted while the question is shown, so a "keep editing" loses nothing. */}
          <div hidden={confirming} className={styles.body}>
            {children}
          </div>
          {footer && !confirming ? <div className={styles.footer}>{footer}</div> : null}
          {confirming ? (
            <div className={styles.confirm} role="alertdialog" aria-labelledby={`${titleId}-q`}>
              <h3 id={`${titleId}-q`} className={styles.confirmTitle}>
                {t.ui.discardTitle}
              </h3>
              <p className={styles.confirmHint}>{t.ui.discardHint}</p>
              <div className={styles.footer}>
                <Button variant="ghost" data-autofocus onClick={() => setConfirming(false)}>
                  {t.ui.keepEditing}
                </Button>
                <Button variant="danger" onClick={onClose}>
                  {t.ui.discard}
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </dialog>
  );
}
