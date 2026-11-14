import { expect, type CDPSession, type Locator, type Page, type Request } from '@playwright/test';

/**
 * Click-to-content probe shared by `npm run measure:click` (e2e/perf/click.spec.ts) and the seed guard
 * (e2e/seed/click-content.seed.spec.ts). What `first` and `done` mean: docs/perf/CLICK-TO-CONTENT-2026-11.md.
 */
export const QUIET = 600;
export const CAP = 15_000;

export interface Sample {
  first: number;
  done: number;
  capped: boolean;
  chunks: number;
  chunkKb: number;
  idbOps: number;
  idbRows: number;
  /** Most read stores of this visit, "store×requests". */
  idbTop?: string[];
  /** Main-thread time between click and the end of the measurement (CDP `TaskDuration`, `ScriptDuration`). */
  taskMs: number;
  scriptMs: number;
  /** Layout and style recalculation in that time (CDP `LayoutDuration`/`RecalcStyleDuration`, ms; counts). */
  layoutMs?: number;
  styleMs?: number;
  layouts?: number;
  styles?: number;
  /** DOM size at `done`: elements in the document and inside `main`. */
  nodes?: number;
  mainNodes?: number;
  loadingMs: number;
}

/** Runs before any app code: IndexedDB read counter, changes to `main`/dialogs, long tasks, loading states. */
export function probe() {
  const s = {
    t0: 0,
    lastMut: 0,
    lastIdb: 0,
    pending: 0,
    ops: 0,
    rows: 0,
    stores: {} as Record<string, number>,
  };
  (window as unknown as { __ctc: typeof s }).__ctc = s;
  const inScope = (n: Node | null) => {
    const el = n && (n.nodeType === 1 ? (n as Element) : n.parentElement);
    return !!el?.closest('main, dialog[open], [role="dialog"]');
  };
  new MutationObserver((recs) => {
    if (recs.some((r) => inScope(r.target))) s.lastMut = performance.now();
  }).observe(document, { subtree: true, childList: true, characterData: true });
  const wrap = (proto: object, method: string) => {
    const original = (proto as Record<string, (...a: unknown[]) => IDBRequest>)[method];
    if (!original) return;
    (proto as Record<string, unknown>)[method] = function (this: unknown, ...a: unknown[]) {
      const req = original.apply(this, a);
      // Pending and last answer always (the wait before a click needs them); requests and rows only after a click.
      const counted = !!s.t0;
      if (counted) {
        s.ops++;
        const store =
          this instanceof IDBIndex ? this.objectStore.name : (this as IDBObjectStore).name;
        s.stores[store] = (s.stores[store] ?? 0) + 1;
      }
      s.pending++;
      const end = () => {
        s.pending--;
        s.lastIdb = performance.now();
        if (!counted) return;
        const r = req.result as unknown;
        if (Array.isArray(r)) s.rows += r.length;
        else if (r !== undefined && r !== null && typeof r === 'object') s.rows += 1;
      };
      req.addEventListener('success', end);
      req.addEventListener('error', end);
      return req;
    };
  };
  for (const proto of [IDBObjectStore.prototype, IDBIndex.prototype])
    for (const m of ['getAll', 'getAllKeys', 'get', 'count', 'openCursor', 'openKeyCursor'])
      wrap(proto, m);
  // A cursor's continue() answers on the same request: count each step.
  const cont = IDBCursor.prototype.continue;
  IDBCursor.prototype.continue = function (this: IDBCursor, ...a: [IDBValidKey?]) {
    if (s.t0) s.rows += 1;
    return cont.apply(this, a);
  };
}

type Metrics = Record<string, number>;
async function metrics(cdp: CDPSession): Promise<Metrics> {
  const { metrics: list } = (await cdp.send('Performance.getMetrics')) as {
    metrics: { name: string; value: number }[];
  };
  return Object.fromEntries(list.map((m) => [m.name, m.value]));
}

/**
 * Starts the clock and runs `action` inside the page; then waits for first content and done. React Router renders a
 * navigation in a transition (time-sliced), so long tasks miss most of that work: the CDP task time covers it.
 */
export async function measure(
  page: Page,
  cdp: CDPSession,
  action: 'nav' | 'click',
  arg: string,
): Promise<Sample> {
  // Files fetched after the click, seen by the browser (the page's own `performance` is Playwright's fake clock).
  const files: Promise<number>[] = [];
  const onFile = (req: Request) => {
    if (req.resourceType() === 'script' || req.resourceType() === 'stylesheet')
      files.push(
        req.sizes().then(
          (x) => x.responseBodySize,
          () => 0,
        ),
      );
  };
  const before = await metrics(cdp);
  page.on('requestfinished', onFile);
  const sample = await inPage(page, action, arg);
  page.off('requestfinished', onFile);
  const after = await metrics(cdp);
  sample.chunks = files.length;
  sample.chunkKb = Math.round((await Promise.all(files)).reduce((a, b) => a + b, 0) / 1024);
  sample.taskMs = Math.round(((after.TaskDuration ?? 0) - (before.TaskDuration ?? 0)) * 1000);
  sample.scriptMs = Math.round(((after.ScriptDuration ?? 0) - (before.ScriptDuration ?? 0)) * 1000);
  const delta = (k: string) => (after[k] ?? 0) - (before[k] ?? 0);
  sample.layoutMs = Math.round(delta('LayoutDuration') * 1000);
  sample.styleMs = Math.round(delta('RecalcStyleDuration') * 1000);
  sample.layouts = delta('LayoutCount');
  sample.styles = delta('RecalcStyleCount');
  const size = await page.evaluate(() => ({
    nodes: document.getElementsByTagName('*').length,
    mainNodes: document.querySelector('main')?.getElementsByTagName('*').length ?? 0,
  }));
  sample.nodes = size.nodes;
  sample.mainNodes = size.mainNodes;
  return sample;
}

function inPage(page: Page, action: 'nav' | 'click', arg: string): Promise<Sample> {
  return page.evaluate(
    ([kind, a, quiet, cap]) =>
      new Promise<Sample>((resolve) => {
        const s = (
          window as unknown as {
            __ctc: {
              t0: number;
              lastMut: number;
              lastIdb: number;
              pending: number;
              ops: number;
              rows: number;
              stores: Record<string, number>;
            };
          }
        ).__ctc;
        const heading = () => document.querySelector('main h1')?.textContent ?? '';
        const before = heading();
        const visible = (el: Element | null) =>
          !!el && (el as HTMLElement).getBoundingClientRect().height > 0;
        const loading = () => {
          const scope = [...document.querySelectorAll('main, dialog[open], [role="dialog"]')];
          return scope.some(
            (root) =>
              !!root.querySelector(
                '[data-testid="page-loading-card"], [class*="skeleton"], [aria-busy="true"]',
              ) ||
              [...root.querySelectorAll('[role="status"]')].some((e) => {
                const text = (e.textContent ?? '').trim();
                const label = e.getAttribute('aria-label') ?? '';
                return /^…$/.test(text) || /geladen/i.test(text) || /geladen/i.test(label);
              }),
          );
        };
        s.ops = s.rows = 0;
        s.stores = {};
        s.lastMut = s.lastIdb = 0;
        const t0 = performance.now();
        s.t0 = t0;
        if (kind === 'nav') {
          history.pushState({}, '', a);
          dispatchEvent(new PopStateEvent('popstate'));
        } else {
          (document.querySelector(`[data-ctc="${a}"]`) as HTMLElement).click();
        }
        let first = 0;
        let loadingSince = 0;
        let loadingMs = 0;
        const frame = () => {
          const now = performance.now();
          if (!first) {
            const ok =
              kind === 'nav'
                ? location.pathname === a &&
                  heading() !== '' &&
                  (heading() !== before || a === '/') &&
                  visible(document.querySelector('main h1'))
                : visible(document.querySelector('dialog[open], [role="dialog"]'));
            if (ok) first = now;
          }
          const busy = loading();
          if (busy && !loadingSince) loadingSince = now;
          if (!busy && loadingSince) {
            loadingMs += now - loadingSince;
            loadingSince = 0;
          }
          const last = Math.max(s.lastMut, s.lastIdb, first);
          const quietNow = first && !busy && s.pending <= 0 && now - last >= quiet;
          if (quietNow || now - t0 > cap) {
            s.t0 = 0;
            resolve({
              taskMs: 0,
              scriptMs: 0,
              first: Math.round((first || now) - t0),
              done: Math.round((quietNow ? last : now) - t0),
              capped: !quietNow,
              chunks: 0,
              chunkKb: 0,
              idbOps: s.ops,
              idbRows: s.rows,
              idbTop: Object.entries(s.stores)
                .sort((x, y) => y[1] - x[1])
                .slice(0, 6)
                .map(([k, v]) => `${k}×${v}`),
              loadingMs: Math.round(loadingMs + (loadingSince ? now - loadingSince : 0)),
            });
          } else requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
      }),
    [action, arg, QUIET, CAP] as const,
  );
}

/** Waits until the page is quiet (nothing changed in `main`, no IndexedDB request open or answered) for QUIET ms. */
export async function settle(page: Page) {
  await expect(page.locator('main h1').first()).toBeVisible({ timeout: 30_000 });
  await page.evaluate(
    ([quiet, cap]) =>
      new Promise<void>((resolve) => {
        const s = (
          window as unknown as { __ctc: { lastMut: number; lastIdb: number; pending: number } }
        ).__ctc;
        const began = performance.now();
        const tick = () => {
          const now = performance.now();
          const last = Math.max(s.lastMut, s.lastIdb, began);
          if ((s.pending <= 0 && now - last >= quiet) || now - began > cap) resolve();
          else setTimeout(tick, 100);
        };
        tick();
      }),
    [QUIET, CAP] as const,
  );
}

/** The main action of the current page: the filled button in `main`, else the "… eintragen" button (phone FAB). */
export async function mainAction(page: Page): Promise<Locator | null> {
  const candidates = [
    page.locator('main [data-variant="primary"]'),
    page.getByRole('button', { name: /eintragen|hinzufügen/i }),
  ];
  for (const c of candidates) {
    const n = await c.count();
    for (let i = 0; i < n; i++) {
      const el = c.nth(i);
      if (await el.isVisible()) return el;
    }
  }
  return null;
}

export const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)] ?? 0;
};
export function summarise(xs: Sample[]): Sample & { runs: number[] } {
  const done = median(xs.map((x) => x.done));
  const pick = xs.find((x) => x.done === done) ?? xs[0]!;
  return { ...pick, first: median(xs.map((x) => x.first)), done, runs: xs.map((x) => x.done) };
}

export async function cdpOf(page: Page): Promise<CDPSession> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Performance.enable');
  return cdp;
}
