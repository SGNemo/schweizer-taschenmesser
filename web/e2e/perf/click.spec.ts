import { mkdirSync, writeFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { cdpOf, mainAction, measure, probe, settle, summarise, type Sample } from './clickProbe';
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
/** `CLICK_PROFILE=1`: CPU profile of every first page visit, self time per file (`profile` in the JSON); `fn`: per function. */
const PROFILE = process.env.CLICK_PROFILE === 'fn' ? 'fn' : process.env.CLICK_PROFILE === '1';
interface ProfileNode {
  id: number;
  callFrame: { url: string; functionName: string };
  hitCount?: number;
}
/** Self time per file of a CDP CPU profile (ms, sampled), the largest first; native time, GC and idle as `=…` totals. */
function selfTimeByFile(profile: {
  nodes: ProfileNode[];
  samples?: number[];
  timeDeltas?: number[];
}): Record<string, number> {
  const byNode = new Map(profile.nodes.map((n) => [n.id, n]));
  const out: Record<string, number> = {};
  /** `=js`, `=program`, `=garbage collector`, `=idle`: where the sampled time went, summed. */
  const totals: Record<string, number> = {};
  (profile.samples ?? []).forEach((id, i) => {
    const node = byNode.get(id);
    const dt = (profile.timeDeltas?.[i] ?? 0) / 1000;
    const url = node?.callFrame.url ?? '';
    const name = node?.callFrame.functionName ?? '';
    const file = url
      ? url.replace(/^.*\/assets\//, '').replace(/-[\w-]{8}\.js$/, '')
      : `(${name || '?'})`;
    // CLICK_PROFILE=fn: per function (useful with an unminified build, see docs/perf/CLICK-TO-CONTENT-2026-11.md).
    const key = PROFILE === 'fn' && url ? `${file}:${name || '(anonymous)'}` : file;
    // Native time (layout, style, paint, parsing) is "(program)"; it is kept apart as a total, like GC and idle.
    if (!url && ['(idle)', '(program)', '(garbage collector)', '(root)'].includes(name)) {
      const k = `=${name.replace(/[()]/g, '')}`;
      totals[k] = (totals[k] ?? 0) + dt;
      return;
    }
    totals['=js'] = (totals['=js'] ?? 0) + dt;
    out[key] = (out[key] ?? 0) + dt;
  });
  return Object.fromEntries([
    ...Object.entries(totals).map(([k, v]) => [k, Math.round(v)] as const),
    ...Object.entries(out)
      .sort((a, b) => b[1] - a[1])
      .slice(0, PROFILE === 'fn' ? 15 : 8)
      .map(([k, v]) => [k, Math.round(v)] as const),
  ]);
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
