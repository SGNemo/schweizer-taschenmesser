import { changedFields } from '@/core/db/patch';
import { useState, type CSSProperties } from 'react';
import type { Stored } from '@/core/db/types';
import { undoableWithToast } from '@/core/undo/withToast';
import { t } from '@/strings';
import {
  Button,
  categoryColor,
  DayField,
  Dialog,
  Form,
  FormActions,
  Icon,
  SelectField,
  TextArea,
  TextField,
} from '@/ui';
import { iconOf, LIST_ICONS, nextOrder, type ListIcon } from '../logic';
import { deleteList, listRepo, setArchived } from '../repo';
import { KINDS, type List, type ListKind } from '../schema';
import styles from './ListManage.module.css';

export type ListTarget = Stored<List> | 'new' | null;

const TONES = [0, 1, 2, 3, 4, 5] as const;

export function ListEditor({
  target,
  existing,
  onClose,
  onSaved,
  onArchived,
}: {
  target: ListTarget;
  /** Every live list (for the sort key of a new one). */
  existing: readonly Stored<List>[];
  onClose: () => void;
  /** Called with the id of the created or edited list. */
  onSaved: (id: string) => void;
  /** Called with the id of a list that was just archived (the page leaves it). */
  onArchived?: (id: string) => void;
}) {
  const list = target && target !== 'new' ? target : null;
  return (
    <Dialog
      askAfterTyping
      open={target !== null}
      onClose={onClose}
      title={list ? t.lists.editList : t.lists.newList}
    >
      {target ? (
        <Fields
          key={list?.id ?? 'new'}
          list={list}
          existing={existing}
          onClose={onClose}
          onSaved={onSaved}
          onArchived={onArchived}
        />
      ) : null}
    </Dialog>
  );
}

/** Deletes a list (with its entries) behind "Rückgängig"; afterwards it waits in "Zuletzt gelöscht". */
export function deleteListWithUndo(id: string): void {
  void undoableWithToast(t.lists.listDeleted, t.lists.listDeleted, () => deleteList(id));
}

/** Archives a list or brings it back behind "Rückgängig". */
export function archiveWithUndo(list: Stored<List>, archived: boolean): void {
  const message = archived ? t.lists.archivedDone(list.name) : t.lists.unarchivedDone(list.name);
  void undoableWithToast(message, message, () => setArchived(list.id, archived));
}

function Fields({
  list,
  existing,
  onClose,
  onSaved,
  onArchived,
}: {
  list: Stored<List> | null;
  existing: readonly Stored<List>[];
  onClose: () => void;
  onSaved: (id: string) => void;
  onArchived?: (id: string) => void;
}) {
  // The record as the editor opened it: only fields that differ from it are saved (QA X01).
  const [opened] = useState(list);
  const [name, setName] = useState(list?.name ?? '');
  const [kind, setKind] = useState<ListKind>(list?.kind ?? 'checklist');
  // No own icon yet: the picker follows the kind until one is chosen.
  const [icon, setIcon] = useState<ListIcon | undefined>(
    list?.icon ? iconOf({ icon: list.icon, kind: list.kind }) : undefined,
  );
  const [tone, setTone] = useState<number | undefined>(list?.tone);
  const [note, setNote] = useState(list?.note ?? '');
  const [tripDate, setTripDate] = useState(list?.tripDate ?? '');
  const [place, setPlace] = useState(list?.place ?? '');
  const [error, setError] = useState('');
  const shownIcon = icon ?? iconOf({ kind });

  async function save() {
    const trimmed = name.trim();
    if (!trimmed) return setError(t.form.required);
    const trip = kind === 'packing';
    const data = {
      name: trimmed,
      kind,
      icon,
      tone,
      note: note.trim() || undefined,
      tripDate: trip ? tripDate || undefined : undefined,
      place: trip ? place.trim() || undefined : undefined,
    };
    if (list) {
      await listRepo.update(list.id, changedFields(opened ?? list, data));
      onSaved(list.id);
    } else {
      const inUse = existing.filter((l) => !l.archived);
      const created = await listRepo.create({ ...data, order: nextOrder(inUse) });
      onSaved(created.id);
    }
    onClose();
  }

  return (
    <Form onSubmit={save}>
      <TextField
        label={t.lists.listName}
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          setError('');
        }}
        error={error}
        data-autofocus
      />
      <SelectField
        label={t.lists.kind}
        value={kind}
        onChange={(e) => setKind(e.target.value as ListKind)}
      >
        {KINDS.map((k) => (
          <option key={k} value={k}>
            {t.lists.kinds[k]}
          </option>
        ))}
      </SelectField>
      <div className={styles.field} role="group" aria-labelledby="list-colour-legend">
        <span className={styles.legend} id="list-colour-legend">
          {t.lists.listColour}
        </span>
        <div className={styles.choices}>
          <button
            type="button"
            className={`${styles.choice} ${styles.swatch}`}
            aria-pressed={tone === undefined}
            aria-label={t.lists.noColour}
            title={t.lists.noColour}
            onClick={() => setTone(undefined)}
          >
            <span className={`${styles.dot} ${styles.dotNone}`} />
          </button>
          {TONES.map((i) => (
            <button
              key={i}
              type="button"
              className={`${styles.choice} ${styles.swatch}`}
              aria-pressed={tone === i}
              aria-label={t.lists.colourN(i + 1)}
              title={t.lists.colourN(i + 1)}
              onClick={() => setTone(i)}
            >
              <span className={styles.dot} style={{ background: categoryColor(i) }} />
            </button>
          ))}
        </div>
      </div>
      <div className={styles.field} role="group" aria-labelledby="list-icon-legend">
        <span className={styles.legend} id="list-icon-legend">
          {t.lists.listIcon}
        </span>
        <div className={styles.choices}>
          {LIST_ICONS.map((id) => (
            <button
              key={id}
              type="button"
              className={styles.choice}
              aria-pressed={shownIcon === id}
              aria-label={t.lists.iconNames[id]}
              title={t.lists.iconNames[id]}
              onClick={() => setIcon(id)}
            >
              <Icon name={id} size={20} />
            </button>
          ))}
        </div>
      </div>
      {kind === 'packing' ? (
        <>
          <TextField
            label={t.lists.tripPlace}
            value={place}
            onChange={(e) => setPlace(e.target.value)}
          />
          <DayField label={t.lists.tripDate} value={tripDate} onChange={setTripDate} />
        </>
      ) : null}
      <TextArea
        label={t.lists.note}
        rows={3}
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <FormActions
        start={
          list ? (
            <>
              <Button
                variant="danger"
                onClick={() => {
                  deleteListWithUndo(list.id);
                  onClose();
                }}
              >
                {t.lists.deleteList}
              </Button>
              {!list.archived ? (
                <Button
                  onClick={() => {
                    archiveWithUndo(list, true);
                    onArchived?.(list.id);
                    onClose();
                  }}
                >
                  {t.lists.archiveList}
                </Button>
              ) : null}
            </>
          ) : undefined
        }
      >
        <Button onClick={onClose}>{t.actions.cancel}</Button>
        <Button type="submit" variant="primary">
          {t.actions.save}
        </Button>
      </FormActions>
    </Form>
  );
}

/** The list's icon, tinted with its colour when it has one (the name is always shown beside it). */
export function ListMark({
  list,
  size = 18,
}: {
  list: Pick<List, 'icon' | 'kind' | 'tone'>;
  size?: number;
}) {
  return (
    <span
      className={styles.mark}
      aria-hidden
      style={
        list.tone !== undefined
          ? ({ '--list-tone': categoryColor(list.tone) } as CSSProperties)
          : undefined
      }
    >
      <Icon name={iconOf(list)} size={size} />
    </span>
  );
}
