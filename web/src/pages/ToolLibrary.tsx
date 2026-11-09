import { useState } from 'react';
import { normalize } from '@/core/text/normalize';
import { useTools } from '@/core/tools/state';
import { useUiStore } from '@/stores/ui';
import { t } from '@/strings';
import { tComfort } from '@/strings.comfort';
import { tLibraryV3 } from '@/strings.libraryV3';
import {
  Badge,
  Button,
  Icon,
  IconButton,
  LibraryCard,
  Segmented,
  Switch,
  TextField,
  Toolbar,
  useHashTarget,
} from '@/ui';
import { PageHead } from './settings/PageHead';
import library from './library/Library.module.css';
import styles from './Page.module.css';

const s = t.tools.library;
const GROUPS = ['basis', 'extra', 'dev'] as const;

/** `/tools`: switch tools on or off and set the order of the toolbar. */
export function ToolLibrary() {
  const tools = useTools();
  const openTools = useUiStore((st) => st.openTools);
  const activeIds = tools?.active.map((x) => x.id) ?? [];
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'off'>('all');
  // Tools just switched stay listed until the search or the filter changes (the card and the focus do not vanish).
  const [held, setHeld] = useState<ReadonlySet<string>>(new Set());
  const release = () => setHeld(new Set());
  const text = tComfort.get().tools;
  const v3 = tLibraryV3.use();
  const tokens = normalize(query).split(/\s+/).filter(Boolean);
  const matches = (x: { id: string; name: string; description: string }) => {
    const hay = normalize(`${x.name} ${x.description}`);
    if (!tokens.every((tok) => hay.includes(tok))) return false;
    if (held.has(x.id)) return true;
    if (filter === 'active') return activeIds.includes(x.id);
    if (filter === 'off') return !activeIds.includes(x.id);
    return true;
  };
  const anyMatch = (tools?.all ?? []).some(matches);
  // `/tools#tool-<id>` scrolls to that tool and marks it.
  useHashTarget(tools !== undefined);

  return (
    <>
      <PageHead
        hue="slate"
        area="system"
        icon="wrench"
        eyebrow={v3.toolsEyebrow}
        title={s.title}
        description={s.intro}
        size="tall"
        testId="tools-head"
      >
        <ul className={library.figures} aria-label={v3.figures.label} data-testid="tools-figures">
          <li>
            <strong>{activeIds.length}</strong> {v3.figures.active}
          </li>
          <li>
            <strong>{tools?.all.length ?? 0}</strong> {v3.figures.available}
          </li>
        </ul>
      </PageHead>
      <Toolbar>
        <div role="search" className={library.toolbarSearch}>
          <TextField
            label={text.search}
            labelHidden
            type="search"
            placeholder={text.searchPlaceholder}
            value={query}
            autoComplete="off"
            onChange={(e) => {
              release();
              setQuery(e.target.value);
            }}
          />
        </div>
        <div className={library.filterSeg}>
          <Segmented
            label={v3.filter.label}
            value={filter}
            onChange={(f) => {
              release();
              setFilter(f);
            }}
            options={[
              { value: 'all', label: v3.filter.all },
              { value: 'active', label: v3.filter.active },
              { value: 'off', label: v3.filter.off },
            ]}
          />
        </div>
      </Toolbar>
      <div className={library.empty} data-shown={Boolean(tools) && !anyMatch}>
        <div role="status">
          {tools && !anyMatch ? (
            <p className={styles.lead}>{query.trim() ? text.noResults : v3.filter.none}</p>
          ) : null}
        </div>
        {tools && !anyMatch && (query.trim() || filter !== 'all') ? (
          <Button
            onClick={() => {
              release();
              setQuery('');
              setFilter('all');
            }}
          >
            {v3.filter.reset}
          </Button>
        ) : null}
      </div>
      {GROUPS.map((group) => {
        const inGroup = (tools?.all ?? []).filter((x) => x.group === group && matches(x));
        if (inGroup.length === 0) return null;
        return (
          <section
            key={group}
            aria-labelledby={`tools-${group}`}
            className={library.group}
            data-area="system"
          >
            <h2 id={`tools-${group}`} className={library.groupHead}>
              {s.groups[group]}
              <span className={library.groupCount}>
                {v3.section(
                  (tools?.all ?? []).filter((x) => x.group === group && activeIds.includes(x.id))
                    .length,
                  (tools?.all ?? []).filter((x) => x.group === group).length,
                )}
              </span>
            </h2>
            <ul className={library.cards}>
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
                    hue={tool.identity.hue}
                    badges={
                      // U32: the badges always sit in their own row under the name, so the heads of one row are
                      // equally tall (a wrapping "Auch ohne Internet" made them 66 or 96 px).
                      <span className={library.badgeRow}>
                        <Badge>{tool.offline ? s.offline : s.online}</Badge>
                        {tool.maturity === 'preview' ? (
                          <Badge>{t.settings.maturity.badge}</Badge>
                        ) : null}
                      </span>
                    }
                  >
                    <Switch
                      label={s.enable(tool.name)}
                      checked={on}
                      disabled={!tools}
                      onChange={(checked) => {
                        setHeld((h) => new Set(h).add(tool.id));
                        void tools?.setEnabled(tool.id, checked);
                      }}
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
