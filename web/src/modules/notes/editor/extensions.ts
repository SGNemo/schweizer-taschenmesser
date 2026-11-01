import type { Extensions, MarkdownLexerConfiguration, MarkdownToken } from '@tiptap/core';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import Highlight from '@tiptap/extension-highlight';
import { TaskItem, TaskList } from '@tiptap/extension-list';
import { Table, TableCell, TableHeader, TableRow } from '@tiptap/extension-table';
import { Placeholder } from '@tiptap/extensions';
import { Markdown } from '@tiptap/markdown';
import StarterKit from '@tiptap/starter-kit';
import { common, createLowlight } from 'lowlight';
import { t } from '@/strings';
import { NoteImage } from './imageNode';

/** Highlight colours = semantic tokens (`--<tone>-soft`); the text stays readable without colour. */
export const HIGHLIGHT_TONES = ['accent', 'success', 'warning', 'danger', 'info'] as const;
export type HighlightTone = (typeof HIGHLIGHT_TONES)[number];

const TONE = new RegExp(`^==(?:\\{(${HIGHLIGHT_TONES.join('|')})\\})?(?!\\s)([^=]*[^=\\s])==`);

/** `==text==` (neutral) or `=={success}text==`; other Markdown tools show the braces, nothing is lost. */
const ToneHighlight = Highlight.extend({
  addAttributes() {
    return {
      tone: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-tone'),
        renderHTML: (attrs) => (attrs.tone ? { 'data-tone': String(attrs.tone) } : {}),
      },
    };
  },
  renderMarkdown(node, h) {
    const tone = (node.attrs as { tone?: string | null } | undefined)?.tone;
    return `==${tone ? `{${tone}}` : ''}${h.renderChildren(node)}==`;
  },
  parseMarkdown(token, h) {
    const tone = (token as { tone?: string }).tone;
    return h.applyMark('highlight', h.parseInline(token.tokens ?? []), tone ? { tone } : undefined);
  },
  markdownTokenizer: {
    name: 'highlight',
    level: 'inline',
    start: (src: string) => src.indexOf('=='),
    tokenize(src: string, _tokens: MarkdownToken[], lexer: MarkdownLexerConfiguration) {
      const m = TONE.exec(src);
      if (!m) return undefined;
      const text = m[2]!.trim();
      return { type: 'highlight', raw: m[0], text, tone: m[1], tokens: lexer.inlineTokens(text) };
    },
  },
});

const lowlight = createLowlight();
for (const name of [
  'bash',
  'css',
  'javascript',
  'json',
  'markdown',
  'python',
  'rust',
  'sql',
  'typescript',
  'xml',
  'yaml',
  'java',
  'csharp',
  'go',
] as const) {
  const grammar = common[name];
  if (grammar) lowlight.register(name, grammar);
}

/** Highlight attributes are typed as `{ color }` by TipTap; ours carry a `tone` instead. */
export const toneAttrs = (tone: HighlightTone) => ({ tone }) as unknown as { color: string };

/** The editor schema for notes; Markdown is the stored format (see `markdown.ts`). */
export function noteExtensions(): Extensions {
  return [
    StarterKit.configure({ heading: { levels: [1, 2, 3] }, codeBlock: false }),
    CodeBlockLowlight.configure({ lowlight }),
    ToneHighlight.configure({ multicolor: true }),
    NoteImage,
    Table,
    TableRow,
    TableHeader,
    TableCell,
    TaskList,
    TaskItem.configure({ nested: true }),
    Placeholder.configure({
      placeholder: () => t.notes.placeholder,
    }),
    Markdown,
  ];
}
