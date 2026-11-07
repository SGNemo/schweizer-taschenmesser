import { useState, type ReactNode } from 'react';
import { useHideValues } from '@/core/focus/hideValues';
import { NoReadAid } from '@/core/text/ReadableText';
import { t } from '@/strings';
import styles from './SensitiveValue.module.css';

/**
 * Wraps a money figure (or a block of them). With the device setting "Werte ausblenden" on, it shows a
 * neutral placeholder instead; one tap reveals the content until the view is left (state lives in the
 * component, so it is hidden again elsewhere). Screen readers get "ausgeblendet", never the number.
 * Use in a widget: `<SensitiveValue>{formatMoney(x, cur)}</SensitiveValue>`.
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
  if (!hide || revealed) return <>{children}</>;
  return (
    <>
      <button
        type="button"
        className={`${styles.mask} ${className ?? ''}`}
        onClick={() => setRevealed(true)}
        aria-label={`${t.widgets.valueHidden}. ${t.widgets.valueReveal}`}
        data-testid="sensitive-value"
      >
        <NoReadAid>
          <span aria-hidden="true">••••</span>
        </NoReadAid>
      </button>
      {note ? <p className={styles.note}>{note}</p> : null}
    </>
  );
}
