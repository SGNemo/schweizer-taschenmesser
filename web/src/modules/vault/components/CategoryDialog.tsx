import { useEffect, useRef, useState } from 'react';
import { changedFields } from '@/core/db/patch';
import { deleteWithUndo, changeWithUndo } from '@/core/undo/withToast';
import { t } from '@/strings';
import {
  Button,
  categoryColor,
  Dialog,
  Form,
  FormActions,
  Icon,
  IconButton,
  SelectField,
  TextField,
} from '@/ui';
import {
  categoryLabel,
  countByResolved,
  docsInCategory,
  moveCategory,
  nextCategoryOrder,
  type ResolvedCategory,
} from '../categories';
import { createCategory, removeCategory, writeCategory } from '../repo';
import { CATEGORY_ICONS, NO_CATEGORY, type CategoryIcon } from '../schema';
import styles from './CategoryDialog.module.css';

type Mode = { kind: 'list' } | { kind: 'edit'; id: string | null } | { kind: 'remove'; id: string };

const fold = (s: string) => s.trim().toLocaleLowerCase();

/**
 * "Kategorien bearbeiten": the folders in their order with a count each; add, rename (colour and icon too), move
 * up or down, delete. Deleting a folder that holds documents asks where they go ("Ohne Kategorie" unless another
 * folder is chosen) and never deletes a document. Every change has "Rückgängig" in the toast.
 */
export function CategoryDialog({
  open,
  onClose,
  cats,
  docs,
  startNew = false,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  cats: readonly ResolvedCategory[];
  /** `undefined` while the documents load: nothing can be deleted before they are counted. */
  docs: readonly { id: string; category?: string }[] | undefined;
  /** Opened by the "+" beside the folder tabs: straight to the form, and done when it is. */
  startNew?: boolean;
  /** A new folder was made from the "+" (`startNew`): the page shows it. */
  onCreated?: (id: string) => void;
}) {
  const [mode, setMode] = useState<Mode>({ kind: 'list' });
  // Each opening starts where it was opened from (adjusting state during render).
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setMode(startNew ? { kind: 'edit', id: null } : { kind: 'list' });
  }
  const close = () => {
    setMode({ kind: 'list' });
    onClose();
  };
  const back = () => (startNew ? close() : setMode({ kind: 'list' }));
  // The content changes inside an open dialog (list, form, question): its first field takes the focus each time,
  // as the dialog does on opening, so keyboard and screen reader never land on the dialog body.
  const body = useRef<HTMLDivElement>(null);
  const opened = useRef(false);
  useEffect(() => {
    if (!open) {
      opened.current = false;
      return;
    }
    if (!opened.current) {
      opened.current = true; // the dialog itself focuses on opening
      return;
    }
    body.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus();
  }, [open, mode]);
  const names = t.vault.categories;
  const a = t.vault.categoryAdmin;
  const editing = mode.kind === 'edit' ? cats.find((c) => c.id === mode.id) : undefined;
  const removing = mode.kind === 'remove' ? cats.find((c) => c.id === mode.id) : undefined;
  // Gone meanwhile (another device): back to the list instead of a form about nothing.
  if (
    (mode.kind === 'edit' && mode.id !== null && !editing) ||
    (mode.kind === 'remove' && !removing)
  )
    setMode({ kind: 'list' });

  const title =
    mode.kind === 'edit'
      ? mode.id === null
        ? a.add
        : a.editTitle
      : mode.kind === 'remove' && removing
        ? a.removeTitle(categoryLabel(removing, names))
        : a.title;

  return (
    <Dialog open={open} onClose={close} title={title}>
      <div ref={body}>
        {!open ? null : mode.kind === 'edit' ? (
          <EditForm
            key={mode.id ?? 'new'}
            cat={editing ?? null}
            cats={cats}
            onDone={back}
            onCreated={startNew ? onCreated : undefined}
          />
        ) : mode.kind === 'remove' && removing ? (
          <RemoveForm
            cat={removing}
            cats={cats}
            docIds={docsInCategory(docs ?? [], cats, removing.id)}
            onDone={() => setMode({ kind: 'list' })}
          />
        ) : (
          <CategoryList
            cats={cats}
            docs={docs}
            onEdit={(id) => setMode({ kind: 'edit', id })}
            onRemove={(cat) => {
              if (!docs) return;
              const ids = docsInCategory(docs, cats, cat.id);
              // An empty folder goes at once: the toast offers "Rückgängig", there is nothing to move.
              // Its row (and the button that had the focus) goes too: "Fertig" takes the focus.
              if (ids.length === 0)
                void deleteWithUndo(
                  () => removeCategory(cat, []),
                  a.removed(categoryLabel(cat, names)),
                ).then(() => body.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus());
              else setMode({ kind: 'remove', id: cat.id });
            }}
            onClose={close}
          />
        )}
      </div>
    </Dialog>
  );
}

function CategoryList({
  cats,
  docs,
  onEdit,
  onRemove,
  onClose,
}: {
  cats: readonly ResolvedCategory[];
  docs: readonly { id: string; category?: string }[] | undefined;
  onEdit: (id: string | null) => void;
  onRemove: (cat: ResolvedCategory) => void;
  onClose: () => void;
}) {
  const names = t.vault.categories;
  const a = t.vault.categoryAdmin;
  const movable = cats.filter((c) => !c.fixed);
  const list = useRef<HTMLUListElement>(null);
  // The arrow last pressed: once the list shows the new place, a disabled arrow (first or last place) hands the
  // focus to the other one in its row, and the place is said once.
  const pressed = useRef<{ id: string; dir: -1 | 1 } | null>(null);
  const [said, setSaid] = useState('');
  useEffect(() => {
    const p = pressed.current;
    if (!p) return;
    pressed.current = null;
    const at = movable.findIndex((c) => c.id === p.id);
    if (at < 0) return;
    const cat = movable[at]!;
    setSaid(a.place(categoryLabel(cat, names), at + 1, movable.length));
    const row = Array.from(list.current?.querySelectorAll<HTMLElement>('[data-cat]') ?? []).find(
      (el) => el.dataset.cat === p.id,
    );
    const btn = row?.querySelector<HTMLButtonElement>(`[data-move="${p.dir}"]`);
    if (btn?.disabled) row?.querySelector<HTMLButtonElement>(`[data-move="${-p.dir}"]`)?.focus();
  }, [cats]); // eslint-disable-line react-hooks/exhaustive-deps -- runs when the stored order arrives
  const move = (id: string, dir: -1 | 1) => {
    // One move at a time: a second click before the list shows the first would compute from the old order.
    if (pressed.current) return;
    const writes = moveCategory(cats, id, dir);
    if (writes.length === 0) return;
    pressed.current = { id, dir };
    // No toast: the list shows the new place at once, and the arrow back undoes it (no toast per click).
    void (async () => {
      for (const w of writes) {
        const cat = cats.find((c) => c.id === w.id);
        if (cat) await writeCategory(cat, { order: w.order });
      }
    })().catch(() => {
      pressed.current = null;
    });
  };
  const counts = docs ? countByResolved(docs, cats) : undefined;
  return (
    <div className={styles.root}>
      <p className={styles.sr} role="status">
        {said}
      </p>
      <ul className={styles.list} data-testid="vault-categories" ref={list}>
        {cats.map((c) => {
          const name = categoryLabel(c, names);
          const n = counts ? (counts.get(c.id) ?? 0) : undefined;
          const i = movable.findIndex((m) => m.id === c.id);
          return (
            <li key={c.id} className={styles.row} data-cat={c.id}>
              <span className={styles.mark} style={{ color: categoryColor(c.tone) }}>
                <Icon name={c.icon} size={18} />
              </span>
              <span className={styles.name}>
                <span>{name}</span>
                {n === undefined ? null : (
                  <span className={styles.meta}>{t.vault.docCount(n)}</span>
                )}
              </span>
              {c.fixed ? null : (
                <span className={styles.tools}>
                  <IconButton
                    label={a.up(name)}
                    disabled={i <= 0}
                    data-move="-1"
                    onClick={() => move(c.id, -1)}
                  >
                    <Icon name="chevronUp" size={18} />
                  </IconButton>
                  <IconButton
                    label={a.down(name)}
                    disabled={i >= movable.length - 1}
                    data-move="1"
                    onClick={() => move(c.id, 1)}
                  >
                    <Icon name="chevronDown" size={18} />
                  </IconButton>
                  <IconButton label={a.edit(name)} onClick={() => onEdit(c.id)}>
                    <Icon name="edit" size={18} />
                  </IconButton>
                  <IconButton label={a.remove(name)} disabled={!docs} onClick={() => onRemove(c)}>
                    <Icon name="trash" size={18} />
                  </IconButton>
                </span>
              )}
            </li>
          );
        })}
      </ul>
      <p className={styles.hint}>{a.fixedHint}</p>
      <FormActions
        start={
          <Button onClick={() => onEdit(null)}>
            <Icon name="plus" size={18} />
            {a.add}
          </Button>
        }
      >
        <Button variant="primary" onClick={onClose} data-autofocus>
          {a.done}
        </Button>
      </FormActions>
    </div>
  );
}

function EditForm({
  cat,
  cats,
  onDone,
  onCreated,
}: {
  onCreated?: (id: string) => void;
  /** `null` = a new folder. */
  cat: ResolvedCategory | null;
  cats: readonly ResolvedCategory[];
  onDone: () => void;
}) {
  const names = t.vault.categories;
  const a = t.vault.categoryAdmin;
  const [name, setName] = useState(cat ? categoryLabel(cat, names) : '');
  const [tone, setTone] = useState(cat?.tone ?? cats.filter((c) => !c.fixed).length % 6);
  const [icon, setIcon] = useState<CategoryIcon>(cat?.icon ?? 'files');
  const [error, setError] = useState('');

  async function save() {
    const trimmed = name.trim();
    if (!trimmed) return setError(t.form.required);
    const clash = cats.some(
      (c) => c.id !== cat?.id && fold(categoryLabel(c, names)) === fold(trimmed),
    );
    if (clash) return setError(a.duplicate);
    if (cat) {
      // A built-in folder keeps its translated name until it is really renamed; typing its own name back resets it.
      const builtinName = cat.builtin ? names[cat.id] : undefined;
      const next = {
        name: trimmed === builtinName ? undefined : trimmed,
        tone,
        icon,
      };
      const patch = changedFields({ name: cat.name, tone: cat.tone, icon: cat.icon }, next);
      // Nothing changed: no write, no toast.
      if (Object.keys(patch).length > 0) await changeWithUndo(() => writeCategory(cat, patch));
    } else {
      const id = await changeWithUndo(
        () => createCategory({ name: trimmed, tone, icon, order: nextCategoryOrder(cats) }),
        a.created(trimmed),
      );
      onCreated?.(id);
    }
    onDone();
  }

  return (
    <Form onSubmit={() => void save()}>
      <TextField
        label={a.name}
        value={name}
        error={error}
        maxLength={60}
        onChange={(e) => {
          setName(e.target.value);
          setError('');
        }}
        data-autofocus
      />
      <div className={styles.field} role="group" aria-label={a.colour}>
        <span className={styles.legend}>{a.colour}</span>
        <div className={styles.choices}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <button
              key={i}
              type="button"
              className={styles.choice}
              aria-pressed={tone === i}
              aria-label={a.colourN(i + 1)}
              title={a.colourN(i + 1)}
              onClick={() => setTone(i)}
            >
              <span className={styles.dot} style={{ background: categoryColor(i) }} />
            </button>
          ))}
        </div>
      </div>
      <div className={styles.field} role="group" aria-label={a.icon}>
        <span className={styles.legend}>{a.icon}</span>
        <div className={styles.choices}>
          {CATEGORY_ICONS.map((ic) => (
            <button
              key={ic}
              type="button"
              className={styles.choice}
              aria-pressed={icon === ic}
              aria-label={a.iconNames[ic] ?? ic}
              title={a.iconNames[ic] ?? ic}
              onClick={() => setIcon(ic)}
            >
              <Icon name={ic} size={20} />
            </button>
          ))}
        </div>
      </div>
      <FormActions>
        <Button onClick={onDone}>{t.actions.cancel}</Button>
        <Button type="submit" variant="primary">
          {t.actions.save}
        </Button>
      </FormActions>
    </Form>
  );
}

function RemoveForm({
  cat,
  cats,
  docIds,
  onDone,
}: {
  cat: ResolvedCategory;
  cats: readonly ResolvedCategory[];
  docIds: readonly string[];
  onDone: (removed: boolean) => void;
}) {
  const names = t.vault.categories;
  const a = t.vault.categoryAdmin;
  const [target, setTarget] = useState<string>(NO_CATEGORY);
  const name = categoryLabel(cat, names);
  const targets = cats.filter((c) => c.id !== cat.id);

  async function remove() {
    // The target may have gone meanwhile (another device): then "Ohne Kategorie", never nowhere.
    const to = targets.some((c) => c.id === target) ? target : NO_CATEGORY;
    const toName = categoryLabel(
      cats.find((c) => c.id === to),
      names,
    );
    await deleteWithUndo(
      () => removeCategory(cat, docIds, to),
      a.removedMoved(name, docIds.length, toName),
    );
    onDone(true);
  }

  return (
    <Form onSubmit={() => void remove()}>
      <p className={styles.lead} data-testid="vault-category-in-use">
        {a.inUse(docIds.length)}
      </p>
      <p className={styles.hint}>{a.keepsDocs(docIds.length)}</p>
      <SelectField
        label={a.moveTo}
        value={target}
        onChange={(e) => setTarget(e.target.value)}
        data-autofocus
      >
        {/* "Ohne Kategorie" first: the safe default. */}
        {[...targets.filter((c) => c.fixed), ...targets.filter((c) => !c.fixed)].map((c) => (
          <option key={c.id} value={c.id}>
            {categoryLabel(c, names)}
          </option>
        ))}
      </SelectField>
      <FormActions>
        <Button onClick={() => onDone(false)}>{t.actions.cancel}</Button>
        <Button type="submit" variant="danger">
          {a.removeAndMove}
        </Button>
      </FormActions>
    </Form>
  );
}
