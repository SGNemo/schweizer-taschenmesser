import { useRef, useState } from 'react';
import { isHiddenPath } from '@/importers/files';
import { byFolderOrder } from '@/importers/obsidian/parse';
import { useUiStore } from '@/stores/ui';
import { t } from '@/strings';
import { Button, Dialog } from '@/ui';
import { noteKey, parseImport, TEXT_FILE, type ImportedPage } from '../exchange';
import { nextNotebookOrder } from '../logic';
import { noteRepo, notebookRepo } from '../repo';
import styles from './Dialogs.module.css';

type Result = { pages: ImportedPage[]; fresh: ImportedPage[]; skipped: number };

/** Import `.md` / `.txt` files (several at once) or a folder: the folder becomes a notebook. */
export function ImportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const files = useRef<HTMLInputElement>(null);
  const folder = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState<Result | null>(null);
  const s = t.notes.importMenu;

  const close = () => {
    setResult(null);
    onClose();
  };

  async function read(list: FileList | null) {
    if (!list || list.length === 0) return;
    const picked = await Promise.all(
      [...list].map(async (f) => {
        const path = (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name;
        // Only notes are read; plugins, git objects and pictures of an export only need their path.
        const read = TEXT_FILE.test(path) && !isHiddenPath(path);
        return { path, text: read ? await f.text() : '' };
      }),
    );
    const parsed = parseImport(picked);
    const known = new Set((await noteRepo.active().toArray()).map((n) => noteKey(n.title, n.body)));
    const seen = new Set<string>();
    const fresh = parsed.pages.filter((p) => {
      const key = noteKey(p.title, p.body);
      if (known.has(key) || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    setResult({ ...parsed, fresh });
  }

  async function run() {
    if (!result) return;
    const books = await notebookRepo.active().toArray();
    const idOf = new Map(books.map((b) => [b.name.trim().toLowerCase(), b.id]));
    let order = nextNotebookOrder(books);
    // Numbered folders (`10_Arbeit`, `20_Privat`) keep their order as notebooks.
    const names = [...new Set(result.fresh.map((p) => p.folder).filter((f): f is string => !!f))];
    names.sort(byFolderOrder);
    for (const name of names) {
      if (idOf.has(name.trim().toLowerCase())) continue;
      const created = await notebookRepo.create({
        name,
        tone: idOf.size % 6,
        icon: 'note',
        order,
      });
      order += 10;
      idOf.set(name.trim().toLowerCase(), created.id);
    }
    await noteRepo.createMany(
      result.fresh.map((p) => ({
        data: {
          title: p.title,
          body: p.body,
          pinned: false,
          notebookId: p.folder ? (idOf.get(p.folder.trim().toLowerCase()) ?? null) : null,
          order: 0,
        },
      })),
    );
    useUiStore.getState().toast(s.done(result.fresh.length));
    close();
  }

  const folders = new Set(result?.fresh.map((p) => p.folder).filter(Boolean)).size;
  const duplicates = result ? result.pages.length - result.fresh.length : 0;
  return (
    <Dialog open={open} onClose={close} title={s.title}>
      <div className={styles.history}>
        <p className={styles.trashMeta}>{s.hint}</p>
        <div className={styles.actions}>
          <Button onClick={() => files.current?.click()}>{s.files}</Button>
          <Button onClick={() => folder.current?.click()}>{s.folder}</Button>
        </div>
        <input
          ref={files}
          type="file"
          multiple
          hidden
          accept=".md,.markdown,.txt,text/markdown,text/plain"
          onChange={(e) => {
            void read(e.target.files);
            e.target.value = '';
          }}
        />
        <input
          ref={folder}
          type="file"
          hidden
          // Non-standard but supported by every browser and the desktop webview.
          {...({ webkitdirectory: '', directory: '' } as object)}
          onChange={(e) => {
            void read(e.target.files);
            e.target.value = '';
          }}
        />
        {result ? (
          result.fresh.length === 0 ? (
            <p role="status">{duplicates > 0 ? s.duplicates(duplicates) : s.none}</p>
          ) : (
            <>
              <p role="status">{s.summary(result.fresh.length, folders)}</p>
              {duplicates > 0 ? (
                <p className={styles.trashMeta}>{s.duplicates(duplicates)}</p>
              ) : null}
              <div className={styles.actions}>
                <Button onClick={close}>{t.actions.cancel}</Button>
                <Button variant="primary" onClick={() => void run()}>
                  {s.confirm}
                </Button>
              </div>
            </>
          )
        ) : null}
      </div>
    </Dialog>
  );
}
