import type { Editor } from '@tiptap/core';
import { useEditorState } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import { useState } from 'react';
import { t } from '@/strings';
import { Icon } from '@/ui';
import { toneLabel } from './commands';
import styles from './Editor.module.css';
import { HIGHLIGHT_TONES, toneAttrs } from './extensions';

const URL_HINT = 'https://';

/** Floating toolbar for a selection; every button is ≥ 44 px and has a text label for screen readers. */
export function BubbleToolbar({ editor }: { editor: Editor }) {
  const [mode, setMode] = useState<'main' | 'tone' | 'link'>('main');
  const [url, setUrl] = useState('');
  const on = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      strike: e.isActive('strike'),
      code: e.isActive('code'),
      link: e.isActive('link'),
      highlight: e.isActive('highlight'),
    }),
  });

  const btn = (label: string, active: boolean, run: () => void, child: React.ReactNode) => (
    <button
      type="button"
      className={active ? `${styles.tool} ${styles.toolOn}` : styles.tool}
      aria-label={label}
      title={label}
      aria-pressed={active}
      onMouseDown={(e) => e.preventDefault()}
      onClick={run}
    >
      {child}
    </button>
  );
  const chain = () => editor.chain().focus();

  return (
    <BubbleMenu
      editor={editor}
      options={{ placement: 'top', onHide: () => setMode('main') }}
      shouldShow={({ editor: e, state }) =>
        e.isEditable && !state.selection.empty && !e.isActive('codeBlock')
      }
    >
      <div className={styles.bubble} role="toolbar" aria-label={t.notes.fmt.slash}>
        {mode === 'main' ? (
          <>
            {btn(t.notes.fmt.bold, on.bold, () => void chain().toggleBold().run(), <b>B</b>)}
            {btn(t.notes.fmt.italic, on.italic, () => void chain().toggleItalic().run(), <i>I</i>)}
            {btn(t.notes.fmt.strike, on.strike, () => void chain().toggleStrike().run(), <s>S</s>)}
            {btn(
              t.notes.fmt.code,
              on.code,
              () => void chain().toggleCode().run(),
              <code>{'</>'}</code>,
            )}
            {btn(
              t.notes.fmt.highlight,
              on.highlight,
              () => setMode('tone'),
              <Icon name="star" size={18} />,
            )}
            {btn(
              t.notes.fmt.link,
              on.link,
              () => {
                setUrl((editor.getAttributes('link') as { href?: string }).href ?? '');
                setMode('link');
              },
              <Icon name="external" size={18} />,
            )}
          </>
        ) : null}
        {mode === 'tone' ? (
          <>
            {HIGHLIGHT_TONES.map((tone) => (
              <button
                key={tone}
                type="button"
                className={`${styles.tool} ${styles.toneBtn}`}
                data-tone={tone}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  void chain().setHighlight(toneAttrs(tone)).run();
                  setMode('main');
                }}
              >
                {toneLabel(tone)}
              </button>
            ))}
            {btn(
              t.notes.fmt.highlightOff,
              false,
              () => {
                void chain().unsetHighlight().run();
                setMode('main');
              },
              <Icon name="close" size={18} />,
            )}
          </>
        ) : null}
        {mode === 'link' ? (
          <form
            className={styles.linkForm}
            onSubmit={(e) => {
              e.preventDefault();
              const href = url.trim();
              if (href) void chain().extendMarkRange('link').setLink({ href }).run();
              else void chain().extendMarkRange('link').unsetLink().run();
              setMode('main');
            }}
          >
            <input
              className={styles.linkInput}
              type="url"
              inputMode="url"
              aria-label={t.notes.fmt.linkUrl}
              placeholder={URL_HINT}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              autoFocus
            />
            <button type="submit" className={styles.tool}>
              {t.notes.fmt.linkApply}
            </button>
            {on.link ? (
              <button
                type="button"
                className={styles.tool}
                onClick={() => {
                  void chain().extendMarkRange('link').unsetLink().run();
                  setMode('main');
                }}
              >
                {t.notes.fmt.linkRemove}
              </button>
            ) : null}
          </form>
        ) : null}
      </div>
    </BubbleMenu>
  );
}
