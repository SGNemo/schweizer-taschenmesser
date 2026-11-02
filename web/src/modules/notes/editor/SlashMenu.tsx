import type { Editor } from '@tiptap/core';
import { useEffect, useMemo, useState } from 'react';
import { t } from '@/strings';
import { SLASH_COMMANDS, type SlashCommand } from './commands';
import styles from './Editor.module.css';

interface Open {
  /** Document position of the `/`. */
  from: number;
  query: string;
  left: number;
  top: number;
}

const TRIGGER = /(?:^|\s)\/([\p{L}\d]*)$/u;

/** `/` at the start of a word opens the command list; arrows + Enter/Tab choose, Esc closes. */
export function SlashMenu({ editor, onImage }: { editor: Editor; onImage: () => void }) {
  const [open, setOpen] = useState<Open | null>(null);
  const [pick, setPick] = useState({ q: '', i: 0 });

  useEffect(() => {
    const update = () => {
      const { selection } = editor.state;
      if (!selection.empty || selection.$from.parent.type.name === 'codeBlock')
        return setOpen(null);
      const before = selection.$from.parent.textBetween(
        0,
        selection.$from.parentOffset,
        undefined,
        '￼',
      );
      const m = TRIGGER.exec(before);
      if (!m) return setOpen(null);
      const from = selection.from - m[1]!.length - 1;
      const box = editor.view.coordsAtPos(selection.from);
      const host = editor.view.dom.getBoundingClientRect();
      setOpen({ from, query: m[1]!, left: box.left - host.left, top: box.bottom - host.top });
    };
    editor.on('transaction', update);
    return () => void editor.off('transaction', update);
  }, [editor]);

  const items = useMemo(() => {
    const q = open?.query.toLowerCase() ?? '';
    const all: SlashCommand[] = [
      ...SLASH_COMMANDS,
      {
        id: 'image',
        label: () => t.notes.fmt.image,
        keywords: 'bild image foto',
        run: () => onImage(),
      },
    ];
    return all.filter((c) => !q || `${c.label().toLowerCase()} ${c.keywords}`.includes(q));
  }, [open?.query, onImage]);

  const index = pick.q === (open?.query ?? '') ? pick.i : 0;

  useEffect(() => {
    if (!open) return;
    const choose = (cmd: SlashCommand | undefined) => {
      if (!cmd) return;
      editor
        .chain()
        .focus()
        .deleteRange({ from: open.from, to: editor.state.selection.from })
        .run();
      cmd.run(editor);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(null);
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        const next = items.length
          ? (index + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length
          : 0;
        setPick({ q: open.query, i: next });
      } else if ((e.key === 'Enter' || e.key === 'Tab') && items.length) {
        choose(items[index]);
      } else {
        return;
      }
      e.preventDefault();
      e.stopImmediatePropagation();
    };
    const dom = editor.view.dom;
    dom.addEventListener('keydown', onKey, true);
    return () => dom.removeEventListener('keydown', onKey, true);
  }, [editor, open, items, index]);

  if (!open) return null;
  return (
    <div
      className={styles.slash}
      style={{ left: open.left, top: open.top }}
      role="listbox"
      aria-label={t.notes.fmt.slash}
    >
      {items.length === 0 ? (
        <div className={styles.slashEmpty}>{t.notes.fmt.slashEmpty}</div>
      ) : null}
      {items.map((c, i) => (
        <button
          key={c.id}
          type="button"
          role="option"
          aria-selected={i === index}
          className={i === index ? `${styles.slashItem} ${styles.slashActive}` : styles.slashItem}
          onMouseDown={(e) => {
            e.preventDefault();
            editor
              .chain()
              .focus()
              .deleteRange({ from: open.from, to: editor.state.selection.from })
              .run();
            c.run(editor);
          }}
        >
          {c.label()}
        </button>
      ))}
    </div>
  );
}
