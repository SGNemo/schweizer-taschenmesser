import { actionLabel, shortcutActions } from '@/core/keyboard/labels';
import { chordLetterOf, resolveKeys } from '@/core/keyboard/map';
import { useShortcutPrefs } from '@/core/keyboard/prefs';
import { useTools } from '@/core/tools/state';
import { keyCaps } from '@/core/voice/keys';
import { useVoicePrefs } from '@/core/voice/settings';
import { voiceSupport } from '@/core/voice/support';
import { t } from '@/strings';
import { tKeys } from '@/strings.keys';
import { tCockpit } from '@/strings.cockpit';
import { useUiStore } from '@/stores/ui';
import { Dialog } from '@/ui';
import styles from './ShortcutSheet.module.css';

interface Item {
  id: string;
  keys: readonly string[];
  text: string;
}

function Rows({ items }: { items: readonly Item[] }) {
  return (
    <dl className={styles.list}>
      {items.map((item) => (
        <div key={item.id} className={styles.row}>
          <dt className={styles.keys}>
            {item.keys.map((k) => (
              <kbd key={k} className={styles.kbd}>
                {k}
              </kbd>
            ))}
          </dt>
          <dd className={styles.text}>{item.text}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * The voice key belongs among the F-keys when it is one: it sorts in by number; any other key
 * (a letter, a chord) stays at the end of the group.
 */
export function orderFKeys(fkeys: readonly Item[], speak: readonly Item[]): Item[] {
  const rank = (i: Item) =>
    /^F\d+$/.test(i.keys[0]!) ? parseInt(i.keys[0]!.slice(1), 10) : Infinity;
  return [...fkeys, ...speak].sort((a, b) => rank(a) - rank(b));
}

/** `?` – everything a key reaches: the fixed keys, the `T` chords, the F-keys (as set) and the voice key. */
export function ShortcutSheet() {
  const open = useUiStore((s) => s.shortcutsOpen);
  const setOpen = useUiStore((s) => s.setShortcutsOpen);
  const prefs = useShortcutPrefs();
  const voice = useVoicePrefs();
  const tools = useTools();
  const tx = tKeys.get();

  const fixed = t.shortcuts.items.map((i) => ({ id: i.text, keys: i.keys, text: i.text }));
  const resolved = resolveKeys(prefs, voice.key);
  const fkeys: Item[] = shortcutActions()
    .filter((a) => resolved[a])
    .map((a) => ({ id: a, keys: [resolved[a]], text: actionLabel(a) }))
    .sort((a, b) => parseInt(a.keys[0]!.slice(1), 10) - parseInt(b.keys[0]!.slice(1), 10));
  const chords: Item[] = (tools?.active ?? []).flatMap((tool) => {
    const letter = chordLetterOf(tool.id);
    return letter
      ? [{ id: tool.id, keys: ['T', tx.then(letter.toUpperCase())], text: tool.name }]
      : [];
  });
  const speak: Item[] =
    voice.enabled && voice.key && voiceSupport().ok
      ? [{ id: 'voice', keys: keyCaps(voice.key), text: t.voice.shortcutText }]
      : [];
  const fgroup = orderFKeys(fkeys, speak);

  return (
    <Dialog open={open} onClose={() => setOpen(false)} title={t.shortcuts.title}>
      <p className={styles.hint}>{t.shortcuts.hint}</p>
      <Rows items={fixed} />
      {chords.length > 0 ? (
        <>
          <h3 className={styles.group}>{tx.sheetChords}</h3>
          <Rows items={chords} />
        </>
      ) : null}
      {fkeys.length > 0 || speak.length > 0 ? (
        <>
          <h3 className={styles.group}>{tx.sheetFkeys}</h3>
          <Rows items={fgroup} />
          <p className={styles.hint}>{tCockpit.get().shortcutEsc}</p>
        </>
      ) : null}
    </Dialog>
  );
}
