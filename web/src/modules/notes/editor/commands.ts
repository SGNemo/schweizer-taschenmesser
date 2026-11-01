import type { Editor } from '@tiptap/core';
import { t } from '@/strings';
import { type HighlightTone, toneAttrs } from './extensions';

export interface SlashCommand {
  id: string;
  label: () => string;
  /** Lowercase search words in all UI languages that matter (German + English). */
  keywords: string;
  run: (editor: Editor) => void;
}

const c = (e: Editor) => e.chain().focus();

/** The `/` menu; the same actions as the toolbar and the Markdown shortcuts. */
export const SLASH_COMMANDS: SlashCommand[] = [
  {
    id: 'h1',
    label: () => t.notes.fmt.h1,
    keywords: 'h1 heading überschrift titel',
    run: (e) => void c(e).toggleHeading({ level: 1 }).run(),
  },
  {
    id: 'h2',
    label: () => t.notes.fmt.h2,
    keywords: 'h2 heading überschrift',
    run: (e) => void c(e).toggleHeading({ level: 2 }).run(),
  },
  {
    id: 'h3',
    label: () => t.notes.fmt.h3,
    keywords: 'h3 heading überschrift',
    run: (e) => void c(e).toggleHeading({ level: 3 }).run(),
  },
  {
    id: 'bullet',
    label: () => t.notes.fmt.bullet,
    keywords: 'liste list bullet punkte',
    run: (e) => void c(e).toggleBulletList().run(),
  },
  {
    id: 'ordered',
    label: () => t.notes.fmt.ordered,
    keywords: 'nummeriert numbered ordered',
    run: (e) => void c(e).toggleOrderedList().run(),
  },
  {
    id: 'task',
    label: () => t.notes.fmt.task,
    keywords: 'checkliste todo task check aufgabe',
    run: (e) => void c(e).toggleTaskList().run(),
  },
  {
    id: 'quote',
    label: () => t.notes.fmt.quote,
    keywords: 'zitat quote',
    run: (e) => void c(e).toggleBlockquote().run(),
  },
  {
    id: 'code',
    label: () => t.notes.fmt.codeBlock,
    keywords: 'code block codeblock',
    run: (e) => void c(e).toggleCodeBlock().run(),
  },
  {
    id: 'table',
    label: () => t.notes.fmt.table,
    keywords: 'tabelle table',
    run: (e) => void c(e).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
  },
  {
    id: 'rule',
    label: () => t.notes.fmt.rule,
    keywords: 'trennlinie linie divider rule hr',
    run: (e) => void c(e).setHorizontalRule().run(),
  },
  {
    id: 'highlight',
    label: () => t.notes.fmt.highlight,
    keywords: 'hervorheben highlight markieren',
    run: (e) => void c(e).toggleHighlight(toneAttrs('accent')).run(),
  },
];

export const toneLabel = (tone: HighlightTone): string => t.notes.tones[tone];
