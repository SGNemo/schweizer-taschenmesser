import { useEffect, useState } from 'react';
import { bus, type EventMap } from '@/core/events';
import { whenServicesSettled } from '@/core/modules/servicesReady';
import { undoableWithToast } from '@/core/undo/withToast';
import { t } from '@/strings';
import { Button, Checkbox, Dialog, FormActions } from '@/ui';
import { addItem } from '../repo';
import styles from './ListManage.module.css';

export type PantryNeed = Parameters<EventMap['pantry.needsRequested']['answer']>[0][number];

/** Asks the pantry what it needs (`pantry.needsRequested`); an empty answer when the pantry is off. */
export async function askPantry(): Promise<PantryNeed[]> {
  await whenServicesSettled();
  let needs: PantryNeed[] = [];
  await bus.emit('pantry.needsRequested', { answer: (n) => (needs = n) });
  return needs;
}

/**
 * "Aus Vorräten auffüllen": what the pantry reports as used up, at its minimum, expired or expiring soon, each with
 * its reason and ticked (expiring soon unticked: it may still be eaten). Only the ticked names are added, entries
 * already open on the list are skipped; the add sits behind "Rückgängig".
 */
export function FillFromPantry({
  open,
  listId,
  listName,
  openNames,
  onClose,
}: {
  open: boolean;
  listId: string;
  listName: string;
  /** Names open on the list now (lower case compare): they are left out. */
  openNames: readonly string[];
  onClose: () => void;
}) {
  return (
    <Dialog open={open} onClose={onClose} title={t.lists.fillFromPantry}>
      {open ? (
        <Fields listId={listId} listName={listName} openNames={openNames} onClose={onClose} />
      ) : null}
    </Dialog>
  );
}

function Fields({
  listId,
  listName,
  openNames,
  onClose,
}: {
  listId: string;
  listName: string;
  openNames: readonly string[];
  onClose: () => void;
}) {
  const [needs, setNeeds] = useState<PantryNeed[]>();
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set());
  useEffect(() => {
    let live = true;
    const open = new Set(openNames.map((n) => n.trim().toLowerCase()));
    void askPantry().then((all) => {
      if (!live) return;
      const fresh = all.filter((n) => !open.has(n.name.toLowerCase()));
      setNeeds(fresh);
      setPicked(new Set(fresh.filter((n) => n.reason !== 'soon').map((n) => n.name)));
    });
    return () => {
      live = false;
    };
    // Asked once when the dialog opens; later changes of the list do not reshuffle the choice.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function add() {
    const names = needs?.filter((n) => picked.has(n.name)).map((n) => n.name) ?? [];
    const message = t.lists.sharedAdded(names.length, listName);
    void undoableWithToast(message, message, async () => {
      for (const name of names) await addItem(listId, name, 'shopping');
    });
    onClose();
  }

  if (!needs) return <p aria-busy="true">{t.lists.pantryAsking}</p>;
  if (needs.length === 0)
    return (
      <>
        <p>{t.lists.pantryNothing}</p>
        <FormActions>
          <Button onClick={onClose}>{t.actions.close}</Button>
        </FormActions>
      </>
    );
  return (
    <>
      <p className={styles.hint}>{t.lists.pantryHint}</p>
      <ul className={styles.picks} data-testid="lists-pantry-needs">
        {needs.map((n) => (
          <li key={n.name}>
            <Checkbox
              label={`${n.name} · ${t.lists.pantryReasons[n.reason]}`}
              checked={picked.has(n.name)}
              onChange={(e) =>
                setPicked((s) => {
                  const next = new Set(s);
                  if (e.target.checked) next.add(n.name);
                  else next.delete(n.name);
                  return next;
                })
              }
            />
          </li>
        ))}
      </ul>
      <FormActions>
        <Button onClick={onClose}>{t.actions.cancel}</Button>
        <Button variant="primary" onClick={add} disabled={picked.size === 0}>
          {t.lists.pantryAdd(picked.size)}
        </Button>
      </FormActions>
    </>
  );
}
