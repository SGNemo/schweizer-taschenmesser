import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Link } from 'react-router';
import { useModuleStates } from '@/core/modules/activation';
import { useFocusSettings } from '@/core/settings/focus';
import { readRecentTools, recordToolUse } from '@/core/tools/recent';
import { useTools } from '@/core/tools/state';
import type { ToolManifest } from '@/core/tools/types';
import { useUiStore } from '@/stores/ui';
import { t } from '@/strings';
import { tComfort } from '@/strings.comfort';
import { Dialog, Icon, IconButton, useMediaQuery } from '@/ui';
import {
  filterTools,
  groupByCategory,
  orderForPanel,
  pickInitialTool,
  stepIndex,
  toolForDigit,
} from './panelLogic';
import { ToolPlate } from './ToolPlate';
import { canDetachTool, detachTool, ToolStage } from './ToolStage';
import styles from './ToolsPanel.module.css';

/** Below this width the dialog is a full-screen sheet (`ui/Dialog.module.css`): one pane at a time. */
const PHONE = '(max-width: 899px)';

/**
 * The toolbox: a large window with the list on the left (search, categories, Alt+1…9) and the tool
 * on the right in its own colours. It opens on the tool used last. On a phone it is a full-screen
 * sheet that shows the tool and goes back to the list with the arrow in the header.
 */
export function ToolsPanel() {
  const toolsOpen = useUiStore((s) => s.toolsOpen);
  const activeTool = useUiStore((s) => s.activeTool);
  const openTools = useUiStore((s) => s.openTools);
  const closeTools = useUiStore((s) => s.closeTools);
  const tools = useTools();
  const phone = useMediaQuery(PHONE);
  const [focus] = useFocusSettings();
  const states = useModuleStates();

  const ordered = useMemo(() => orderForPanel(tools?.active ?? []), [tools]);
  const [query, setQuery] = useState('');
  const [listView, setListView] = useState(false);
  const [recentAtOpen, setRecentAtOpen] = useState<string[]>([]);

  // Each opening starts clean: no old search, the phone shows the tool, the last-used row is read once.
  const [wasOpen, setWasOpen] = useState(false);
  if (toolsOpen !== wasOpen) {
    setWasOpen(toolsOpen);
    if (toolsOpen) {
      setQuery('');
      setListView(false);
      setRecentAtOpen(focus.searchHistory ? readRecentTools() : []);
    }
  }

  const shown: ToolManifest | undefined = toolsOpen
    ? pickInitialTool(ordered, activeTool, recentAtOpen)
    : undefined;
  // Showing a tool counts as using it (device-local, off with "Verlauf in der Suche").
  const shownId = shown?.id;
  useEffect(() => {
    if (shownId && focus.searchHistory) recordToolUse(shownId);
  }, [shownId, focus.searchHistory]);

  const visible = useMemo(() => filterTools(ordered, query), [ordered, query]);
  const groups = useMemo(() => groupByCategory(visible), [visible]);
  const recent = useMemo(
    () =>
      query || ordered.length <= 4
        ? []
        : recentAtOpen.flatMap((id) => ordered.filter((x) => x.id === id)),
    [query, ordered, recentAtOpen],
  );
  const scratchOn = !!states?.['notes'];

  const sideRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const choose = (tool: ToolManifest) => {
    openTools(tool.id);
    setListView(false);
  };
  const focusStage = () =>
    requestAnimationFrame(() => stageRef.current?.querySelector<HTMLElement>('section')?.focus());

  // Alt+1…9 from anywhere in the panel (also out of a field), by key position, not by character.
  const onPanelKey = (e: KeyboardEvent) => {
    if (!e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    const tool = toolForDigit(ordered, e.code);
    if (!tool) return;
    e.preventDefault();
    choose(tool);
    focusStage();
  };
  const buttons = () =>
    Array.from(sideRef.current?.querySelectorAll<HTMLButtonElement>('button[data-tool-btn]') ?? []);
  const onSideKey = (e: KeyboardEvent) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const list = buttons();
    const at = list.indexOf(document.activeElement as HTMLButtonElement);
    const next =
      e.key === 'ArrowDown'
        ? at < 0
          ? 0
          : stepIndex(at, list.length, 1)
        : stepIndex(at < 0 ? 0 : at, list.length, -1);
    if (next < 0) return;
    e.preventDefault();
    list[next]?.focus();
  };
  const onSearchKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape' && query) {
      // The first Esc empties the search, the next one closes the panel.
      e.preventDefault();
      e.stopPropagation();
      setQuery('');
    } else if (e.key === 'Enter' && visible[0]) {
      e.preventDefault();
      choose(visible[0]);
      focusStage();
    }
  };

  const tile = (tool: ToolManifest, numbered: boolean) => {
    const n = ordered.indexOf(tool) + 1;
    return (
      <li key={tool.id}>
        <button
          type="button"
          className={styles.tile}
          data-hue={tool.identity.hue}
          data-tool-btn=""
          aria-current={tool.id === shownId ? 'true' : undefined}
          aria-keyshortcuts={numbered && n <= 9 ? `Alt+${n}` : undefined}
          onClick={() => choose(tool)}
        >
          <ToolPlate tool={tool} size="sm" />
          <span className={styles.tileName}>{tool.name}</span>
          {numbered && n <= 9 ? (
            <kbd className={styles.number} aria-hidden="true">
              {t.tools.panel.number(n)}
            </kbd>
          ) : null}
        </button>
      </li>
    );
  };

  const phoneTool = phone && !listView && shown;
  const title = (phoneTool || !phone) && shown ? shown.name : t.tools.title;

  return (
    <Dialog
      open={toolsOpen}
      onClose={closeTools}
      title={title}
      size="xl"
      variant={phone ? 'full' : 'center'}
      headerStart={
        phoneTool ? (
          <IconButton label={t.tools.back} onClick={() => setListView(true)}>
            <Icon name="chevronLeft" />
          </IconButton>
        ) : undefined
      }
    >
      {toolsOpen ? (
        <div
          className={styles.panel}
          data-pane={phone ? (phoneTool ? 'tool' : 'list') : 'both'}
          onKeyDown={onPanelKey}
        >
          <nav
            ref={sideRef}
            className={styles.side}
            aria-label={t.tools.panel.list}
            onKeyDown={onSideKey}
          >
            <input
              type="search"
              className={styles.search}
              role="searchbox"
              aria-label={tComfort.get().tools.search}
              placeholder={tComfort.get().tools.searchPlaceholder}
              title={t.tools.panel.searchHint}
              value={query}
              data-autofocus={phone ? undefined : ''}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onSearchKey}
            />
            {recent.length > 0 ? (
              <section aria-label={tComfort.get().tools.recent}>
                <h3 className={styles.groupTitle}>{tComfort.get().tools.recent}</h3>
                <ul className={styles.tiles}>{recent.map((x) => tile(x, false))}</ul>
              </section>
            ) : null}
            {groups.map((g) => (
              <div key={g.category}>
                <h3 className={styles.groupTitle}>{t.tools.panel.categories[g.category]}</h3>
                <ul className={styles.tiles}>{g.tools.map((x) => tile(x, true))}</ul>
              </div>
            ))}
            {tools && ordered.length === 0 ? <p>{t.tools.none}</p> : null}
            {ordered.length > 0 && visible.length === 0 ? (
              <p role="status">{tComfort.get().tools.noResults}</p>
            ) : null}
            {scratchOn && !query ? (
              <Link to="/notes?scratch=1" className={styles.scratch} onClick={closeTools}>
                <Icon name="note" size={18} />
                <span>
                  <strong>{t.tools.panel.scratch}</strong>
                  <small>{t.tools.panel.scratchHint}</small>
                </span>
              </Link>
            ) : null}
            <Link to="/tools" className={styles.manage} onClick={closeTools}>
              {t.tools.manage}
            </Link>
          </nav>
          <div ref={stageRef} className={styles.stagePane}>
            {shown ? (
              <ToolStage
                key={shown.id}
                tool={shown}
                onDetach={
                  canDetachTool() && !phone
                    ? () => {
                        if (detachTool(shown)) closeTools();
                      }
                    : undefined
                }
              />
            ) : (
              <p>{t.tools.none}</p>
            )}
          </div>
        </div>
      ) : null}
    </Dialog>
  );
}
