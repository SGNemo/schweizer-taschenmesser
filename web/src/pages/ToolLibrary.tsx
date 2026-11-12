import { useState } from 'react';
import { normalize } from '@/core/text/normalize';
import { useTools } from '@/core/tools/state';
import { useUiStore } from '@/stores/ui';
import { t } from '@/strings';
import { tComfort } from '@/strings.comfort';
import { tLibraryV3 } from '@/strings.libraryV3';
import { Button, ListSurface, Segmented, TextField, Toolbar, useHashTarget } from '@/ui';
import { SettingsTitle } from './settings/components/SettingsTitle';
import { ToolRow } from './tools/ToolRow';
import library from './library/Library.module.css';
import own from './tools/ToolLibrary.module.css';
import styles from './Page.module.css';

const s = t.tools.library;
const GROUPS = ['basis', 'extra', 'dev'] as const;

/**
 * `/tools`: switch tools on or off and set the order of the toolbar. Rows on one surface per group (Identity 4.0);
 * the same row as in Einstellungen → Werkzeugkasten (`ToolRow`).
 */
export function ToolLibrary() {
  const tools = useTools();
  const openTools = useUiStore((st) => st.openTools);
  const toast = useUiStore((st) => st.toast);
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
  /**
   * One place up or down in the toolbar: the tool changes places with the next tool that is on. (`tools.move` swaps
   * with the neighbour in the list of all tools; when that one is off, nothing visible happened.)
   */
  const moveInToolbar = (id: string, dir: -1 | 1) => {
    if (!tools) return;
    const other = activeIds[activeIds.indexOf(id) + dir];
    if (!other) return;
    const order = tools.all.map((x) => x.id);
    const a = order.indexOf(id);
    const b = order.indexOf(other);
    [order[a], order[b]] = [order[b]!, order[a]!];
    void tools.reorder(order);
    // The page is grouped, not in the toolbar's order: say where the tool stands now.
    const name = tools.all.find((x) => x.id === id)?.name ?? '';
    toast(s.moved(name, activeIds.indexOf(other) + 1, activeIds.length));
  };
  const anyMatch = (tools?.all ?? []).some(matches);
  // `/tools#tool-<id>` scrolls to that tool and marks it.
  useHashTarget(tools !== undefined);

  return (
    <>
      <SettingsTitle
        hue="slate"
        area="system"
        icon="wrench"
        eyebrow={v3.toolsEyebrow}
        title={s.title}
        description={s.intro}
        wholeDescription
        testId="tools-head"
      >
        {/* The head's context line: how many are on, of how many (no big figures, B2). */}
        <ul className={own.figures} aria-label={v3.figures.label} data-testid="tools-figures">
          <li>
            <strong>{activeIds.length}</strong> {v3.figures.active}
          </li>
          <li>
            <strong>{tools?.all.length ?? 0}</strong> {v3.figures.available}
          </li>
        </ul>
      </SettingsTitle>
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
          <section key={group} aria-labelledby={`tools-${group}`} className={own.group}>
            <h2 id={`tools-${group}`} className={own.groupHead}>
              {s.groups[group]}
              <span className={own.groupCount}>
                {v3.section(
                  (tools?.all ?? []).filter((x) => x.group === group && activeIds.includes(x.id))
                    .length,
                  (tools?.all ?? []).filter((x) => x.group === group).length,
                )}
              </span>
            </h2>
            <ListSurface>
              {inGroup.map((tool) => {
                const on = activeIds.includes(tool.id);
                const index = activeIds.indexOf(tool.id);
                return (
                  <li
                    key={tool.id}
                    id={`tool-${tool.id}`}
                    data-testid={`tool-${tool.id}`}
                    data-hue={tool.identity.hue}
                    className={own.item}
                  >
                    <ToolRow
                      tool={tool}
                      on={on}
                      plate="lg"
                      switchLabel={s.enable(tool.name)}
                      disabled={!tools}
                      onToggle={(checked) => {
                        setHeld((h) => new Set(h).add(tool.id));
                        void tools?.setEnabled(tool.id, checked);
                      }}
                      open={{ label: s.open(tool.name), run: () => openTools(tool.id) }}
                      move={{
                        up:
                          index > 0
                            ? { label: s.up(tool.name), run: () => moveInToolbar(tool.id, -1) }
                            : undefined,
                        down:
                          index >= 0 && index < activeIds.length - 1
                            ? { label: s.down(tool.name), run: () => moveInToolbar(tool.id, 1) }
                            : undefined,
                      }}
                    />
                  </li>
                );
              })}
            </ListSurface>
          </section>
        );
      })}
    </>
  );
}
