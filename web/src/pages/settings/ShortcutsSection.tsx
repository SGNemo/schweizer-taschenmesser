import { useState } from 'react';
import { FIXED_SHORTCUTS } from '@/core/keyboard/fixed';
import { actionLabel, shortcutActions, shortcutRowKey } from '@/core/keyboard/labels';
import {
  assignKey,
  chordLetterOf,
  DEFAULT_FKEYS,
  resetKey,
  resolveKeys,
  type AssignResult,
  type FKeyAction,
} from '@/core/keyboard/map';
import { useShortcutPrefs, writeShortcutPrefs } from '@/core/keyboard/prefs';
import { useTools } from '@/core/tools/state';
import { keyCaps } from '@/core/voice/keys';
import { useVoicePrefs } from '@/core/voice/settings';
import { tKeys } from '@/strings.keys';
import { tSettings4 } from '@/strings.settings4';
import { useUiStore } from '@/stores/ui';
import { Button, KeyRecorder, Keys, SettingRow } from '@/ui';
import styles from './settings.module.css';

/**
 * Settings → Allgemein → Tastenkürzel: one row per action with its key (record, "Standard", remove),
 * the fixed `T` chords of the tools that are on, and the voice key (changed in its own section).
 * A key belongs to exactly one action: a taken key is refused with a text, never moved silently.
 */
export function ShortcutsSection() {
  const tx = tKeys.use();
  const t4 = tSettings4.use().shortcuts;
  const toast = useUiStore((st) => st.toast);
  const prefs = useShortcutPrefs();
  const voice = useVoicePrefs();
  const tools = useTools();
  const [messages, setMessages] = useState<Partial<Record<FKeyAction, string>>>({});
  const keys = resolveKeys(prefs, voice.key);

  function apply(action: FKeyAction, result: AssignResult, key: string) {
    const message = result.ok
      ? ''
      : result.reason === 'rejected'
        ? tx.rejected
        : result.by === 'voice'
          ? tx.takenVoice(key)
          : tx.taken(key, actionLabel(result.by));
    setMessages((m) => ({ ...m, [action]: message }));
    if (result.ok) writeShortcutPrefs(result.prefs);
  }

  const chords = (tools?.active ?? []).flatMap((tool) => {
    const letter = chordLetterOf(tool.id);
    return letter ? [{ id: tool.id, name: tool.name, letter: letter.toUpperCase() }] : [];
  });

  return (
    <>
      <p className={styles.muted}>{tx.intro}</p>
      <p className={styles.muted}>{tx.touch}</p>
      {shortcutActions().map((action) => {
        const key = keys[action];
        const label = actionLabel(action);
        const message = messages[action];
        return (
          <SettingRow key={action} id={`shortcuts--${shortcutRowKey(action)}`} label={label}>
            <div>
              <KeyRecorder
                value={key}
                onRecord={(next) => apply(action, assignKey(prefs, action, next, voice.key), next)}
                onStart={() => setMessages((m) => ({ ...m, [action]: '' }))}
                display={(v) => keyCaps(v).join(' + ')}
                recordingText={tx.recording}
                emptyText={tx.none}
                ariaLabel={`${tx.record(label)}: ${key ? keyCaps(key).join(' + ') : tx.none}`}
                testId={`shortcut-${shortcutRowKey(action)}`}
              />{' '}
              {key !== DEFAULT_FKEYS[action] ? (
                <Button
                  onClick={() =>
                    apply(action, resetKey(prefs, action, voice.key), DEFAULT_FKEYS[action])
                  }
                  aria-label={`${tx.reset}: ${label}`}
                >
                  {tx.reset}
                  {DEFAULT_FKEYS[action] ? ` (${DEFAULT_FKEYS[action]})` : ''}
                </Button>
              ) : null}{' '}
              {key ? (
                <Button
                  variant="ghost"
                  onClick={() => apply(action, assignKey(prefs, action, '', voice.key), '')}
                  aria-label={`${tx.clear}: ${label}`}
                >
                  {tx.clear}
                </Button>
              ) : null}
              {message ? (
                <p role="alert" className={styles.muted} data-testid="shortcut-message">
                  {message}
                </p>
              ) : null}
            </div>
          </SettingRow>
        );
      })}
      {shortcutActions().some((a) => keys[a] !== DEFAULT_FKEYS[a]) ? (
        <div>
          <Button
            variant="ghost"
            data-testid="shortcuts-reset-all"
            onClick={() => {
              writeShortcutPrefs({ keys: {} });
              toast(t4.resetAllDone);
            }}
          >
            {t4.resetAll}
          </Button>
        </div>
      ) : null}
      <SettingRow id="shortcuts--fixed" label={t4.fixedTitle} description={t4.fixedHint} stacked>
        <ul aria-label={t4.fixedTitle} data-testid="shortcut-fixed">
          {FIXED_SHORTCUTS.map((f) => (
            <li key={f.id}>
              <Keys keys={keyCaps(f.keys)} /> {t4.fixed[f.id]}
            </li>
          ))}
        </ul>
      </SettingRow>
      <SettingRow id="shortcuts--chords" label={tx.groupChords} description={tx.chordsHint} stacked>
        {chords.length === 0 ? (
          <p className={styles.muted}>{tx.chordsNone}</p>
        ) : (
          <ul aria-label={tx.groupChords} data-testid="shortcut-chords">
            {chords.map((c) => (
              <li key={c.id}>
                <Keys keys={['T', tx.then(c.letter)]} /> {c.name}
              </li>
            ))}
          </ul>
        )}
      </SettingRow>
      <SettingRow id="shortcuts--voice" label={tx.voice} description={tx.voiceWhere}>
        {voice.key ? (
          <span data-testid="shortcut-voice">
            <Keys keys={keyCaps(voice.key)} />
            {voice.enabled ? '' : ` ${tx.voiceOff}`}
          </span>
        ) : (
          <span className={styles.muted}>{tx.none}</span>
        )}
      </SettingRow>
    </>
  );
}
