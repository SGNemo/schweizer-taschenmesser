import { useState } from 'react';
import { normalize } from '@/core/text/normalize';
import { useTools } from '@/core/tools/state';
import { useUiStore } from '@/stores/ui';
import { t } from '@/strings';
import { tComfort } from '@/strings.comfort';
import {
  Badge,
  Button,
  Icon,
  IconButton,
  LibraryCard,
  Switch,
  TextField,
  useHashTarget,
} from '@/ui';
import styles from './Page.module.css';

const s = t.tools.library;
const GROUPS = ['basis', 'extra', 'dev'] as const;

/** `/tools`: switch tools on or off and set the order of the toolbar. */
export function ToolLibrary() {
  const tools = useTools();
  const openTools = useUiStore((st) => st.openTools);
  const activeIds = tools?.active.map((x) => x.id) ?? [];
  const [query, setQuery] = useState('');
  const text = tComfort.get().tools;
  const tokens = normalize(query).split(/\s+/).filter(Boolean);
  const matches = (x: { name: string; description: string }) => {
    const hay = normalize(`${x.name} ${x.description}`);
    return tokens.every((tok) => hay.includes(tok));
  };
  const anyMatch = (tools?.all ?? []).some(matches);
  // `/tools#tool-<id>` scrolls to that tool and marks it.
  useHashTarget(tools !== undefined);

  return (
    <>
      <div className={styles.header}>
        <div>
          <h1>{s.title}</h1>
          <p className={styles.lead}>{s.intro}</p>
        </div>
      </div>
      <div role="search" className={styles.librarySearch}>
        <TextField
          label={text.search}
          labelHidden
          type="search"
          placeholder={text.searchPlaceholder}
          value={query}
          autoComplete="off"
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      {tools && !anyMatch ? (
        <p role="status" className={styles.lead}>
          {text.noResults}
        </p>
      ) : null}
      {GROUPS.map((group) => {
        const inGroup = (tools?.all ?? []).filter((x) => x.group === group && matches(x));
        if (inGroup.length === 0) return null;
        return (
          <section key={group} aria-labelledby={`tools-${group}`} className={styles.section}>
            <h2 id={`tools-${group}`}>{s.groups[group]}</h2>
            <ul className={`${styles.list} ${styles.grid}`}>
              {inGroup.map((tool) => {
                const on = activeIds.includes(tool.id);
                const index = activeIds.indexOf(tool.id);
                return (
                  <LibraryCard
                    key={tool.id}
                    id={`tool-${tool.id}`}
                    testId={`tool-${tool.id}`}
                    icon={tool.icon}
                    name={tool.name}
                    description={tool.description}
                    badges={
                      <>
                        <Badge>{tool.offline ? s.offline : s.online}</Badge>
                        {tool.maturity === 'preview' ? (
                          <Badge>{t.settings.maturity.badge}</Badge>
                        ) : null}
                      </>
                    }
                  >
                    <Switch
                      label={s.enable(tool.name)}
                      checked={on}
                      disabled={!tools}
                      onChange={(checked) => void tools?.setEnabled(tool.id, checked)}
                    />
                    {on ? (
                      <>
                        <Button onClick={() => openTools(tool.id)}>{s.open(tool.name)}</Button>
                        <IconButton
                          label={s.up(tool.name)}
                          disabled={index <= 0}
                          onClick={() => void tools?.move(tool.id, -1)}
                        >
                          <Icon name="chevronUp" />
                        </IconButton>
                        <IconButton
                          label={s.down(tool.name)}
                          disabled={index >= activeIds.length - 1}
                          onClick={() => void tools?.move(tool.id, 1)}
                        >
                          <Icon name="chevronDown" />
                        </IconButton>
                      </>
                    ) : null}
                  </LibraryCard>
                );
              })}
            </ul>
          </section>
        );
      })}
    </>
  );
}
