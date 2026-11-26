/**
 * The topic chooser (planner hub 2, package 11; hand-off 11, A11Y „Topic“): title T2, one field as a combobox (typing
 * filters, the arrows move through the topics, Enter chooses the active one or creates the typed name), below it his
 * topics as radio lines (the list scrolls inside the dialog), „Kein Thema“ last; the foot T10 „Themen verwalten …“.
 * For the filter (T3) the same list without „create“ and without „Kein Thema“. The planner never reads ToDo tags.
 */
import { useLiveQuery } from 'dexie-react-hooks';
import { type KeyboardEvent, useId, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { t } from '@/strings';
import { Button, Dialog, Icon, TextField } from '@/ui';
import { topicRepo } from '../repo';
import { topicTitle, type TopicChoice } from '../topic';
import styles from '../routes/planner.module.css';

const fold = (s: string) => s.toLocaleLowerCase('de').normalize('NFKC');

export function TopicChooser({
  open,
  mode,
  current,
  title,
  onChoose,
  onClose,
}: {
  open: boolean;
  /** `give`: „Thema …“ (create and „Kein Thema“ offered); `filter`: T3, existing topics only. */
  mode: 'give' | 'filter';
  /** The topic the things have now (marked as chosen). */
  current?: string | undefined;
  title?: string;
  onChoose: (choice: TopicChoice) => void;
  onClose: () => void;
}) {
  const p = t.planner.topic;
  const navigate = useNavigate();
  const listId = useId();
  const [typed, setTyped] = useState('');
  const [active, setActive] = useState(0);
  const topics = useLiveQuery(
    async () =>
      (await topicRepo.active().toArray()).sort((a, b) =>
        a.title.localeCompare(b.title, 'de', { sensitivity: 'base' }),
      ),
    [],
  );
  const name = topicTitle(typed);
  const shown = useMemo(
    () => (topics ?? []).filter((x) => !name || fold(x.title).includes(fold(name))),
    [topics, name],
  );
  const exact = name ? (topics ?? []).find((x) => fold(x.title) === fold(name)) : undefined;
  // The lines the arrows move through: the matching topics, then „Neu: …“ for a new name, then „Kein Thema“.
  const lines: { key: string; label: string; choice: TopicChoice; chosen?: boolean }[] = [
    ...shown.map((x) => ({
      key: x.id,
      label: x.title,
      choice: { id: x.id },
      chosen: x.id === current,
    })),
    ...(mode === 'give' && name && !exact
      ? [{ key: 'new', label: p.create(name), choice: { title: name } }]
      : []),
    ...(mode === 'give' ? [{ key: 'none', label: p.none, choice: null, chosen: !current }] : []),
  ];
  const at = Math.min(active, Math.max(0, lines.length - 1));
  const pick = (choice: TopicChoice) => {
    setTyped('');
    setActive(0);
    onChoose(choice);
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (lines.length === 0) return;
      setActive((at + (e.key === 'ArrowDown' ? 1 : lines.length - 1)) % lines.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      // A typed name that is a topic chooses it; else the active line (a new name's „Neu: …“ when nothing matches).
      if (exact) pick({ id: exact.id });
      else if (lines[at]) pick(lines[at]!.choice);
    }
  };
  const close = () => {
    setTyped('');
    setActive(0);
    onClose();
  };
  return (
    <Dialog
      open={open}
      onClose={close}
      title={title ?? (mode === 'give' ? p.chooserTitle : p.filterMenu)}
      footer={
        <Button
          variant="ghost"
          onClick={() => {
            close();
            void navigate('/settings/module/planner#planner-topics');
          }}
        >
          {p.manage}
        </Button>
      }
    >
      <TextField
        label={p.field}
        value={typed}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={lines.length > 0}
        aria-controls={listId}
        aria-activedescendant={lines[at] ? `${listId}-${lines[at]!.key}` : undefined}
        autoComplete="off"
        data-autofocus
        onChange={(e) => {
          setTyped(e.target.value);
          setActive(0);
        }}
        onKeyDown={onKey}
      />
      {topics && topics.length === 0 && mode === 'give' && !name ? (
        <p className={styles.topicHint}>{p.hint}</p>
      ) : null}
      <ul id={listId} role="listbox" aria-label={p.field} className={styles.topicList}>
        {lines.map((line, i) => (
          <li
            key={line.key}
            id={`${listId}-${line.key}`}
            role="option"
            aria-selected={i === at}
            className={i === at ? `${styles.topicLine} ${styles.topicActive}` : styles.topicLine}
            onClick={() => pick(line.choice)}
          >
            <span className={styles.topicRadio} aria-hidden="true">
              {line.chosen ? <Icon name="check" size={16} /> : null}
            </span>
            <span className={styles.topicName}>{line.label}</span>
            {line.chosen ? <span className="sr-only">{`, ${p.chosen}`}</span> : null}
          </li>
        ))}
      </ul>
    </Dialog>
  );
}
