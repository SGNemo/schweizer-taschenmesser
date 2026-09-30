import { useCallback, useState } from 'react';
import { t } from '@/strings';
import { Button, Segmented, Switch, TextField } from '@/ui';
import {
  DEFAULT_PASSPHRASE_OPTIONS,
  DEFAULT_PASSWORD_OPTIONS,
  characterPools,
  generatePassphrase,
  generatePassword,
  loadWordlist,
  MAX_LENGTH,
  MIN_LENGTH,
  passphraseEntropyBits,
  passwordEntropyBits,
  type PassphraseOptions,
  type PasswordOptions,
} from '../generator';
import styles from '../accounts.module.css';

type Mode = 'password' | 'passphrase';

export function GeneratorPanel({ onUse }: { onUse?: (value: string) => void }) {
  const [mode, setMode] = useState<Mode>('password');
  const [pw, setPw] = useState<PasswordOptions>(DEFAULT_PASSWORD_OPTIONS);
  const [phrase, setPhrase] = useState<PassphraseOptions>(DEFAULT_PASSPHRASE_OPTIONS);
  const [wordlist, setWordlist] = useState<readonly string[]>();
  const [value, setValue] = useState(() => generatePassword(DEFAULT_PASSWORD_OPTIONS));

  /** Every change of an option draws a fresh value (from the event handler, not from an effect). */
  const apply = useCallback(
    (next: {
      mode?: Mode;
      pw?: PasswordOptions;
      phrase?: PassphraseOptions;
      words?: readonly string[];
    }) => {
      const m = next.mode ?? mode;
      const p = next.pw ?? pw;
      const ph = next.phrase ?? phrase;
      const list = next.words ?? wordlist;
      if (next.mode) setMode(next.mode);
      if (next.pw) setPw(next.pw);
      if (next.phrase) setPhrase(next.phrase);
      if (m === 'password') {
        const pools = characterPools(p).length;
        setValue(pools > 0 ? generatePassword({ ...p, length: Math.max(p.length, pools) }) : '');
      } else if (list) setValue(generatePassphrase(list, ph));
    },
    [mode, pw, phrase, wordlist],
  );

  const changeMode = (next: Mode) => {
    apply({ mode: next });
    if (next === 'passphrase' && !wordlist) {
      void loadWordlist().then((words) => {
        setWordlist(words);
        setValue(generatePassphrase(words, phrase));
      });
    }
  };

  const poolCount = characterPools(pw).length;
  const bits =
    mode === 'password'
      ? passwordEntropyBits(pw)
      : wordlist
        ? passphraseEntropyBits(wordlist.length, phrase)
        : 0;

  const g = t.accounts.generator;
  return (
    <div className={styles.grid} data-testid="generator">
      <Segmented
        label={g.mode}
        value={mode}
        onChange={changeMode}
        options={[
          { value: 'password', label: g.password },
          { value: 'passphrase', label: g.passphrase },
        ]}
      />
      <output className={styles.generated} aria-live="polite" data-testid="generated">
        {value || (poolCount === 0 && mode === 'password' ? g.needOne : '…')}
      </output>
      {bits > 0 ? <p className={styles.notice}>{g.bits(bits)}</p> : null}

      {mode === 'password' ? (
        <>
          <TextField
            label={`${g.length} (${pw.length})`}
            type="range"
            min={MIN_LENGTH}
            max={MAX_LENGTH}
            value={pw.length}
            onChange={(e) => apply({ pw: { ...pw, length: Number(e.target.value) } })}
          />
          <Switch
            label={g.lower}
            checked={pw.lower}
            onChange={(v) => apply({ pw: { ...pw, lower: v } })}
          />
          <Switch
            label={g.upper}
            checked={pw.upper}
            onChange={(v) => apply({ pw: { ...pw, upper: v } })}
          />
          <Switch
            label={g.digits}
            checked={pw.digits}
            onChange={(v) => apply({ pw: { ...pw, digits: v } })}
          />
          <Switch
            label={g.symbols}
            checked={pw.symbols}
            onChange={(v) => apply({ pw: { ...pw, symbols: v } })}
          />
          <Switch
            label={g.ambiguous}
            checked={pw.avoidAmbiguous}
            onChange={(v) => apply({ pw: { ...pw, avoidAmbiguous: v } })}
          />
        </>
      ) : (
        <>
          <TextField
            label={`${g.words} (${phrase.words})`}
            type="range"
            min={3}
            max={10}
            value={phrase.words}
            onChange={(e) => apply({ phrase: { ...phrase, words: Number(e.target.value) } })}
          />
          <TextField
            label={g.separator}
            maxLength={3}
            value={phrase.separator}
            onChange={(e) => apply({ phrase: { ...phrase, separator: e.target.value } })}
          />
          <Switch
            label={g.capitalize}
            checked={phrase.capitalize}
            onChange={(v) => apply({ phrase: { ...phrase, capitalize: v } })}
          />
          <Switch
            label={g.number}
            checked={phrase.includeNumber}
            onChange={(v) => apply({ phrase: { ...phrase, includeNumber: v } })}
          />
        </>
      )}
      <div className={styles.inline}>
        <Button onClick={() => apply({})}>{g.regenerate}</Button>
        {onUse ? (
          <Button variant="primary" disabled={!value} onClick={() => onUse(value)}>
            {g.use}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
