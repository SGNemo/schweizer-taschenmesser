import { useState } from 'react';
import type { Stored } from '@/core/db/types';
import { getPlatform } from '@/core/platform';
import { useUiStore } from '@/stores/ui';
import { t } from '@/strings';
import { Button, Dialog } from '@/ui';
import { printPages } from '../editor/print';
import { pagesToMarkdown, pagesToText, safeFileName } from '../exchange';
import type { Note } from '../schema';
import styles from './Dialogs.module.css';

export interface ExportScope {
  id: string;
  label: string;
  /** Used for the file name. */
  name: string;
  pages: Stored<Note>[];
}

/** Export pages (this one, a notebook, everything) as Markdown, text or a print view for PDF. */
export function ExportDialog({
  open,
  scopes,
  onClose,
}: {
  open: boolean;
  scopes: ExportScope[];
  onClose: () => void;
}) {
  const [scopeId, setScopeId] = useState<string | null>(null);
  const scope = scopes.find((s) => s.id === scopeId) ?? scopes[0];
  const toast = useUiStore.getState().toast;
  const s = t.notes.exportMenu;

  async function save(kind: 'md' | 'txt') {
    if (!scope || scope.pages.length === 0) return toast(s.empty);
    const data =
      kind === 'md'
        ? pagesToMarkdown(scope.pages, t.notes.scratch)
        : pagesToText(scope.pages, t.notes.scratch);
    const outcome = await getPlatform().saveFile({
      fileName: `${safeFileName(scope.name)}.${kind}`,
      data,
      mime: kind === 'md' ? 'text/markdown' : 'text/plain',
    });
    if (outcome === 'saved') toast(s.done);
    onClose();
  }

  async function print() {
    if (!scope || scope.pages.length === 0) return toast(s.empty);
    toast(s.printHint);
    onClose();
    await printPages(scope.pages, t.notes.scratch, scope.name);
  }

  return (
    <Dialog open={open} onClose={onClose} title={s.title}>
      <div className={styles.history}>
        <ul className={styles.choiceList} aria-label={s.title}>
          {scopes.map((sc) => (
            <li key={sc.id}>
              <button
                type="button"
                className={styles.choice}
                aria-pressed={sc.id === scope?.id}
                aria-current={sc.id === scope?.id}
                onClick={() => setScopeId(sc.id)}
              >
                {sc.label}
              </button>
            </li>
          ))}
        </ul>
        <div className={styles.actions}>
          <Button onClick={() => void save('md')}>{s.markdown}</Button>
          <Button onClick={() => void save('txt')}>{s.text}</Button>
          <Button variant="primary" onClick={() => void print()}>
            {s.pdf}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
