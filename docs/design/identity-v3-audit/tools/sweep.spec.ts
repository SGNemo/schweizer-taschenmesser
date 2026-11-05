import { mkdirSync, writeFileSync } from "node:fs";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { openToolbox } from "../helpers";
import { bootDev, SEED_TODAY, seedApp } from "../seed/helpers";
import { mockSpotify, seedConnected } from "../spotify-mock";
import { mockWeather, pickWeatherPlace } from "../weather-mock";

/**
 * Identity v3.1 acceptance sweep (docs/design/identity-v3-audit/03-acceptance.md): every module page, overview, library
 * (planner card + detail), settings (landing, a category, the planner's module page), the toolbox panel – 1920 × 1080
 * and 390 × 844, light and dark, seeded and empty – plus the planner checks (Sunday off, ToDo page with the planner on)
 * and the maintainer's screenshot points (phone topbar after a route change, toolbox focus ring, scratch-pad link with
 * the reading aid, sidebar reading aid after switching the active module). Not part of CI. Usage (web/, seeded
 * preview on :4174): SCREENS_DIR=<dir> SWEEP_RUNS=d-light,d-dark,p-light,p-dark SWEEP_PARTS=seed,empty,plan,sven
 *   npx playwright test -c playwright.sweep.config.ts
 */
const OUT = process.env.SCREENS_DIR ?? "test-results/screens/sweep";
const WAIT = Number(process.env.SCREENS_WAIT ?? 900);
const ONLY = process.env.SWEEP_PARTS?.split(",");
const part = (name: string) => !ONLY || ONLY.includes(name);

const MODULES: { id: string; path: string; desktop?: boolean }[] = [
  { id: "calendar", path: `/calendar?view=week&date=${SEED_TODAY}` },
  { id: "planner", path: "/planner" },
  { id: "todos", path: "/todos" },
  { id: "habits", path: "/habits" },
  { id: "timetrack", path: "/timetrack" },
  { id: "weather", path: "/weather" },
  { id: "maps", path: "/maps" },
  { id: "people", path: "/people" },
  { id: "finance", path: "/finance?tab=overview" },
  { id: "invoices", path: "/invoices" },
  { id: "subscriptions", path: "/subscriptions" },
  { id: "budgets", path: "/budgets" },
  { id: "lists", path: "/lists" },
  { id: "pantry", path: "/pantry" },
  { id: "bookmarks", path: "/bookmarks" },
  { id: "notes", path: "/notes" },
  { id: "chat", path: "/chat" },
  { id: "browser", path: "/browser", desktop: true },
  { id: "feeds", path: "/feeds" },
  { id: "mail", path: "/mail", desktop: true },
  { id: "music", path: "/music" },
  { id: "vault", path: "/vault" },
  { id: "accounts", path: "/accounts" },
  { id: "disk", path: "/disk", desktop: true },
  { id: "downloads", path: "/downloads", desktop: true },
];
const SHELL: { id: string; path: string; full?: boolean }[] = [
  { id: "library", path: "/library", full: true },
  { id: "library-planner", path: "/library/planner" },
  { id: "tools", path: "/tools" },
  { id: "settings", path: "/settings" },
  { id: "settings-darstellung", path: "/settings/darstellung" },
  { id: "settings-module-planner", path: "/settings/module/planner" },
];

async function enableModules(page: Page, ids: string[]) {
  await page.evaluate(
    (list) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open("taschenmesser");
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction("_modules", "readwrite");
          for (const id of list)
            tx.objectStore("_modules").put({
              id,
              enabled: true,
              dataPolicy: null,
              createdAt: 1,
              updatedAt: 1,
              deviceId: "screens",
              deletedAt: null,
              _f: {},
            });
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
    ids,
  );
}

async function settle(page: Page, wait = WAIT) {
  await expect(page.locator("main")).toBeVisible();
  const notice = page.getByRole("button", { name: "Schließen", exact: true });
  if (await notice.count()) await notice.first().click();
  await page.waitForTimeout(wait);
}

interface Vp {
  name: string;
  width: number;
  height: number;
  mobile?: boolean;
}
const DESKTOP: Vp = { name: "1920x1080", width: 1920, height: 1080 };
const PHONE: Vp = { name: "390x844", width: 390, height: 844, mobile: true };

async function newContext(
  browser: Parameters<Parameters<typeof test>[2]>[0]["browser"],
  vp: Vp,
  scheme: "light" | "dark",
  seed: boolean,
  local: Record<string, string> = {},
): Promise<{ context: BrowserContext; page: Page }> {
  const desktop = !vp.mobile;
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    isMobile: vp.mobile ?? false,
    hasTouch: vp.mobile ?? false,
    deviceScaleFactor: 1,
    reducedMotion: "reduce",
    colorScheme: scheme,
  });
  const page = await context.newPage();
  await page.route(/^https?:\/\/(?!localhost)/, (route) => route.abort());
  await mockWeather(page);
  await page.addInitScript(
    ([isDesktop, extra]) => {
      localStorage.setItem("tm-show-preview", "1");
      if (isDesktop) localStorage.setItem("__tmPlatformKind", "desktop");
      for (const [k, v] of Object.entries(extra)) localStorage.setItem(k, v);
    },
    [desktop, local] as const,
  );
  await bootDev(page);
  if (seed) await seedApp(page, "medium");
  else {
    await page.goto("/");
    await settle(page);
  }
  const all = MODULES.filter((m) => desktop || !m.desktop).map((m) => m.id);
  await enableModules(page, all);
  if (seed) {
    await pickWeatherPlace(page);
    await mockSpotify(page);
    await seedConnected(page, [
      "show",
      "control",
      "playlists",
      "library",
      "history",
    ]);
  }
  return { context, page };
}

/** Desktop: `main` scrolls, not the document; grow the viewport to the page for a full shot. */
async function fullShot(page: Page, vp: Vp, path: string) {
  if (vp.mobile) {
    await page.screenshot({ path, fullPage: true });
    return;
  }
  const height = await page.evaluate(() => {
    const main = document.getElementById("main");
    return main
      ? Math.min(main.scrollHeight + main.getBoundingClientRect().top, 6000)
      : innerHeight;
  });
  await page.setViewportSize({
    width: vp.width,
    height: Math.max(vp.height, Math.ceil(height)),
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path });
  await page.setViewportSize({ width: vp.width, height: vp.height });
}

async function overflow(page: Page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const main = document.getElementById("main");
    return {
      doc: doc.scrollWidth - doc.clientWidth,
      main: main ? main.scrollWidth - main.clientWidth : 0,
    };
  });
}

async function tour(page: Page, vp: Vp, dir: string, seed: boolean) {
  const desktop = !vp.mobile;
  const facts: Record<string, unknown> = {};
  for (const m of MODULES) {
    if (m.desktop && !desktop) continue;
    await page.goto(m.path);
    await settle(page);
    const frame = page.getByTestId("module-frame");
    if (await frame.count())
      await frame.first().screenshot({ path: `${dir}/head-${m.id}.png` });
    await page.screenshot({ path: `${dir}/page-${m.id}.png` });
    facts[m.id] = {
      overflow: await overflow(page),
      ...(await page.evaluate(() => {
        const f = document.querySelector('[data-testid="module-frame"]');
        return {
          hue: f?.getAttribute("data-hue") ?? null,
          size: f?.getAttribute("data-size") ?? null,
          signature:
            f
              ?.querySelector("[data-signature]")
              ?.getAttribute("data-signature") ?? null,
        };
      })),
    };
  }
  for (const s of SHELL) {
    await page.goto(s.path);
    await settle(page);
    if (s.full) await fullShot(page, vp, `${dir}/page-${s.id}.png`);
    else await page.screenshot({ path: `${dir}/page-${s.id}.png` });
    facts[s.id] = { overflow: await overflow(page) };
  }
  // Library: the planner card on its own.
  await page.goto("/library");
  await settle(page);
  const card = page
    .locator("article, li")
    .filter({ hasText: /^Planer/ })
    .first();
  if (await card.count())
    await card.screenshot({ path: `${dir}/library-card-planner.png` });
  // Toolbox panel.
  await page.goto("/");
  await settle(page);
  const dialog = await openToolbox(page);
  await page.waitForTimeout(WAIT);
  await page.screenshot({ path: `${dir}/toolbox.png` });
  await dialog.screenshot({ path: `${dir}/toolbox-panel.png` });
  await page.keyboard.press("Escape");
  // Overview, every widget.
  await page.evaluate(() => localStorage.setItem("tm-home-view", "all"));
  await page.goto("/");
  await settle(page, WAIT * 3);
  await fullShot(page, vp, `${dir}/overview.png`);
  facts.overview = { overflow: await overflow(page) };
  const items = page.locator('[data-testid^="widget-"]');
  const n = await items.count();
  for (let i = 0; i < n; i++) {
    const el = items.nth(i);
    const tid = (await el.getAttribute("data-testid")) ?? "";
    if (!(await el.isVisible())) continue;
    await el.screenshot({
      path: `${dir}/widget-${tid.replace("widget-", "").replace(":", "-")}.png`,
    });
  }
  writeFileSync(
    `${dir}/facts-${seed ? "seed" : "empty"}.json`,
    JSON.stringify(facts, null, 2),
  );
}

/** Title text goes black, icons go too: the module must be recognised by form and signature (C35 cold re-run). */
const BLIND_CSS = `
[data-testid="module-frame"] h1,
[data-testid="module-frame"] p > span:last-child:not([aria-hidden]),
[data-testid="subnav"] a > span,
[data-testid^="widget-"] h2 a,
[data-testid^="widget-"] h2 { color: transparent !important; background: #000 !important; border-radius: 4px; }
[data-testid="module-frame"] h1 *, [data-testid^="widget-"] h2 * { color: transparent !important; }
[data-testid^="widget-"] h2 svg, [data-testid="module-frame"] p svg { display: none !important; }
`;

test("sweep: blind crops (desktop light + dark)", async ({ browser }) => {
  test.skip(!part("blind"));
  test.setTimeout(0);
  const dir = `${OUT}/blind`;
  mkdirSync(dir, { recursive: true });
  const key: Record<string, string> = {};
  const name = () =>
    Array.from(
      { length: 6 },
      () => "0123456789abcdef"[Math.floor(Math.random() * 16)],
    ).join("");
  for (const scheme of ["light", "dark"] as const) {
    const { context, page } = await newContext(browser, DESKTOP, scheme, true);
    for (const m of MODULES) {
      await page.goto(m.path);
      await settle(page);
      await page.addStyleTag({ content: BLIND_CSS });
      const frame = page.getByTestId("module-frame");
      if (!(await frame.count())) continue;
      const id = name();
      await frame.first().screenshot({ path: `${dir}/${id}.png` });
      key[id] = `head ${m.id} ${scheme}`;
    }
    await page.evaluate(() => localStorage.setItem("tm-home-view", "all"));
    await page.goto("/");
    await settle(page, WAIT * 3);
    await page.addStyleTag({ content: BLIND_CSS });
    const items = page.locator('[data-testid^="widget-"]');
    const n = await items.count();
    for (let i = 0; i < n; i++) {
      const el = items.nth(i);
      const tid = (await el.getAttribute("data-testid")) ?? "";
      if (!(await el.isVisible())) continue;
      const id = name();
      await el.screenshot({ path: `${dir}/${id}.png` });
      key[id] = `widget ${tid.replace("widget-", "")} ${scheme}`;
    }
    await context.close();
  }
  writeFileSync(`${OUT}/blind-key.json`, JSON.stringify(key, null, 2));
});

const RUNS = (process.env.SWEEP_RUNS ?? "d-light,d-dark,p-light,p-dark").split(
  ",",
);

for (const run of RUNS) {
  const [k, scheme] = run.split("-") as ["d" | "p", "light" | "dark"];
  const vp = k === "d" ? DESKTOP : PHONE;

  test(`sweep ${run}: seeded`, async ({ browser }) => {
    test.skip(!part("seed"));
    test.setTimeout(0);
    const dir = `${OUT}/${vp.name}-${scheme}/seed`;
    mkdirSync(dir, { recursive: true });
    const { context, page } = await newContext(browser, vp, scheme, true);
    await tour(page, vp, dir, true);
    await context.close();
  });

  test(`sweep ${run}: empty`, async ({ browser }) => {
    test.skip(!part("empty"));
    test.setTimeout(0);
    const dir = `${OUT}/${vp.name}-${scheme}/empty`;
    mkdirSync(dir, { recursive: true });
    const { context, page } = await newContext(browser, vp, scheme, false);
    await tour(page, vp, dir, false);
    await context.close();
  });

  test(`sweep ${run}: planner checks`, async ({ browser }) => {
    test.skip(!part("plan"));
    test.setTimeout(0);
    const dir = `${OUT}/${vp.name}-${scheme}/plan`;
    mkdirSync(dir, { recursive: true });
    const { context, page } = await newContext(browser, vp, scheme, true);
    const facts: Record<string, unknown> = {};
    await page.goto("/planner");
    await settle(page, WAIT * 2);
    await page.screenshot({ path: `${dir}/planner.png` });
    await fullShot(page, vp, `${dir}/planner-full.png`);
    facts.head = await page
      .getByTestId("planner-head")
      .innerText({ timeout: 3000 })
      .catch(() => null);
    facts.headNumbers = await page
      .getByTestId("module-frame")
      .first()
      .innerText({ timeout: 3000 })
      .then((s) => (s.match(/\d+/g) ?? []).length)
      .catch(() => null);
    facts.rowMeta = await page
      .locator('[data-testid^="day-"] li')
      .evaluateAll((els) =>
        els.slice(0, 12).map((e) => (e as HTMLElement).innerText),
      );
    // ToDo page with the planner on: „im Plan: …“ in Bald, no „Neu planen“, the Heute card.
    for (const view of ["", "?view=soon", "?view=today"]) {
      await page.goto(`/todos${view}`);
      await settle(page);
      await fullShot(
        page,
        vp,
        `${dir}/todos${view.replace("?view=", "-") || ""}.png`,
      );
    }
    facts.todosInPlan = await page.goto("/todos?view=soon").then(() =>
      settle(page).then(() =>
        page
          .getByText(/im Plan: /)
          .allInnerTexts()
          .catch(() => []),
      ),
    );
    facts.todosReplanButtons = await page
      .getByRole("button", { name: /Neu planen/ })
      .count();
    await page.goto("/todos");
    await settle(page);
    facts.todosReplanButtonsMain = await page
      .getByRole("button", { name: /Neu planen/ })
      .count();
    facts.todayCard = await page
      .getByTestId("today-card")
      .innerText({ timeout: 3000 })
      .catch(() => null);
    // The overview: planner widget and the Heute card.
    await page.evaluate(() => localStorage.setItem("tm-home-view", "all"));
    await page.goto("/");
    await settle(page, WAIT * 3);
    for (const sel of [
      "widget-planner:week",
      "widget-todos:today",
      "widget-todos:next",
    ]) {
      const el = page.getByTestId(sel);
      if (await el.count())
        await el
          .first()
          .screenshot({ path: `${dir}/${sel.replace(":", "-")}.png` });
    }
    facts.plannerWidget = await page
      .getByTestId("widget-planner:week")
      .innerText({ timeout: 3000 })
      .catch(() => null);
    // Sunday: „Heute ist frei.“
    await page.clock.setFixedTime(new Date("2026-10-04T10:00:00"));
    await page.goto("/planner");
    await settle(page, WAIT * 2);
    await page.screenshot({ path: `${dir}/planner-sunday.png` });
    facts.sundayHead = await page
      .getByTestId("planner-head")
      .innerText({ timeout: 3000 })
      .catch(() => null);
    writeFileSync(`${dir}/facts.json`, JSON.stringify(facts, null, 2));
    await context.close();
  });

  test(`sweep ${run}: maintainer points`, async ({ browser }) => {
    test.skip(!part("sven"));
    test.setTimeout(0);
    const dir = `${OUT}/${vp.name}-${scheme}/sven`;
    mkdirSync(dir, { recursive: true });
    const { context, page } = await newContext(browser, vp, scheme, true, {
      "tm-read-aid": "1",
      "tm-read-cover": "100",
    });
    const facts: Record<string, unknown> = {};
    // Topbar after a route change (phone): scroll far, follow a link, the bar is there at once.
    if (vp.mobile) {
      await page.goto("/todos");
      await settle(page);
      await page.mouse.wheel(0, 3000);
      await page.evaluate(() => window.scrollTo(0, 3000));
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${dir}/topbar-scrolled.png` });
      await page.goto("/calendar");
      await page.waitForTimeout(150);
      await page.screenshot({ path: `${dir}/topbar-after-route.png` });
      facts.topbar = await page
        .locator("header")
        .first()
        .boundingBox()
        .catch(() => null);
    }
    // Sidebar reading aid after switching the active module (desktop).
    if (!vp.mobile) {
      await page.goto("/todos");
      await settle(page);
      const side = page.getByTestId("sidebar");
      await side
        .getByRole("link", { name: /Kalender/ })
        .first()
        .click();
      await page.waitForTimeout(WAIT);
      await side.screenshot({ path: `${dir}/sidebar-after-switch.png` });
      await side
        .getByRole("link", { name: /Budgets/ })
        .first()
        .click();
      await page.waitForTimeout(WAIT);
      await side.screenshot({ path: `${dir}/sidebar-after-switch-2.png` });
      facts.sidebarActive = await side
        .locator('[aria-current="page"]')
        .evaluateAll((els) =>
          els.map((e) => (e as HTMLElement).innerHTML.slice(0, 400)),
        );
    }
    // Toolbox: focus ring on open and after Tab; the scratch-pad link with the reading aid.
    await page.goto("/");
    await settle(page);
    const dialog = await openToolbox(page);
    await page.waitForTimeout(WAIT);
    await dialog.screenshot({ path: `${dir}/toolbox-open-focus.png` });
    facts.toolboxFocus = await page.evaluate(() => {
      const a = document.activeElement as HTMLElement | null;
      return a
        ? `${a.tagName} ${a.getAttribute("aria-label") ?? a.innerText.slice(0, 40)}`
        : null;
    });
    await page.keyboard.press("Tab");
    await page.waitForTimeout(200);
    await dialog.screenshot({ path: `${dir}/toolbox-tab-focus.png` });
    const scratch = dialog.getByRole("link", { name: /Schmierzettel/ });
    if (await scratch.count()) {
      await scratch.first().screenshot({ path: `${dir}/toolbox-scratch.png` });
      facts.scratch = await scratch.first().evaluate((e) => ({
        text: (e as HTMLElement).innerText,
        height: e.getBoundingClientRect().height,
        hue:
          e.closest("[data-hue]")?.getAttribute("data-hue") ??
          e.getAttribute("data-hue"),
      }));
    }
    await page.keyboard.press("Escape");
    // Module heads Sven named: budgets, bookmarks, chat, todos, calendar, disk – with the reading aid on.
    for (const [id, path] of [
      ["budgets", "/budgets"],
      ["bookmarks", "/bookmarks"],
      ["chat", "/chat"],
      ["todos", "/todos"],
      ["calendar", "/calendar"],
      ["disk", "/disk"],
    ] as const) {
      if (id === "disk" && vp.mobile) continue;
      await page.goto(path);
      await settle(page);
      await page.screenshot({ path: `${dir}/readon-${id}.png` });
    }
    writeFileSync(`${dir}/facts.json`, JSON.stringify(facts, null, 2));
    await context.close();
  });
}

test("sweep: phone topbar after an in-app route change", async ({
  browser,
}) => {
  test.skip(!part("topbar"));
  test.setTimeout(0);
  const dir = `${OUT}/390x844-light/sven`;
  mkdirSync(dir, { recursive: true });
  const { context, page } = await newContext(browser, PHONE, "light", true);
  await page.goto("/todos");
  await settle(page);
  // Scroll far down so the topbar collapses, then change the route inside the app (bottom navigation).
  for (let i = 0; i < 6; i++) await page.mouse.wheel(0, 800);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${dir}/topbar-scrolled.png` });
  const barBefore = await page.locator("header").first().boundingBox();
  await page.getByRole("link", { name: "Geld" }).last().click();
  await page.waitForTimeout(120);
  await page.screenshot({ path: `${dir}/topbar-after-route-120ms.png` });
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${dir}/topbar-after-route.png` });
  const barAfter = await page.locator("header").first().boundingBox();
  writeFileSync(
    `${dir}/topbar.json`,
    JSON.stringify({ barBefore, barAfter, url: page.url() }, null, 2),
  );
  await context.close();
});
