import { useEffect, useId, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { isAiConfigured, useAiConfig } from '@/core/ai/config';
import { calculate } from '@/core/calc/phrases';
import { openReminderCenter } from '@/core/notifications/centerStore';
import { addRecent, readRecent, type RecentEntry } from '@/core/search/recent';
import { useFocusSettings } from '@/core/settings/focus';
import { settingsPath } from '@/core/settings/registry/paths';
import { normalize } from '@/core/text/normalize';
import { useSettingsSections } from '@/pages/settings/useSections';
import type { ResultRow } from '@/core/ai/query/types';
import { useSetupHost } from '@/core/setup/host';
import { useTools } from '@/core/tools/state';
import { t } from '@/strings';
import { useUiStore } from '@/stores/ui';
import { Button, Dialog, Icon, type IconName } from '@/ui';
import { AnswerView } from './assistant/AnswerView';
import { useAssistant, useSearchHits } from './assistant/useAssistant';
import { useModuleNavItems, useNavTree, useQuickAddActions } from './useNavItems';
import styles from './CommandPalette.module.css';
import { loadDevCommands } from './devTools';
import answerStyles from './assistant/assistant.module.css';

export interface Command {
  id: string;
  label: string;
  icon: IconName;
  run: () => void;
  /**
   * Only offered once the (normalised) query starts with this text – for long lists of commands
   * (every setting) that would otherwise hijack Enter for natural-language questions.
   */
  onlyWhenQueryStartsWith?: string;
}

export { normalize };

export function filterCommands(commands: Command[], query: string): Command[] {
  const q = normalize(query);
  if (!q) return commands;
  return commands.filter(
    (c) =>
      (!c.onlyWhenQueryStartsWith || q.startsWith(c.onlyWhenQueryStartsWith)) &&
      normalize(c.label).includes(q),
  );
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

type Option = { recent?: boolean } & (
  | { kind: 'command'; key: string; label: string; icon: IconName; command: Command }
  | { kind: 'hit'; key: string; label: string; icon: IconName; row: ResultRow }
  | { kind: 'calc'; key: string; label: string; icon: IconName; value: number }
  | { kind: 'ask'; key: string; label: string; icon: IconName; forceModel: boolean }
  | { kind: 'query'; key: string; label: string; icon: IconName }
);

function PaletteBody({ onDone }: { onDone: () => void }) {
  const navigate = useNavigate();
  const moduleItems = useModuleNavItems();
  const tree = useNavTree();
  const quickActions = useQuickAddActions();
  const config = useAiConfig();
  const { state, submit, reset } = useAssistant();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const listId = useId();
  const toast = useUiStore((s) => s.toast);
  const openSetup = useSetupHost((s) => s.openWizard);
  const openTools = useUiStore((s) => s.openTools);
  const tools = useTools();
  const settingsSections = useSettingsSections();
  const [focus] = useFocusSettings();
  // Read once per opening of the palette: what was used before, newest first.
  const [recent] = useState<RecentEntry[]>(() => readRecent());

  const [devCommands, setDevCommands] = useState<Command[]>([]);
  useEffect(() => {
    void loadDevCommands?.().then((m) => setDevCommands(m.devCommands()));
  }, []);

  const commands = useMemo<Command[]>(() => {
    const go = (to: string) => () => void navigate(to);
    return [
      { id: 'dashboard', label: t.nav.home, icon: 'home', run: go('/') },
      ...tree.areas.map((a) => ({
        id: `area-${a.id}`,
        label: a.label,
        icon: a.icon,
        run: go(a.to),
      })),
      ...quickActions.map((a) => ({
        id: `new-${a.icon}-${a.id}`,
        label: t.palette.newEntry(a.label),
        icon: 'plus' as IconName,
        run: go(a.to),
      })),
      ...moduleItems.map((i) => ({ id: i.to, label: i.label, icon: i.icon, run: go(i.to) })),
      {
        id: 'reminder-next',
        label: t.palette.nextReminder,
        icon: 'bell',
        run: () => openReminderCenter('next'),
      },
      {
        id: 'reminder-random',
        label: t.palette.randomReminder,
        icon: 'bell',
        run: () => openReminderCenter('random'),
      },
      { id: 'library', label: t.nav.library, icon: 'grid', run: go('/library') },
      { id: 'settings', label: t.nav.settings, icon: 'settings', run: go('/settings') },
      { id: 'setup', label: t.setup.paletteCommand, icon: 'check', run: () => openSetup() },
      ...settingsSections.flatMap((sec) => [
        {
          id: `settings-${sec.id}`,
          label: t.settings.paletteCommand(sec.title),
          icon: 'settings' as IconName,
          onlyWhenQueryStartsWith: 'einst',
          run: go(settingsPath(sec.category, sec.id)),
        },
        ...(sec.fields ?? []).map((f) => ({
          id: `settings-${sec.id}--${f.key}`,
          label: t.settings.paletteCommand(f.label),
          icon: 'settings' as IconName,
          onlyWhenQueryStartsWith: 'einst',
          run: go(settingsPath(sec.category, sec.id, f.key)),
        })),
      ]),
      ...(tools?.active ?? []).map((tool) => ({
        id: `tool-${tool.id}`,
        label: t.tools.paletteCommand(tool.name),
        icon: tool.icon,
        run: () => openTools(tool.id),
      })),
      ...devCommands,
    ];
  }, [
    navigate,
    moduleItems,
    tree,
    quickActions,
    openSetup,
    openTools,
    tools,
    devCommands,
    settingsSections,
  ]);

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
    // Nothing typed yet: what was used before comes first ("Zuletzt benutzt").
    if (!query.trim() && focus.searchHistory) {
      const recents: Option[] = [];
      for (const r of recent) {
        if (r.kind === 'command') {
          const c = commands.find((x) => x.id === r.key);
          if (c)
            recents.push({
              kind: 'command',
              key: `r-${r.key}`,
              label: c.label,
              icon: c.icon,
              command: c,
              recent: true,
            });
        } else if (r.kind === 'hit' && r.to) {
          recents.push({
            kind: 'hit',
            key: `r-${r.key}`,
            label: r.label,
            icon: 'search',
            row: { id: r.key, title: r.label, subtitle: r.subtitle, fields: [], to: r.to },
            recent: true,
          });
        } else if (r.kind === 'query') {
          recents.push({
            kind: 'query',
            key: `r-${r.key}`,
            label: r.label,
            icon: 'search',
            recent: true,
          });
        }
      }
      const used = new Set(recents.map((o) => o.key.replace(/^r-/, '')));
      return [...recents, ...list.filter((o) => !(o.kind === 'command' && used.has(o.command.id)))];
    }
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
  }, [commands, hits, query, hasModel, focus.searchHistory, recent]);

  const remember = (entry: RecentEntry) => {
    if (focus.searchHistory) addRecent(entry);
  };

  const run = (o: Option | undefined) => {
    if (!o) return;
    if (o.kind === 'query') {
      // An earlier search is typed back into the field; Enter asks again.
      setQuery(o.label);
      setActive(0);
      return;
    }
    if (o.kind === 'ask') {
      remember({ kind: 'query', key: `q-${query.trim()}`, label: query.trim() });
      return void submit(query.trim(), o.forceModel);
    }
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
    if (o.kind === 'command') {
      remember({ kind: 'command', key: o.command.id, label: o.label });
      o.command.run();
    } else if (o.row.to) {
      remember({
        kind: 'hit',
        key: `h-${o.row.subtitle ?? ''}-${o.row.id}`,
        label: o.row.title,
        to: o.row.to,
        subtitle: o.row.subtitle,
      });
      void navigate(o.row.to);
    }
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
                {o.recent ? <span className={styles.optionMeta}>{t.palette.recent}</span> : null}
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
