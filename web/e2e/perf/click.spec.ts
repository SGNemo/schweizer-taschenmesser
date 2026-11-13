import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, type CDPSession, type Locator, type Page, type Request } from '@playwright/test';
import { test } from '../seed/helpers';
import { MODULE_IDS, PHONE_MODULE_IDS, startSeeded } from '../seed/guards';

/**
 * Click to content (manual tooling, `npm run measure:click`; numbers in docs/perf/CLICK-TO-CONTENT-2026-11.md).
 * Seeded Dev-Preview build (`medium`), every module of the window on, CPU slowed through CDP
 * (`Emulation.setCPUThrottlingRate`, rates in CLICK_RATES, default "4,6"), RUNS runs per target, median reported.
 *
 * Targets: every module route, `/settings`, `/library`, the overview `/` (reached from `/todos`), and per module the
 * dialog behind its main action ("… eintragen"/"… hinzufügen"). Each target twice:
 * - `first`: the app was just loaded on the start page (`/`, settled), nothing of the target ran yet;
 * - `second`: back on the start page, then the same click again (code and data seen once).
 *
 * The click is the router's own navigation (`pushState` + `popstate`, what a link click does after its handler),
 * started inside the page so the clock starts exactly there. Times in ms after the click:
 * - `first`: the first animation frame in which the new page's heading (or the dialog) is visible;
 * - `done`: the last change to `main`/the dialog or the last IndexedDB answer before 600 ms of quiet with no loading
 *   state left (`…`, "Wird geladen", skeletons, the page loading card). Capped at 15 s (`capped`).
 * Per target also the cause trail: script/style files fetched after the click, IndexedDB reads (requests, rows),
 * main-thread time (CDP `TaskDuration`/`ScriptDuration`, click to end of measurement, so it includes the 600 ms of
 * quiet) and how long a loading state stood. `performance.now()` is Playwright's clock here (`bootDev` fixes the
 * date): it runs at real speed, but resource and long-task entries are not available, hence CDP and network events.
 */
const RUNS = Number(process.env.RUNS ?? 3);
const RATES = (process.env.CLICK_RATES ?? '4,6').split(',').map(Number);
const OUT = process.env.CLICK_OUT ?? 'node_modules/.cache/click';
const LABEL = process.env.CLICK_LABEL ?? 'run';
const ONLY = process.env.CLICK_ONLY?.split(',');
const KINDS = (process.env.CLICK_KINDS ?? 'page,dialog').split(',');
/** `CLICK_PROFILE=1`: CPU profile of every first page visit, self time per file (`profile` in the JSON). */
const PROFILE = process.env.CLICK_PROFILE === '1';
const QUIET = 600;
const CAP = 15_000;

interface Sample {
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
  loadingMs: number;
}

/** Runs before any app code: IndexedDB read counter, changes to `main`/dialogs, long tasks, loading states. */
function probe() {
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
async function measure(
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
async function settle(page: Page) {
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
async function mainAction(page: Page): Promise<Locator | null> {
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

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)] ?? 0;
};
function summarise(xs: Sample[]): Sample & { runs: number[] } {
  const done = median(xs.map((x) => x.done));
  const pick = xs.find((x) => x.done === done) ?? xs[0]!;
  return { ...pick, first: median(xs.map((x) => x.first)), done, runs: xs.map((x) => x.done) };
}

interface ProfileNode {
  id: number;
  callFrame: { url: string; functionName: string };
  hitCount?: number;
}
/** Self time per file of a CDP CPU profile (ms, sampled), the largest first; `(program)`/`(idle)` left out. */
function selfTimeByFile(profile: {
  nodes: ProfileNode[];
  samples?: number[];
  timeDeltas?: number[];
}): Record<string, number> {
  const byNode = new Map(profile.nodes.map((n) => [n.id, n]));
  const out: Record<string, number> = {};
  (profile.samples ?? []).forEach((id, i) => {
    const node = byNode.get(id);
    const dt = (profile.timeDeltas?.[i] ?? 0) / 1000;
    const url = node?.callFrame.url ?? '';
    const name = node?.callFrame.functionName ?? '';
    const key = url
      ? url.replace(/^.*\/assets\//, '').replace(/-[\w-]{8}\.js$/, '')
      : `(${name || '?'})`;
    if (key === '((idle))' || key === '(idle)' || key === '(program)') return;
    out[key] = (out[key] ?? 0) + dt;
  });
  return Object.fromEntries(
    Object.entries(out)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([k, v]) => [k, Math.round(v)]),
  );
}

async function cdpOf(page: Page): Promise<CDPSession> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Performance.enable');
  return cdp;
}

interface Target {
  id: string;
  kind: 'page' | 'dialog';
  start: string;
  path: string;
}

function targets(phone: boolean): Target[] {
  const ids = phone ? PHONE_MODULE_IDS : MODULE_IDS;
  const pages: Target[] = [
    { id: 'overview', kind: 'page', start: '/todos', path: '/' },
    { id: 'settings', kind: 'page', start: '/', path: '/settings' },
    { id: 'library', kind: 'page', start: '/', path: '/library' },
    ...ids.map((id) => ({ id, kind: 'page' as const, start: '/', path: `/${id}` })),
  ];
  const dialogs = ids.map((id) => ({
    id: `${id}+`,
    kind: 'dialog' as const,
    start: `/${id}`,
    path: '',
  }));
  return [...pages, ...dialogs].filter(
    (t) => KINDS.includes(t.kind) && (!ONLY || ONLY.includes(t.id.replace('+', ''))),
  );
}

async function run(page: Page, phone: boolean, label: string) {
  test.setTimeout(6 * 3_600_000);
  await page.addInitScript(probe);
  await startSeeded(page, { phone });
  const cdp = await cdpOf(page);
  const results: Record<string, Record<string, unknown>> = {};
  for (const rate of RATES) {
    await cdp.send('Emulation.setCPUThrottlingRate', { rate });
    const raw: Record<
      string,
      {
        first: Sample[];
        second: Sample[];
        note?: string;
        open?: string;
        profile?: Record<string, number>[];
      }
    > = {};
    for (let r = 0; r < RUNS; r++) {
      for (const t of targets(phone)) {
        const slot = (raw[t.id] ??= { first: [], second: [] });
        if (slot.note) continue;
        const began = Date.now();
        await page.goto(t.start);
        await settle(page);
        if (t.kind === 'page') {
          if (PROFILE) {
            await cdp.send('Profiler.enable');
            await cdp.send('Profiler.setSamplingInterval', { interval: 200 });
            await cdp.send('Profiler.start');
          }
          slot.first.push(await measure(page, cdp, 'nav', t.path));
          if (PROFILE) {
            const { profile } = (await cdp.send('Profiler.stop')) as {
              profile: Parameters<typeof selfTimeByFile>[0];
            };
            (slot.profile ??= []).push(selfTimeByFile(profile));
          }
          await page.evaluate((p) => {
            history.pushState({}, '', p);
            dispatchEvent(new PopStateEvent('popstate'));
          }, t.start);
          await settle(page);
          slot.second.push(await measure(page, cdp, 'nav', t.path));
        } else {
          const action = await mainAction(page);
          if (!action) {
            slot.note = 'no main action';
            continue;
          }
          // Read before the click: a main action that navigates (chat: "KI-Anbieter einrichten") takes the button away.
          const text = (await action.textContent({ timeout: 5_000 }))?.trim();
          await action.evaluate((el) => el.setAttribute('data-ctc', 'go'));
          const firstRun = await measure(page, cdp, 'click', 'go');
          const dialog = page.getByRole('dialog');
          if (!(await dialog.isVisible())) {
            slot.note = `main action opens no dialog (${text})`;
            continue;
          }
          slot.first.push(firstRun);
          await page.keyboard.press('Escape');
          // A dialog that asks before it closes (a draft): the first visit counts, the second is left out.
          const closed = await dialog.waitFor({ state: 'detached', timeout: 10_000 }).then(
            () => true,
            () => false,
          );
          if (!closed) {
            slot.open = `dialog stays open on Escape (${text})`;
            continue;
          }
          await settle(page);
          await action.evaluate((el) => el.setAttribute('data-ctc', 'go'));
          slot.second.push(await measure(page, cdp, 'click', 'go'));
          await page.keyboard.press('Escape');
        }
        const last = (x: Sample[]) => x.at(-1);
        console.log(
          `${label} ${rate}x run ${r + 1} ${t.id}: ${last(slot.first)?.done ?? '-'}${last(slot.first)?.capped ? '+' : ''} / ${last(slot.second)?.done ?? '-'}${last(slot.second)?.capped ? '+' : ''} ms (${Math.round((Date.now() - began) / 1000)} s)`,
        );
      }
    }
    results[`${rate}x`] = Object.fromEntries(
      Object.entries(raw).map(([id, v]) => [
        id,
        v.note
          ? { note: v.note }
          : {
              first: summarise(v.first),
              ...(v.second.length ? { second: summarise(v.second) } : {}),
              ...(v.open ? { note: v.open } : {}),
              ...(v.profile ? { profile: v.profile } : {}),
            },
      ]),
    );
    mkdirSync(OUT, { recursive: true });
    writeFileSync(`${OUT}/${LABEL}-${label}.json`, JSON.stringify(results, null, 2));
  }
}

test.describe('desktop 1920×1080', () => {
  test.use({
    viewport: { width: 1920, height: 1080 },
    seeded: { scale: 'medium', desktop: true, preview: true },
  });
  test('click to content', async ({ page }) => run(page, false, 'desktop'));
});

test.describe('phone 412×915', () => {
  test.use({
    viewport: { width: 412, height: 915 },
    isMobile: true,
    hasTouch: true,
    seeded: { scale: 'medium', preview: true },
  });
  test('click to content', async ({ page }) => run(page, true, 'phone'));
});
