import { useState } from 'react';
import { generatePassphrase, loadWordlist } from '@nemo/vault-core';
import { t } from '@/strings';
import { Button, NoReadAid, Switch } from '@/ui';
import type { Score } from '../strength';
import styles from '../accounts.module.css';

/** Below "Mittel" a master password is called weak. It only asks for a second look, nothing is forced. */
export const isWeakScore = (score: Score | undefined): boolean => score !== undefined && score <= 1;

/**
 * Shown under the strength meter while the new master password is weak: confirm that it stays, or take
 * a suggestion of several words (EFF list, same generator as the password tool). The vault key
 * derivation is untouched; this is only advice in the form.
 */
export function WeakPasswordHelp({
  acknowledged,
  onAcknowledge,
  onSuggest,
}: {
  acknowledged: boolean;
  onAcknowledge: (value: boolean) => void;
  /** Receives the suggested phrase; the parent puts it into both password fields. */
  onSuggest: (phrase: string) => void;
}) {
  const s = t.accounts.setup;
  const [suggestion, setSuggestion] = useState('');

  async function suggest() {
    const phrase = generatePassphrase(await loadWordlist(), {
      words: 5,
      separator: '-',
      capitalize: false,
      includeNumber: false,
    });
    setSuggestion(phrase);
    onSuggest(phrase);
  }

  return (
    <div className={styles.meter} data-testid="weak-password">
      <span role="note">{s.weakNotice}</span>
      <div>
        <Button onClick={() => void suggest()}>{s.suggest}</Button>
      </div>
      {suggestion ? (
        <span role="status">
          <NoReadAid>{s.suggested(suggestion)}</NoReadAid>
        </span>
      ) : null}
      <Switch label={s.weakAck} checked={acknowledged} onChange={onAcknowledge} />
    </div>
  );
}
