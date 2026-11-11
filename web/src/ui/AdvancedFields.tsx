import { useState, type ReactNode } from 'react';
import { usePageChromeStore } from '@/core/shell/pageChrome';
import { useAdvanced } from '@/core/settings/comfort';
import { tAdvanced } from '@/strings.advanced';
import { Button } from './Button';
import { Switch } from './Fields';
import buttonStyles from './Button.module.css';
import type { RowMenuItem } from './RowMenu';
import styles from './AdvancedFields.module.css';

/**
 * "Erweitert" switch for a module header: Basis (default) or Erweitert for this module. The choice
 * is remembered (synced) and overrides the global "Alle Module Erweitert" setting.
 */
export function AdvancedToggle({ moduleId }: { moduleId: string }) {
  const [advanced, setAdvanced] = useAdvanced(moduleId);
  const tx = tAdvanced.use();
  const inMenu = usePageChromeStore((s) => s.chrome.advancedInMenu);
  if (inMenu) return null;
  return <Switch label={tx.switchLabel} checked={advanced} onChange={setAdvanced} />;
}

/**
 * The same switch as an entry of the page's "⋯" menu (Identity 4.0, rule 4: the head holds the page's one action
 * and its menu, no switch): `<StartDataMenu moduleId="…" items={[useAdvancedMenuItem('…')]} />`.
 */
export function useAdvancedMenuItem(moduleId: string): RowMenuItem {
  const [advanced, setAdvanced] = useAdvanced(moduleId);
  const tx = tAdvanced.use();
  return {
    id: 'advanced',
    label: tx.switchLabel,
    checked: advanced,
    onSelect: () => setAdvanced(!advanced),
  };
}

/**
 * Rarely used fields of a form. Shown when the module is in the Erweitert view, when one of them
 * already holds data (`hasData`: nothing is ever hidden that is in use), or after "Mehr Felder"
 * in this dialog (that does not change the module's setting). Nothing important lives only here.
 */
export function AdvancedFields({
  moduleId,
  hasData = false,
  summary,
  children,
}: {
  moduleId: string;
  hasData?: boolean;
  /** While the fields are folded: what they will save as it stands ("Heute · Girokonto"), so nothing is a surprise. */
  summary?: ReactNode;
  children: ReactNode;
}) {
  const [advanced] = useAdvanced(moduleId);
  const [revealed, setRevealed] = useState(false);
  const tx = tAdvanced.use();
  if (advanced || hasData || revealed) return <>{children}</>;
  return (
    <div className={styles.folded}>
      <Button
        variant="ghost"
        className={buttonStyles.flushStart}
        aria-label={tx.moreFieldsAria}
        onClick={() => setRevealed(true)}
      >
        {tx.moreFields}
      </Button>
      {summary ? (
        <span className={styles.summary} data-testid="more-fields-summary">
          {summary}
        </span>
      ) : null}
    </div>
  );
}
