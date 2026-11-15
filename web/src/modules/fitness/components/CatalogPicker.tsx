import { useState } from 'react';
import { t } from '@/strings';
import { Button, Dialog, TextField } from '@/ui';
import { CATALOG, GROUPS, catalogName, patternOf } from '../catalog';
import styles from '../fitness.module.css';
import { ExercisePicto } from './ExercisePicto';

/**
 * The catalogue by group, each exercise with its pictogram (package 4). A tap adds it to the session
 * being edited. Deep package 1: a search over the catalogue and the user's own exercises; a name that
 * matches nothing can be taken as an own exercise in one tap.
 */
export function CatalogPicker({
  open,
  own = [],
  onPick,
  onClose,
}: {
  open: boolean;
  /** Names the user typed before that are not in the catalogue. */
  own?: readonly string[];
  onPick: (name: string) => void;
  onClose: () => void;
}) {
  return (
    <Dialog open={open} onClose={onClose} title={t.fitness.catalog.title}>
      {/* Remounted on every open: the search starts empty. */}
      {open ? <Picker own={own} onPick={onPick} /> : null}
    </Dialog>
  );
}

function Picker({ own, onPick }: { own: readonly string[]; onPick: (name: string) => void }) {
  const c = t.fitness.catalog;
  const [query, setQuery] = useState('');
  const q = query.trim().toLocaleLowerCase();
  const fits = (name: string) => !q || name.toLocaleLowerCase().includes(q);
  const catalogKeys = new Set(CATALOG.map((e) => catalogName(e.id).toLocaleLowerCase()));
  const ownShown = own.filter((n) => !catalogKeys.has(n.toLocaleLowerCase()) && fits(n));
  const groups = GROUPS.map((g) => ({
    g,
    items: CATALOG.filter((e) => e.group === g && fits(catalogName(e.id))),
  })).filter((x) => x.items.length);
  const exact = !q || catalogKeys.has(q) || own.some((n) => n.toLocaleLowerCase() === q);
  const item = (name: string, pattern = patternOf(name)) => (
    <li key={name}>
      <button
        type="button"
        className={styles.catalogItem}
        aria-label={c.add(name)}
        onClick={() => onPick(name)}
      >
        <ExercisePicto pattern={pattern} />
        <span>{name}</span>
      </button>
    </li>
  );
  return (
    <>
      <p className={styles.hint}>{c.intro}</p>
      <TextField
        label={c.search}
        labelHidden
        placeholder={c.search}
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        data-autofocus
      />
      {!exact ? (
        <div className={styles.chips}>
          {groups.length === 0 && ownShown.length === 0 ? (
            <p className={styles.hint} role="status">
              {c.none}
            </p>
          ) : null}
          <Button variant="secondary" size="sm" onClick={() => onPick(query.trim())}>
            {c.addOwn(query.trim())}
          </Button>
        </div>
      ) : null}
      {ownShown.length ? (
        <section aria-labelledby="fitness-group-own" className={styles.catalogGroup}>
          <h3 id="fitness-group-own" className={styles.groupLabel}>
            {c.own}
          </h3>
          <ul className={styles.catalogList}>{ownShown.map((n) => item(n))}</ul>
        </section>
      ) : null}
      {groups.map(({ g, items }) => (
        <section key={g} aria-labelledby={`fitness-group-${g}`} className={styles.catalogGroup}>
          <h3 id={`fitness-group-${g}`} className={styles.groupLabel}>
            {c.groups[g]}
          </h3>
          <ul className={styles.catalogList}>
            {items.map((e) => item(catalogName(e.id), e.pattern))}
          </ul>
        </section>
      ))}
    </>
  );
}
