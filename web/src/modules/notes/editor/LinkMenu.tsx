import type { Editor } from '@tiptap/core';
import { useEffect, useMemo, useState } from 'react';
import { t } from '@/strings';
import styles from './Editor.module.css';

interface Open {
  /** Document position of the first `[`. */
  from: number;
  query: string;
  left: number;
  top: number;
}

const TRIGGER = /\[\[([^\]\n|]*)$/;

/** Typing `[[` lists page titles; arrows + Enter/Tab insert a link, Esc closes. The new title becomes a link too. */
export function LinkMenu({
  editor,
  titles,
}: {
  editor: Editor;
  /** Called when the menu opens or the query changes: the current page titles. */
  titles: (query: string) => string[];
}) {
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
      const from = selection.from - m[1]!.length - 2;
      const box = editor.view.coordsAtPos(selection.from);
      const host = editor.view.dom.getBoundingClientRect();
      setOpen({ from, query: m[1]!, left: box.left - host.left, top: box.bottom - host.top });
    };
    editor.on('transaction', update);
    return () => void editor.off('transaction', update);
  }, [editor]);

  const items = useMemo(() => {
    if (!open) return [];
    const found = titles(open.query);
    const q = open.query.trim();
    const exact = found.some((x) => x.toLowerCase() === q.toLowerCase());
    return q && !exact ? [...found, q] : found;
  }, [open, titles]);

  const index = open && pick.q === open.query ? Math.min(pick.i, Math.max(items.length - 1, 0)) : 0;

  useEffect(() => {
    if (!open) return;
    const choose = (target: string | undefined) => {
      if (!target) return;
      const to = editor.state.selection.from;
      editor
        .chain()
        .focus()
        .deleteRange({ from: open.from, to })
        .insertContent({ type: 'wikiLink', attrs: { target } })
        .insertContent(' ')
        .run();
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

  if (!open || items.length === 0) return null;
  return (
    <div
      className={styles.slash}
      style={{ left: open.left, top: open.top }}
      role="listbox"
      aria-label={t.notes.links.menu}
    >
      {items.map((title, i) => {
        const isNew =
          i === items.length - 1 &&
          open.query.trim() === title &&
          !titles(open.query).includes(title);
        return (
          <button
            key={`${i}-${title}`}
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
                .insertContent({ type: 'wikiLink', attrs: { target: title } })
                .insertContent(' ')
                .run();
            }}
          >
            {isNew ? t.notes.links.newPage(title) : title}
          </button>
        );
      })}
    </div>
  );
}
