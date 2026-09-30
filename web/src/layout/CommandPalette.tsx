import { useId, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { isAiConfigured, useAiConfig } from '@/core/ai/config';
import { calculate } from '@/core/calc/phrases';
import type { ResultRow } from '@/core/ai/query/types';
import { useSetupHost } from '@/core/setup/host';
import { t } from '@/strings';
import { useUiStore } from '@/stores/ui';
import { Button, Dialog, Icon, type IconName } from '@/ui';
import { AnswerView } from './assistant/AnswerView';
import { useAssistant, useSearchHits } from './assistant/useAssistant';
import { useModuleNavItems } from './useNavItems';
import styles from './CommandPalette.module.css';
import answerStyles from './assistant/assistant.module.css';

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

type Option =
  | { kind: 'command'; key: string; label: string; icon: IconName; command: Command }
  | { kind: 'hit'; key: string; label: string; icon: IconName; row: ResultRow }
  | { kind: 'calc'; key: string; label: string; icon: IconName; value: number }
  | { kind: 'ask'; key: string; label: string; icon: IconName; forceModel: boolean };

function PaletteBody({ onDone }: { onDone: () => void }) {
  const navigate = useNavigate();
  const moduleItems = useModuleNavItems();
  const config = useAiConfig();
  const { state, submit, reset } = useAssistant();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const listId = useId();
  const toast = useUiStore((s) => s.toast);
  const openSetup = useSetupHost((s) => s.openWizard);

  const commands = useMemo<Command[]>(() => {
    const go = (to: string) => () => void navigate(to);
    return [
      { id: 'dashboard', label: t.nav.dashboard, icon: 'home', run: go('/') },
      ...moduleItems.map((i) => ({ id: i.to, label: i.label, icon: i.icon, run: go(i.to) })),
      { id: 'library', label: t.nav.library, icon: 'grid', run: go('/library') },
      { id: 'settings', label: t.nav.settings, icon: 'settings', run: go('/settings') },
      { id: 'setup', label: t.setup.paletteCommand, icon: 'check', run: () => openSetup() },
    ];
  }, [navigate, moduleItems, openSetup]);

  const hits = useSearchHits(query);
  const hasModel = config ? isAiConfigured(config) : false;

  const options = useMemo<Option[]>(() => {
    const list: Option[] = filterCommands(commands, query).map((c) => ({
      kind: 'command',
      key: `c-${c.id}`,
      label: c.label,
      icon: c.icon,
      command: c,
    }));
    // Arithmetic is answered on the spot (0 tokens, nothing leaves the device); Enter copies it.
    const sum = calculate(query);
    if (sum) {
      list.push({
        kind: 'calc',
        key: 'calc',
        label: sum.text,
        icon: 'calculator',
        value: sum.value,
      });
    }
    if (query.trim()) {
      list.push({
        kind: 'ask',
        key: 'ask',
        label: t.ai.palette.ask,
        icon: 'sparkles',
        forceModel: false,
      });
      if (hasModel) {
        list.push({
          kind: 'ask',
          key: 'ask-model',
          label: t.ai.palette.askModel,
          icon: 'sparkles',
          forceModel: true,
        });
      }
    }
    for (const row of hits) {
      list.push({
        kind: 'hit',
        key: `h-${row.subtitle}-${row.id}`,
        label: row.title,
        icon: 'search',
        row,
      });
    }
    return list;
  }, [commands, hits, query, hasModel]);

  const run = (o: Option | undefined) => {
    if (!o) return;
    if (o.kind === 'ask') return void submit(query.trim(), o.forceModel);
    if (o.kind === 'calc') {
      // Plain decimal without thousands separators so it pastes into any field.
      const text = String(o.value).replace('.', ',');
      void navigator.clipboard.writeText(text).then(
        () => toast(t.tools.calc.copied),
        () => undefined,
      );
      return;
    }
    onDone();
    if (o.kind === 'command') o.command.run();
    else if (o.row.to) void navigate(o.row.to);
  };

  if (state.phase !== 'idle') {
    return (
      <div className={answerStyles.answer} aria-live="polite" data-testid="ai-answer">
        <Button variant="ghost" className={answerStyles.back} onClick={reset}>
          {t.ai.palette.back}
        </Button>
        <p className={answerStyles.question}>
          <Icon name="sparkles" size={16} />
          {state.question}
        </p>
        {state.phase === 'loading' ? (
          <p role="status">{t.ai.palette.thinking}</p>
        ) : (
          <AnswerView response={state.response} onDone={onDone} />
        )}
      </div>
    );
  }

  return (
    <>
      <input
        data-autofocus
        role="combobox"
        aria-expanded="true"
        aria-controls={listId}
        aria-activedescendant={options[active] ? `${listId}-${active}` : undefined}
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
            setActive((a) => Math.min(a + 1, options.length - 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === 'Enter') {
            e.preventDefault();
            run(options[active]);
          }
        }}
      />
      {options.length === 0 ? (
        <p className={styles.empty}>{t.palette.empty}</p>
      ) : (
        <ul id={listId} role="listbox" className={styles.list}>
          {options.map((o, i) => (
            <li
              key={o.key}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              className={styles.option}
              onMouseEnter={() => setActive(i)}
              onClick={() => run(o)}
            >
              <Icon name={o.icon} />
              <span className={styles.optionText}>
                {o.kind === 'ask' ? `${o.label}: „${query.trim()}“` : o.label}
                {o.kind === 'hit' && o.row.subtitle ? (
                  <span className={styles.optionMeta}>{o.row.subtitle}</span>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
