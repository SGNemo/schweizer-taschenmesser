import type { Editor } from '@tiptap/core';
import { TextSelection } from '@tiptap/pm/state';
import { EditorContent, useEditor } from '@tiptap/react';
import { useCallback, useEffect, useRef } from 'react';
import { t } from '@/strings';
import { BubbleToolbar } from './BubbleToolbar';
import styles from './Editor.module.css';
import { noteExtensions } from './extensions';
import { storeImage } from './images';
import { SlashMenu } from './SlashMenu';

export interface EditorSurfaceProps {
  /** Markdown the editor starts with. */
  initial: string;
  /** Called on every change with a getter: serialise only when you need the text. */
  onDirty: (read: () => string) => void;
  /** Editor lost focus (a good moment to save). */
  onBlur: () => void;
  width: 'narrow' | 'medium' | 'full';
  autoFocus: boolean;
  onError: (message: string) => void;
  /** The editor exists and `apiRef` is filled. */
  onReady?: () => void;
  /** Filled with imperative helpers once the editor exists. */
  apiRef?: { current: { clear: () => void; focus: () => void } | null };
}

/** The rich-text surface (lazy chunk of the notes route). Markdown in, Markdown out. */
export default function EditorSurface({
  initial,
  onDirty,
  onBlur,
  width,
  autoFocus,
  onError,
  apiRef,
  onReady,
}: EditorSurfaceProps) {
  const fileInput = useRef<HTMLInputElement>(null);
  const editorRef = useRef<Editor | null>(null);

  const insertImages = useCallback(
    async (files: File[]) => {
      for (const file of files) {
        try {
          const src = await storeImage(file);
          editorRef.current
            ?.chain()
            .focus()
            .setImage({ src, alt: file.name.replace(/\.[^.]+$/, '') })
            .run();
        } catch {
          onError(t.notes.imageFailed);
        }
      }
    },
    [onError],
  );

  const editor = useEditor({
    extensions: noteExtensions(),
    content: initial,
    contentType: 'markdown',
    autofocus: autoFocus ? 'end' : false,
    shouldRerenderOnTransaction: false,
    editorProps: {
      attributes: {
        'aria-label': t.notes.editorLabel,
        'aria-multiline': 'true',
        role: 'textbox',
        spellcheck: 'true',
      },
      handlePaste: (_view, event) => {
        const files = [...(event.clipboardData?.files ?? [])].filter((f) =>
          f.type.startsWith('image/'),
        );
        if (!files.length) return false;
        void insertImages(files);
        return true;
      },
      handleDrop: (_view, event) => {
        const files = [...(event.dataTransfer?.files ?? [])].filter((f) =>
          f.type.startsWith('image/'),
        );
        if (!files.length) return false;
        event.preventDefault();
        void insertImages(files);
        return true;
      },
    },
    onUpdate: ({ editor: e }) => onDirty(() => e.getMarkdown()),
    onBlur: () => onBlur(),
  });

  useEffect(() => {
    editorRef.current = editor;
    if (apiRef && editor)
      apiRef.current = {
        // Synchronous (TipTap's own `focus()` is deferred, so fast typing would still land in the title).
        focus: () => {
          editor.view.dispatch(
            editor.state.tr.setSelection(TextSelection.atStart(editor.state.doc)),
          );
          editor.view.focus();
        },
        clear: () => void editor.chain().focus().clearContent(true).run(),
      };
    if (editor) onReady?.();
    // The shell moves focus to the page's main region after a navigation; when that lands after the
    // editor's own autofocus, take focus back (only from the page itself, never from a field).
    const timers: ReturnType<typeof setTimeout>[] = [];
    if (editor && autoFocus) {
      for (const ms of [50, 250]) {
        timers.push(
          setTimeout(() => {
            const a = document.activeElement;
            if (
              !editor.isDestroyed &&
              !editor.isFocused &&
              (a === document.body || a?.tagName === 'MAIN')
            )
              editor.commands.focus('end');
          }, ms),
        );
      }
    }
    return () => {
      timers.forEach(clearTimeout);
      if (apiRef) apiRef.current = null;
    };
    // `onReady` is a fresh function each render; the editor appearing is the only trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, apiRef]);

  if (!editor) return null;
  return (
    <div className={styles.surface} data-width={width}>
      <EditorContent editor={editor} className={styles.content} />
      <BubbleToolbar editor={editor} />
      <SlashMenu editor={editor} onImage={() => fileInput.current?.click()} />
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          const files = [...(e.target.files ?? [])];
          e.target.value = '';
          void insertImages(files);
        }}
      />
    </div>
  );
}
