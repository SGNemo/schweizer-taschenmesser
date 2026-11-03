import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test, type CDPSession, type Page } from '@playwright/test';

/**
 * Data-volume measurements (manual tooling, `npm run measure:data`; numbers in
 * docs/perf/DATA-BASELINE-*.md). Runs on the Dev-Preview build with the `xl` test set
 * (20,000 bookings, 5,000 events, 2,000 notes, 2,000 tasks, plus every other module at `large`).
 * Two profiles: `desktop`, and `pixel-7` (phone viewport, CPU 4× slower once the data is loaded).
 *
 * Nothing in the app is touched for this: an init script wraps the IndexedDB read methods and counts,
 * per object store, how many reads were started and how many rows they delivered ("scanned"). "Settled"
 * means the moment of the last IndexedDB activity after the action, i.e. when every live query had
 * finished loading. Times are ms of wall clock in the page; the median of RUNS runs is reported.
 */
const RUNS = Number(process.env.DATA_RUNS ?? 3);
const OUT = process.env.DATA_OUT ?? 'node_modules/.cache/perf-data';
const LABEL = process.env.DATA_LABEL ?? 'run';
const SCALE = process.env.DATA_SCALE ?? 'xl';
const MODULES = [
  'accounts',
  'bookmarks',
  'budgets',
  'calendar',
  'chat',
  'finance',
  'habits',
  'invoices',
  'lists',
  'maps',
  'music',
  'notes',
  'pantry',
  'people',
  'subscriptions',
  'timetrack',
  'todos',
  'vault',
  'weather',
];
const SEARCHES = ['tankstelle', 'arzt', 'miete'];

interface Reads {
  [store: string]: { ops: number; rows: number };
}
interface Step {
  ms: number;
  /** Reads started during the step, per store (only stores with at least one). */
  reads: Reads;
  ops: number;
  rows: number;
}

/** Wraps the IndexedDB read methods; `window.__idb` has the counters. Runs before any app code. */
function idbProbe() {
  const state = { reads: {} as Reads, last: 0 };
  (window as unknown as { __idb: typeof state }).__idb = state;
  const note = (store: string, rows: number) => {
    const s = (state.reads[store] ??= { ops: 0, rows: 0 });
    s.ops += rows < 0 ? 1 : 0;
    s.rows += Math.max(rows, 0);
    state.last = performance.now();
  };
  const wrap = (proto: object, method: string, kind: 'all' | 'one' | 'count' | 'cursor') => {
    const original = (proto as Record<string, (...a: unknown[]) => IDBRequest>)[method];
    if (!original) return;
    (proto as Record<string, unknown>)[method] = function (
      this: IDBObjectStore | IDBIndex,
      ...a: unknown[]
    ) {
      const store = 'objectStore' in this ? this.objectStore.name : this.name;
      note(store, -1);
      const req = original.apply(this, a);
      req.addEventListener('success', () => {
        const r = req.result as unknown;
        if (kind === 'all') note(store, (r as unknown[]).length);
        else if (kind === 'one') note(store, r === undefined ? 0 : 1);
        else if (kind === 'cursor' && r) note(store, 1);
        else note(store, 0);
      });
      return req;
    };
  };
  for (const proto of [IDBObjectStore.prototype, IDBIndex.prototype]) {
    wrap(proto, 'getAll', 'all');
    wrap(proto, 'getAllKeys', 'all');
    wrap(proto, 'get', 'one');
    wrap(proto, 'count', 'count');
    wrap(proto, 'openCursor', 'cursor');
    wrap(proto, 'openKeyCursor', 'cursor');
  }
}

/** Marks for the cold-start style metrics (same idea as e2e/screenshots/coldstart.spec.ts). */
function marks() {
  const m: Record<string, number> = {};
  (window as unknown as { __marks: Record<string, number> }).__marks = m;
  const check = () => {
    const h1 = document.querySelector('main h1');
    if (!m.h1 && h1 && (h1 as HTMLElement).offsetParent !== null) m.h1 = performance.now();
    const el = document.activeElement as HTMLElement | null;
    if (!m.captureFocused && el?.getAttribute('aria-label') === 'Was möchtest du festhalten?')
      m.captureFocused = performance.now();
    requestAnimationFrame(check);
  };
  requestAnimationFrame(check);
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)] ?? 0;
};

async function resetReads(page: Page) {
  await page.evaluate(() => {
    const s = (window as unknown as { __idb: { reads: object; last: number } }).__idb;
    s.reads = {};
    s.last = 0;
  });
}

/** Waits until nothing touched IndexedDB for `quiet` ms; returns the time of the last activity since `t0`. */
async function settle(page: Page, t0: number, quiet = 500, timeout = 120_000): Promise<Step> {
  const out = await page.evaluate(
    ([start, q, limit]) =>
      new Promise<{ end: number; reads: Reads }>((resolve) => {
        const s = (window as unknown as { __idb: { reads: Reads; last: number } }).__idb;
        const began = performance.now();
        const tick = () => {
          const now = performance.now();
          if (now - Math.max(s.last, start) >= q || now - began > limit)
            resolve({ end: Math.max(s.last, start), reads: s.reads });
          else setTimeout(tick, 50);
        };
        tick();
      }),
    [t0, quiet, timeout] as const,
  );
  const stores = Object.fromEntries(Object.entries(out.reads).filter(([, v]) => v.ops > 0));
  return {
    ms: Math.round(out.end - t0),
    reads: stores,
    ops: Object.values(stores).reduce((a, b) => a + b.ops, 0),
    rows: Object.values(stores).reduce((a, b) => a + b.rows, 0),
  };
}

const now = (page: Page) => page.evaluate(() => performance.now());

/** Client-side navigation (no reload), like a click on the navigation. `h1` is the heading that was shown. */
async function navigate(page: Page, path: string): Promise<Step & { h1: string }> {
  await resetReads(page);
  const before = await page.evaluate(() => document.querySelector('main h1')?.textContent ?? '');
  const t0 = await now(page);
  await page.evaluate((p) => {
    history.pushState({}, '', p);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, path);
  // The new page is there when the heading changed; modules that keep the heading or have none: 4 s.
  await page
    .waitForFunction(
      ([p, prev]) =>
        location.pathname === p && (document.querySelector('main h1')?.textContent ?? '') !== prev,
      [path, before] as const,
      { timeout: 4_000, polling: 25 },
    )
    .catch(() => undefined);
  const step = await settle(page, t0);
  const h1 = await page.evaluate(() => document.querySelector('main h1')?.textContent ?? '');
  return { ...step, h1 };
}

function summarise<T extends Step>(steps: T[]): T {
  const ms = median(steps.map((s) => s.ms));
  const pick = steps.find((s) => s.ms === ms) ?? steps[0]!;
  return { ...pick, ms };
}

async function heapMb(cdp: CDPSession): Promise<number> {
  await cdp.send('HeapProfiler.collectGarbage').catch(() => undefined);
  const { metrics } = (await cdp.send('Performance.getMetrics')) as {
    metrics: { name: string; value: number }[];
  };
  return (
    Math.round(((metrics.find((m) => m.name === 'JSHeapUsedSize')?.value ?? 0) / 1048576) * 10) / 10
  );
}

async function storage(page: Page) {
  return page.evaluate(async () => {
    const e = await navigator.storage.estimate();
    return {
      usageMb: Math.round(((e.usage ?? 0) / 1048576) * 10) / 10,
      quotaMb: Math.round((e.quota ?? 0) / 1048576),
    };
  });
}

/** Row counts per synced table (raw IndexedDB). */
async function countRows(page: Page): Promise<Record<string, number>> {
  return page.evaluate(
    () =>
      new Promise<Record<string, number>>((resolve, reject) => {
        const open = indexedDB.open('taschenmesser');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const names = [...db.objectStoreNames].filter((n) => !n.startsWith('_'));
          const tx = db.transaction(names, 'readonly');
          const out: Record<string, number> = {};
          for (const n of names) {
            const req = tx.objectStore(n).count();
            req.onsuccess = () => (out[n] = req.result);
          }
          tx.oncomplete = () => {
            db.close();
            resolve(out);
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
  );
}

/** All rows of all non-underscore tables as a backup file (the seeds are left out of real backups). */
async function buildBackupJson(page: Page): Promise<string> {
  return page.evaluate(
    () =>
      new Promise<string>((resolve, reject) => {
        const open = indexedDB.open('taschenmesser');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const names = [...db.objectStoreNames].filter((n) => !n.startsWith('_'));
          const tx = db.transaction(names, 'readonly');
          const tables: Record<string, unknown[]> = {};
          for (const n of names) {
            const req = tx.objectStore(n).getAll();
            req.onsuccess = () => {
              if (req.result.length) tables[n] = req.result;
            };
          }
          tx.oncomplete = () => {
            db.close();
            resolve(
              JSON.stringify({
                format: 'taschenmesser-backup',
                version: 1,
                exportedAt: new Date().toISOString(),
                tables,
              }),
            );
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
  );
}

test('data volume: ' + SCALE, async ({ page }, info) => {
  const phone = info.project.name === 'pixel-7';
  const result: Record<string, unknown> = { profile: info.project.name, scale: SCALE, runs: RUNS };
  const save = () => {
    mkdirSync(OUT, { recursive: true });
    writeFileSync(`${OUT}/${LABEL}-${info.project.name}.json`, JSON.stringify(result, null, 2));
  };
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Performance.enable');
  await page.addInitScript(idbProbe);
  await page.addInitScript(marks);
  // No fixed clock here (unlike e2e/seed): with a frozen `Date` the start with data takes seconds longer,
  // which is an artefact of the test clock, not of the app. Only the first-start auto-fill is switched off.
  await page.addInitScript(() => {
    try {
      localStorage.setItem('tm-seed-autofilled', '1');
    } catch {
      // storage blocked – then auto-fill would not run either
    }
  });

  // 1. Load the test set (write throughput of createMany in chunks of 500).
  await page.goto('/settings/entwickler');
  await expect(page.locator('main h1')).toBeVisible();
  const section = page.locator('section[aria-labelledby="developer"]');
  // `xl` is not offered in the UI on purpose (measurements only): add the option to the select.
  await section.getByLabel('Umfang').evaluate((el, v) => {
    const select = el as HTMLSelectElement;
    if (![...select.options].some((o) => o.value === v)) select.add(new Option(v, v));
  }, SCALE);
  await section.getByLabel('Umfang').selectOption(SCALE);
  const seedStart = Date.now();
  await section.getByTestId('seed-load').click();
  await expect(section.getByTestId('seed-status')).toBeVisible({ timeout: 900_000 });
  await expect(section.getByTestId('seed-load')).toBeEnabled({ timeout: 900_000 });
  result.seedMs = Date.now() - seedStart;
  const rows = await countRows(page);
  result.rows = rows;
  result.totalRows = Object.values(rows).reduce((a, b) => a + b, 0);
  result.storageAfterSeed = await storage(page);

  // From here on the phone profile is slow.
  if (phone) await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });

  // 2. App start to interactive, first overview (reload with data), quick capture.
  const starts: { h1: number; settled: number; rows: number; ops: number }[] = [];
  let startReads: Reads = {};
  for (let i = 0; i < RUNS; i++) {
    await page.goto('/', { waitUntil: 'commit' });
    await page.waitForFunction(
      () => Boolean((window as unknown as { __marks?: Record<string, number> }).__marks?.h1),
      undefined,
      { timeout: 120_000, polling: 50 },
    );
    const h1 = await page.evaluate(
      () => (window as unknown as { __marks: Record<string, number> }).__marks.h1!,
    );
    const step = await settle(page, 0);
    starts.push({ h1: Math.round(h1), settled: step.ms, rows: step.rows, ops: step.ops });
    startReads = step.reads;
  }
  result.start = {
    h1: median(starts.map((s) => s.h1)),
    settled: median(starts.map((s) => s.settled)),
    ops: starts[0]!.ops,
    rows: starts[0]!.rows,
    reads: startReads,
    runs: starts,
  };
  result.heapAfterHomeMb = await heapMb(cdp);
  save();

  const capture: number[] = [];
  for (let i = 0; i < RUNS; i++) {
    await page.goto('/?capture=1', { waitUntil: 'commit' });
    await page
      .screenshot({ path: info.outputPath(`capture-${i}-early.png`) })
      .catch(() => undefined);
    await page.waitForFunction(
      () =>
        Boolean(
          (window as unknown as { __marks?: Record<string, number> }).__marks?.captureFocused,
        ),
      undefined,
      { timeout: 120_000, polling: 50 },
    );
    capture.push(
      Math.round(
        await page.evaluate(
          () => (window as unknown as { __marks: Record<string, number> }).__marks.captureFocused!,
        ),
      ),
    );
  }
  result.quickCaptureFocusMs = median(capture);
  save();

  // 3. Open every module (client-side navigation from the overview).
  await page.goto('/');
  await expect(page.locator('main h1')).toBeVisible();
  await settle(page, 0);
  const modules: Record<string, Step & { h1: string }> = {};
  for (const id of MODULES) {
    const runs: (Step & { h1: string })[] = [];
    for (let i = 0; i < RUNS; i++) {
      await navigate(page, '/'); // back to the overview so every run starts the same
      runs.push(await navigate(page, `/${id}`));
    }
    modules[id] = summarise(runs);
  }
  result.modules = modules;
  result.heapAfterModulesMb = await heapMb(cdp);
  save();

  // 4. Search (command palette): type the query, wait until all reads are done.
  await page.goto('/');
  await expect(page.locator('main h1')).toBeVisible();
  const searches: Record<string, Step> = {};
  for (const q of SEARCHES) {
    const runs: Step[] = [];
    for (let i = 0; i < RUNS; i++) {
      await page.keyboard.press('Control+k');
      await expect(page.getByRole('dialog')).toBeVisible();
      await resetReads(page);
      const t0 = await now(page);
      await page.keyboard.type(q, { delay: 60 });
      runs.push(await settle(page, t0, 800));
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog')).toHaveCount(0);
    }
    searches[q] = summarise(runs);
  }
  result.searches = searches;
  save();

  // 5. Backup and restore. Seeded rows are left out of real backups, so the seed rows are exported
  //    as a backup file first, the seed is removed, the file is restored and a backup is downloaded.
  if (phone) await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  const json = await buildBackupJson(page);
  const file = info.outputPath('perf-backup.json');
  mkdirSync(info.outputDir, { recursive: true });
  writeFileSync(file, json);
  result.backupFileMb = Math.round((json.length / 1048576) * 10) / 10;

  await page.goto('/settings/entwickler');
  await expect(page.locator('main h1')).toBeVisible();
  const removeStart = Date.now();
  await page.getByTestId('seed-remove').click();
  await expect(page.getByTestId('seed-status')).toHaveCount(0, { timeout: 900_000 });
  await expect(page.getByTestId('seed-remove')).toBeDisabled({ timeout: 900_000 });
  result.seedRemoveMs = Date.now() - removeStart;
  expect(Object.values(await countRows(page)).reduce((a, b) => a + b, 0)).toBeLessThan(50);

  if (phone) await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.goto('/settings/sync');
  await expect(page.locator('main h1')).toBeVisible();
  const restoreStart = Date.now();
  await page.locator('#backup-file').setInputFiles(file);
  await expect(page.getByTestId('backup-contents')).toContainText('Einträge in', {
    timeout: 900_000,
  });
  result.backupReadMs = Date.now() - restoreStart;
  const importStart = Date.now();
  await page.getByRole('button', { name: 'Importieren' }).click();
  await expect(page.getByText(/Einträge wiederhergestellt/)).toBeVisible({ timeout: 900_000 });
  result.restoreMs = Date.now() - importStart;
  result.storageAfterRestore = await storage(page);
  result.heapAfterRestoreMb = await heapMb(cdp);

  const downloadStart = Date.now();
  const download = page.waitForEvent('download', { timeout: 900_000 });
  await page.getByRole('button', { name: 'Backup herunterladen' }).click();
  await download;
  result.backupCreateMs = Date.now() - downloadStart;

  mkdirSync(OUT, { recursive: true });
  const outFile = `${OUT}/${LABEL}-${info.project.name}.json`;
  writeFileSync(outFile, JSON.stringify(result, null, 2));
  console.log(`\n[perf-data] ${outFile}\n${JSON.stringify(result, null, 2)}`);
});
