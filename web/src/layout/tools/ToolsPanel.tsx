import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
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
  panelFocus,
  pickInitialTool,
  stepIndex,
  toolForDigit,
  type PanelFocus,
} from './panelLogic';
import { ToolPlate } from './ToolPlate';
import { canDetachTool, detachTool, ToolStage } from './ToolStage';
import styles from './ToolsPanel.module.css';

/** Below this width the dialog is a full-screen sheet (`ui/Dialog.module.css`): one pane at a time. */
const PHONE = '(max-width: 899px)';
/** Memory only (gone with the page): the tool the panel showed last, for when no history is kept. */
let lastShown: string | null = null;
const IS_MAC =
  typeof navigator !== 'undefined' &&
  /Mac|iPhone|iPad/.test(
    (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ??
      navigator.platform,
  );
const isEditable = (el: EventTarget | null): boolean =>
  el instanceof HTMLElement &&
  (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));

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
  // `null` = automatic (see `autoList`); the arrow and a pick set it explicitly.
  const [listChoice, setListView] = useState<boolean | null>(null);
  const [recentAtOpen, setRecentAtOpen] = useState<string[]>([]);
  const [blocked, setBlocked] = useState(false);

  // Each opening starts clean: no old search, the phone shows the tool, the last-used row is read once.
  const [wasOpen, setWasOpen] = useState(false);
  if (toolsOpen !== wasOpen) {
    setWasOpen(toolsOpen);
    if (toolsOpen) {
      // Without "Verlauf in der Suche" nothing is stored; the tool shown last is still remembered in memory.
      const recentIds = focus.searchHistory ? readRecentTools() : lastShown ? [lastShown] : [];
      setQuery('');
      setBlocked(false);
      setRecentAtOpen(recentIds);
      setListView(null);
    }
  }

  // A phone with no tool asked for and none used before starts on the list, not on an arbitrary tool.
  const autoList = phone && !activeTool && !ordered.some((x) => x.id === recentAtOpen[0]);
  // Until the tool settings are read there is nothing to choose from: no list flashing before the last tool.
  const listView = listChoice ?? (tools ? autoList : false);

  const shown: ToolManifest | undefined = toolsOpen
    ? pickInitialTool(ordered, activeTool, recentAtOpen)
    : undefined;
  // Picking a tool counts as using it (device-local, off with "Verlauf in der Suche"); the default pick does not.
  const shownId = shown?.id;
  const picked = shownId !== undefined && shownId === activeTool;
  useEffect(() => {
    if (shownId) lastShown = shownId;
  }, [shownId]);
  useEffect(() => {
    if (picked && shownId && focus.searchHistory) recordToolUse(shownId);
  }, [picked, shownId, focus.searchHistory]);

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

  const panelRef = useRef<HTMLDivElement>(null);
  const sideRef = useRef<HTMLElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  /**
   * Moves focus to `target` once it is on screen: the tool list and the tool body load lazily, so it looks again for
   * up to a second. It never takes focus back from where the user has gone meanwhile (only from where it was when the
   * pick or the opening happened, the landing pane or nowhere). `now`: look in this frame already (on opening); a pick
   * waits for the new tool's render.
   */
  const focusIn = (target: PanelFocus | null, now = false) => {
    if (!target) return;
    if (target === 'search') {
      searchRef.current?.focus();
      return;
    }
    const from = document.activeElement;
    let frames = 0;
    const step = () => {
      const panel = panelRef.current;
      if (!panel) return;
      const stage = stageRef.current?.querySelector<HTMLElement>('section') ?? null;
      const pane = panel.dataset.pane === 'list' ? sideRef.current : stage;
      const active = document.activeElement;
      const free = !active || active === from || active === document.body || active === pane;
      if (!free) return;
      const field =
        target === 'tool' ? stage?.querySelector<HTMLElement>('[data-autofocus]') : null;
      if (field) {
        field.focus();
        return;
      }
      if (pane && active !== pane) pane.focus({ preventScroll: true });
      if ((target === 'tool' || !pane) && frames++ < 60) requestAnimationFrame(step);
    };
    if (now) step();
    else requestAnimationFrame(step);
  };

  /** `byKeyboard`: Alt+1…9, Enter in the search or a tile pressed with the keyboard; focus follows into the tool. */
  const choose = (tool: ToolManifest, byKeyboard = false) => {
    setBlocked(false);
    openTools(tool.id);
    setListView(false);
    // On a phone the list disappears behind the tool, so focus always moves; on the desktop only from the keyboard.
    focusIn(panelFocus({ phone, toolAsked: true, byKeyboard }));
  };

  // Alt+1…9 from anywhere in the panel dialog (also out of a field or from its head), by key position, not by character.
  const onPanelKey = (e: globalThis.KeyboardEvent) => {
    if (!e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    const tool = toolForDigit(ordered, e.code);
    if (!tool) return;
    // Option+digit types characters on a Mac ([ ] { } on a German keyboard): leave fields alone there.
    if (IS_MAC && isEditable(e.target) && e.target !== searchRef.current) return;
    e.preventDefault();
    choose(tool, true);
  };
  const panelKey = useRef(onPanelKey);
  useLayoutEffect(() => {
    panelKey.current = onPanelKey;
  });
  useEffect(() => {
    if (!toolsOpen) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      const dialog = panelRef.current?.closest('dialog');
      if (dialog && e.target instanceof Node && dialog.contains(e.target)) panelKey.current(e);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [toolsOpen]);

  // Opening: the element that had focus is the trigger. Focus goes to the target of `panelFocus` (the dialog has
  // already put it on the search, or on its first button where nothing is marked). Closing: the native dialog
  // gives focus back to the trigger; if that is gone (the palette, a sheet), the page's main region takes it.
  const opener = useRef<Element | null>(null);
  useLayoutEffect(() => {
    if (toolsOpen) opener.current = document.activeElement;
  }, [toolsOpen]);
  useEffect(() => {
    if (toolsOpen) {
      focusIn(panelFocus({ phone, toolAsked: activeTool !== null, byKeyboard: true }), true);
      return;
    }
    const back = opener.current;
    if (back === null) return; // not opened yet (first render)
    opener.current = null;
    const lost = !document.activeElement || document.activeElement === document.body;
    if (!lost) return;
    if (back instanceof HTMLElement && back !== document.body && back.isConnected)
      back.focus({ preventScroll: true });
    else document.getElementById('main')?.focus({ preventScroll: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the panel opens or closes
  }, [toolsOpen]);
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
    } else if (e.key === 'Enter') {
      // Read the field itself: a fast typist may press Enter before the list has re-rendered.
      const first = filterTools(ordered, e.currentTarget.value)[0];
      if (!first) return;
      e.preventDefault();
      choose(first, true);
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
          aria-current={numbered && tool.id === shownId ? 'true' : undefined}
          aria-keyshortcuts={numbered && n <= 9 ? `Alt+${n}` : undefined}
          // `detail` 0: pressed with Enter or Space, not clicked.
          onClick={(e) => choose(tool, e.detail === 0)}
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
          <IconButton
            label={t.tools.back}
            onClick={() => {
              setListView(true);
              requestAnimationFrame(() => searchRef.current?.focus());
            }}
          >
            <Icon name="chevronLeft" />
          </IconButton>
        ) : undefined
      }
    >
      {toolsOpen ? (
        <div
          ref={panelRef}
          className={styles.panel}
          // A phone shows no empty list while the tool settings load (it would turn into the last tool a moment later).
          data-pane={phone ? (phoneTool || !tools ? 'tool' : 'list') : 'both'}
        >
          <nav
            ref={sideRef}
            className={styles.side}
            aria-label={t.tools.panel.list}
            // Landing spot on a phone that shows the list (focus without a field, so no on-screen keyboard).
            tabIndex={phone ? -1 : undefined}
            onKeyDown={onSideKey}
          >
            <input
              ref={searchRef}
              type="search"
              className={styles.search}
              aria-label={tComfort.get().tools.search}
              placeholder={tComfort.get().tools.searchPlaceholder}
              title={t.tools.panel.searchHint}
              value={query}
              // Desktop opened without a tool asked for: type to find. Otherwise `panelFocus` picks the target.
              data-autofocus={!phone && activeTool === null ? '' : undefined}
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
              <Link to="/notes" className={styles.scratch} onClick={closeTools}>
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
            {blocked ? (
              <p role="status" className={styles.note}>
                {t.tools.panel.detachBlocked}
              </p>
            ) : null}
            {shown ? (
              <ToolStage
                key={shown.id}
                tool={shown}
                onDetach={
                  canDetachTool() && !phone
                    ? () => {
                        setBlocked(false);
                        if (detachTool(shown)) closeTools();
                        else setBlocked(true);
                      }
                    : undefined
                }
              />
            ) : null}
          </div>
        </div>
      ) : null}
    </Dialog>
  );
}
