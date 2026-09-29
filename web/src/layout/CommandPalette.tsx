import { useId, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { t } from '@/strings';
import { useUiStore } from '@/stores/ui';
import { Dialog, Icon, type IconName } from '@/ui';
import { useModuleNavItems } from './useNavItems';
import styles from './CommandPalette.module.css';

export interface Command {
  id: string;
  label: string;
  icon: IconName;
  run: () => void;
}

/** Lowercase, strip diacritics – "Übersicht" matches "ubersicht". */
export function normalize(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

export function filterCommands(commands: Command[], query: string): Command[] {
  const q = normalize(query);
  if (!q) return commands;
  return commands.filter((c) => normalize(c.label).includes(q));
}

export function CommandPalette() {
  const open = useUiStore((s) => s.paletteOpen);
  const setOpen = useUiStore((s) => s.setPaletteOpen);
  return (
    <Dialog open={open} onClose={() => setOpen(false)} title={t.palette.title}>
      {/* Dialog only renders children while open, so the body remounts with fresh state. */}
      <PaletteBody onDone={() => setOpen(false)} />
    </Dialog>
  );
}

function PaletteBody({ onDone }: { onDone: () => void }) {
  const navigate = useNavigate();
  const moduleItems = useModuleNavItems();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const listId = useId();

  const commands = useMemo<Command[]>(() => {
    const go = (to: string) => () => void navigate(to);
    return [
      { id: 'dashboard', label: t.nav.dashboard, icon: 'home', run: go('/') },
      ...moduleItems.map((i) => ({ id: i.to, label: i.label, icon: i.icon, run: go(i.to) })),
      { id: 'library', label: t.nav.library, icon: 'grid', run: go('/library') },
      { id: 'settings', label: t.nav.settings, icon: 'settings', run: go('/settings') },
    ];
  }, [navigate, moduleItems]);

  const results = useMemo(() => filterCommands(commands, query), [commands, query]);

  const run = (c: Command | undefined) => {
    if (!c) return;
    onDone();
    c.run();
  };

  return (
    <>
      <input
        data-autofocus
        role="combobox"
        aria-expanded="true"
        aria-controls={listId}
        aria-activedescendant={results[active] ? `${listId}-${active}` : undefined}
        aria-label={t.palette.placeholder}
        placeholder={t.palette.placeholder}
        className={styles.input}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActive((a) => Math.min(a + 1, results.length - 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === 'Enter') {
            e.preventDefault();
            run(results[active]);
          }
        }}
      />
      {results.length === 0 ? (
        <p className={styles.empty}>{t.palette.empty}</p>
      ) : (
        <ul id={listId} role="listbox" className={styles.list}>
          {results.map((c, i) => (
            <li
              key={c.id}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              className={styles.option}
              onMouseEnter={() => setActive(i)}
              onClick={() => run(c)}
            >
              <Icon name={c.icon} />
              {c.label}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
