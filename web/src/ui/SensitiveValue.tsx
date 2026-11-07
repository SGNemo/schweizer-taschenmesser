import { useState, type ReactNode } from 'react';
import { useHideValues } from '@/core/focus/hideValues';
import { NoReadAid } from '@/core/text/ReadableText';
import { t } from '@/strings';
import { Icon } from './icons';
import styles from './SensitiveValue.module.css';

/**
 * Wraps a money figure (or a block of them). With the device setting "Werte ausblenden" on, it shows a
 * neutral placeholder instead; one tap reveals the content until the view is left (state lives in the
 * component, so it is hidden again elsewhere; no timer, that would be one more stimulus). While revealed a
 * quiet "Wieder ausblenden" control hides it again. Screen readers get "ausgeblendet", never the number.
 * Use in a widget: `<SensitiveValue>{formatMoney(x, cur)}</SensitiveValue>`. Wrap only real data, not
 * loading or empty states.
 * `note` is shown below the placeholder only while hidden (e.g. a context line without amounts).
 */
export function SensitiveValue({
  children,
  note,
  className,
}: {
  children: ReactNode;
  note?: string;
  className?: string;
}) {
  const hide = useHideValues();
  const [revealed, setRevealed] = useState(false);
  if (!hide) return <>{children}</>;
  if (revealed)
    return (
      <>
        {children}
        <button
          type="button"
          className={styles.again}
          onClick={() => setRevealed(false)}
          data-testid="sensitive-rehide"
        >
          <Icon name="eyeOff" size={16} />
          {t.widgets.valueRehide}
        </button>
      </>
    );
  return (
    <>
      <button
        type="button"
        className={`${styles.mask} ${className ?? ''}`}
        onClick={() => setRevealed(true)}
        aria-label={`${t.widgets.valueHidden}. ${t.widgets.valueReveal}`}
        data-testid="sensitive-value"
      >
        <Icon name="eyeOff" size={16} />
        <NoReadAid>
          <span aria-hidden="true">••••</span>
        </NoReadAid>
        <span className={styles.hint} aria-hidden="true">
          {t.widgets.valueReveal}
        </span>
      </button>
      {note ? <p className={styles.note}>{note}</p> : null}
    </>
  );
}
