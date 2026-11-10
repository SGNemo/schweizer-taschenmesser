#!/usr/bin/env node
// Measures GitHub Actions for this repository over the REST API (no GraphQL) and prints Markdown tables:
// wait and run time per workflow and job, time from push to green, runner load over the day, steps of the
// most expensive jobs, and waste (docs-only runs, overtaken runs, duplicates).
//
//   node scripts/ci/measure.mjs                      last 200 runs, Markdown on stdout
//   node scripts/ci/measure.mjs --runs 1000 --out /tmp/ci.md --cache /tmp/ci-cache
//   node scripts/ci/measure.mjs --branch ci/cleanup-round-3      only runs of one branch
//   node scripts/ci/measure.mjs --since 2026-11-10T00:00:00Z --logs 5 --json /tmp/ci.json
//   node scripts/ci/measure.mjs --tests 150         also read job logs: failed and retried tests by file:line
//
// Needs `gh` (logged in); without `gh` on the PATH it uses GITHUB_TOKEN. Read-only: it only sends GET requests. Node built-ins only.
// How to read the numbers: docs/perf/CI-2026-11.md; mentioned in docs/HOW-TO.md.
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);
const argv = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? fallback : (argv[i + 1] ?? fallback);
};
if (argv.includes("--help")) {
  console.log(
    readFileSync(new URL(import.meta.url), "utf8")
      .split("\n")
      .slice(1, 13)
      .join("\n"),
  );
  process.exit(0);
}
const REPO = opt(
  "repo",
  process.env.GITHUB_REPOSITORY || "SGNemo/schweizer-taschenmesser",
);
const MAX_RUNS = Number(opt("runs", 200));
const SINCE = opt("since", "");
const UNTIL = opt("until", "");
const BRANCH = opt("branch", "");
const OUT = opt("out", "");
const CACHE = opt("cache", "");
const JSON_OUT = opt("json", ""); // the measured runs with their jobs and steps, for a closer look
const LOG_SAMPLES = Number(opt("logs", 3));
const TOP = Number(opt("top", 3));
const TEST_LOGS = Number(opt("tests", 0)); // logs of this many green E2E jobs (plus every red test job) to read
const RUNNER_LIMIT = Number(opt("limit", 20)); // concurrent jobs of the account (GitHub Free: 20)

// ---------- REST access (gh if present, else fetch with GITHUB_TOKEN), optional disk cache ----------
if (CACHE) mkdirSync(CACHE, { recursive: true });
let calls = 0;
const HAS_GH = await run("gh", ["--version"]).then(
  () => true,
  () => false,
);
async function rest(path, { raw = false, fresh = false } = {}) {
  const file =
    CACHE &&
    join(
      CACHE,
      createHash("sha1").update(path).digest("hex") + (raw ? ".txt" : ".json"),
    );
  if (file && !fresh && existsSync(file)) {
    const text = readFileSync(file, "utf8");
    return raw ? text : JSON.parse(text);
  }
  calls++;
  let text;
  for (let attempt = 1; ; attempt++) {
    try {
      if (!HAS_GH) {
        const res = await fetch(`https://api.github.com/${path}`, {
          headers: {
            authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
            accept: "application/vnd.github+json",
            "x-github-api-version": "2022-11-28",
          },
        });
        if (!res.ok) throw new Error(`${res.status} ${path}`);
        text = await res.text();
      } else {
        text = (
          await run("gh", ["api", path], { maxBuffer: 256 * 1024 * 1024 })
        ).stdout;
      }
      break;
    } catch (error) {
      const message = String(error.stderr || error.message);
      if (/HTTP 40[34]|^40[34] /m.test(message) || attempt === 4)
        throw new Error(`${path}: ${message.trim()}`);
      await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
  }
  if (file) writeFileSync(file, text);
  return raw ? text : JSON.parse(text);
}
async function pool(items, size, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i], i);
      }
    }),
  );
  return out;
}

// ---------- small helpers ----------
const ms = (iso) => (iso ? Date.parse(iso) : NaN);
const minutes = (a, b) => (ms(b) - ms(a)) / 60000;
const quantile = (values, q) => {
  const v = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!v.length) return NaN;
  const pos = (v.length - 1) * q;
  const lo = Math.floor(pos);
  return v[lo] + (v[Math.min(lo + 1, v.length - 1)] - v[lo]) * (pos - lo);
};
const med = (v) => quantile(v, 0.5);
const p90 = (v) => quantile(v, 0.9);
const sum = (v) => v.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0);
const f = (n, digits = 1) => (Number.isFinite(n) ? n.toFixed(digits) : "–");
const pct = (part, whole) =>
  whole ? `${Math.round((100 * part) / whole)} %` : "–";
const table = (head, rows) =>
  rows.length
    ? [
        `| ${head.join(" | ")} |`,
        `|${head.map(() => "---").join("|")}|`,
        ...rows.map((r) => `| ${r.join(" | ")} |`),
      ].join("\n")
    : "_none in this window_";
const groupBy = (items, key) => {
  const map = new Map();
  for (const item of items) {
    const k = key(item);
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(item);
  }
  return map;
};
// "E2E app (smoke, shard 2)" and "Web unit tests (shard 1/3)" become one row per job.
const jobGroup = (name) =>
  name
    .replace(/,? ?shard \d+(\/\d+)?/, ", shard n")
    .replace("(, shard n)", "(shard n)");
const eventClass = (r) => {
  if (r.event === "pull_request") return "PR";
  if (r.event === "push")
    return r.head_branch === "develop"
      ? "develop"
      : r.head_branch === "main"
        ? "main"
        : "push other";
  if (r.event === "workflow_dispatch" || r.event === "schedule")
    return r.head_branch === "develop" || r.head_branch === "main"
      ? "nightly/manual"
      : "full-ci label";
  return r.event;
};
const DOCS_ONLY =
  /^(docs\/|site\/|scribble\/|\.changes\/|CLAUDE\.md$|CONTRIBUTING\.md$|SECURITY\.md$|CHANGELOG(\.de)?\.md$|LICENSE$|\.github\/ISSUE_TEMPLATE\/|\.github\/PULL_REQUEST_TEMPLATE\.md$)/;
const DEVELOP_MERGE =
  /^Merge (remote-tracking )?branch '(origin\/)?develop'|^Merge develop\b/i;
const STEP_KINDS = [
  ["Upload", /upload-artifact|^Upload/i],
  ["Cache", /cache/i],
  ["Checkout", /checkout/i],
  [
    "Install",
    /npm ci|^Install|Download Chromium|System (packages|libraries)|pip install|playwright-chromium|rustup/i,
  ],
  [
    "Setup",
    /Set up job|Complete job|setup-|rust-toolchain|Runner image|Placeholder/i,
  ],
  [
    "Tests",
    /test|e2e|vitest|playwright|clippy|check|lint|fmt|ratchet|Scan|typecheck|budget/i,
  ],
  ["Build", /build|Pack|bundle|Compile|gradle|tauri/i],
];
const stepKind = (name) =>
  (STEP_KINDS.find(([, re]) => re.test(name)) ?? ["Other"])[0];

// ---------- 1. runs and their jobs ----------
const runs = [];
for (let page = 1; runs.length < MAX_RUNS && page <= 50; page++) {
  const query = new URLSearchParams({ per_page: "100", page: String(page) });
  if (BRANCH) query.set("branch", BRANCH);
  if (SINCE || UNTIL) query.set("created", `${SINCE || "*"}..${UNTIL || "*"}`);
  const data = await rest(`repos/${REPO}/actions/runs?${query}`, {
    fresh: true,
  });
  runs.push(...data.workflow_runs);
  if (data.workflow_runs.length < 100) break;
}
runs.length = Math.min(runs.length, MAX_RUNS);
const open = runs.filter((r) => r.status !== "completed").length;
const done = runs.filter((r) => r.status === "completed");
await pool(done, 8, async (r) => {
  const jobs = [];
  for (let page = 1; ; page++) {
    const data = await rest(
      `repos/${REPO}/actions/runs/${r.id}/jobs?filter=all&per_page=100&page=${page}`,
    );
    jobs.push(...data.jobs);
    if (jobs.length >= data.total_count || !data.jobs.length) break;
  }
  r.jobs = jobs.map((j) => ({
    id: j.id,
    name: j.name,
    group: jobGroup(j.name),
    attempt: j.run_attempt ?? 1,
    conclusion: j.conclusion,
    created: j.created_at,
    started: j.started_at,
    completed: j.completed_at,
    // A skipped job never gets a runner: no wait, no run time. "Re-run failed jobs" copies the jobs it does not
    // repeat into the new attempt with a new created_at and the old start and end: those are not counted twice.
    ran:
      j.conclusion !== "skipped" &&
      Boolean(j.started_at && j.completed_at) &&
      (j.steps?.length ?? 0) > 0 &&
      ms(j.started_at) >= ms(j.created_at) - 5000,
    queue: minutes(j.created_at, j.started_at),
    duration: minutes(j.started_at, j.completed_at),
    windows: (j.labels ?? []).some((l) => /windows/i.test(l)),
    steps: (j.steps ?? []).map((s) => ({
      name: s.name,
      kind: stepKind(s.name),
      conclusion: s.conclusion,
      duration: minutes(s.started_at, s.completed_at),
    })),
  }));
  r.cls = eventClass(r);
  r.first = r.jobs.filter((j) => j.attempt === 1);
  r.ranJobs = r.jobs.filter((j) => j.ran);
  r.end = Math.max(...r.ranJobs.map((j) => ms(j.completed)), ms(r.created_at));
  r.runnerMinutes = sum(r.ranJobs.map((j) => j.duration));
  r.developMerge = DEVELOP_MERGE.test(r.head_commit?.message ?? "");
  r.bot = /\[bot\]$/.test(r.actor?.login ?? "") ? r.actor.login : "";
});
const from = done.length
  ? new Date(Math.min(...done.map((r) => ms(r.created_at)))).toISOString()
  : "";
const to = done.length
  ? new Date(Math.max(...done.map((r) => ms(r.created_at)))).toISOString()
  : "";
const hours = done.length ? minutes(from, to) / 60 : 0;

// The run list carries the pull request only while it is open: map branch → pull request from the pulls list.
const allPulls = [];
try {
  for (let page = 1; page <= 3; page++)
    allPulls.push(
      ...(await rest(
        `repos/${REPO}/pulls?state=all&sort=created&direction=desc&per_page=100&page=${page}`,
        { fresh: true },
      )),
    );
} catch {
  /* pulls not readable */
}
const pullOf = (r) =>
  r.pull_requests?.[0]?.number ??
  allPulls.find((p) => p.head.ref === r.head_branch)?.number ??
  "";

const out = [];
const say = (...lines) => out.push(...lines, "");
say(
  `Measured ${done.length} completed runs of \`${REPO}\`${BRANCH ? ` on \`${BRANCH}\`` : ""} (${open} still running were left out), ` +
    `created ${from.slice(0, 16)}Z to ${to.slice(0, 16)}Z (${f(hours)} h). Times in minutes. ` +
    `Wait = job created → runner started; run = started → completed; skipped jobs are not counted.`,
);

// ---------- 2. per workflow ----------
say("### Runs per workflow and event");
say(
  table(
    [
      "Workflow",
      "Event",
      "Runs",
      "Wall median",
      "Wall p90",
      "Runner min / run",
      "Runner min total",
      "Cancelled",
      "Re-run",
      "Failed",
    ],
    [...groupBy(done, (r) => `${r.name}|${r.cls}`)]
      .map(([key, rs]) => {
        const real = rs.filter(
          (r) =>
            r.conclusion !== "cancelled" &&
            r.conclusion !== "skipped" &&
            r.ranJobs.length,
        );
        const wall = real.map((r) => (r.end - ms(r.created_at)) / 60000);
        return [
          sum(rs.map((r) => r.runnerMinutes)),
          [
            ...key.split("|"),
            rs.length,
            f(med(wall)),
            f(p90(wall)),
            f(med(real.map((r) => r.runnerMinutes))),
            f(sum(rs.map((r) => r.runnerMinutes)), 0),
            pct(
              rs.filter((r) => r.conclusion === "cancelled").length,
              rs.length,
            ),
            pct(rs.filter((r) => r.run_attempt > 1).length, rs.length),
            pct(rs.filter((r) => r.conclusion === "failure").length, rs.length),
          ],
        ];
      })
      .sort((a, b) => b[0] - a[0])
      .map(([, row]) => row),
  ),
);

// ---------- 3. per job ----------
// Flake = the job failed in one attempt of a run and succeeded in a later attempt of the same run (same commit).
const allJobs = done.flatMap((r) => r.ranJobs.map((j) => ({ ...j, run: r })));
const jobRows = [
  ...groupBy(allJobs, (j) => `${j.run.name}|${j.group}|${j.run.cls}`),
].map(([key, js]) => {
  const ok = js.filter((j) => j.conclusion === "success");
  const failed = js.filter((j) => j.conclusion === "failure");
  const flaky = failed.filter((j) =>
    j.run.jobs.some(
      (o) =>
        o.name === j.name &&
        o.attempt > j.attempt &&
        o.conclusion === "success",
    ),
  );
  return { key, js, ok, failed, flaky, total: sum(js.map((j) => j.duration)) };
});
say(
  "### Per job (sorted by runner minutes; jobs under 5 runner minutes in total are left out)",
);
say(
  table(
    [
      "Workflow",
      "Job",
      "Event",
      "n",
      "Wait median",
      "Wait p90",
      "Run median",
      "Run p90",
      "Runner min total",
      "Cancelled",
      "Failed",
      "Flaky (red, then green on re-run)",
    ],
    jobRows
      .filter((r) => r.total >= 5)
      .sort((a, b) => b.total - a.total)
      .map((r) => [
        ...r.key.split("|"),
        r.js.length,
        f(med(r.js.map((j) => j.queue))),
        f(p90(r.js.map((j) => j.queue))),
        f(med(r.ok.map((j) => j.duration))),
        f(p90(r.ok.map((j) => j.duration))),
        f(r.total, 0),
        pct(
          r.js.filter((j) => j.conclusion === "cancelled").length,
          r.js.length,
        ),
        pct(r.failed.length, r.js.length),
        r.flaky.length
          ? `${r.flaky.length} (${pct(r.flaky.length, r.js.length)})`
          : "0",
      ]),
  ),
);
const flakes = jobRows.flatMap((r) => r.flaky);
say("### Flaky jobs (failed, then green on a re-run of the same commit)");
say(
  table(
    ["Job", "Workflow", "Run", "Failed step"],
    flakes.map((j) => [
      j.name,
      j.run.name,
      `[${j.run.id}](https://github.com/${REPO}/actions/runs/${j.run.id})`,
      j.steps.find((s) => s.conclusion === "failure")?.name ?? "(see log)",
    ]),
  ),
);

// Tests behind the red and the retried jobs, from the logs (the API has no test names). "Retried" = Playwright's
// "flaky": failed, then passed on the one retry CI allows, so the job stayed green. One request per log.
if (TEST_LOGS > 0) {
  const testJobs = allJobs.filter((j) =>
    /E2E|unit tests|Native shell|Stimulus budget/.test(j.group),
  );
  const red = testJobs.filter(
    (j) =>
      j.conclusion === "failure" &&
      !j.steps.some(
        (s) => s.conclusion === "failure" && /Ratchet/.test(s.name),
      ),
  );
  const greenE2e = testJobs
    .filter((j) => j.conclusion === "success" && /E2E/.test(j.group))
    .slice(0, TEST_LOGS);
  const found = new Map();
  let read = 0;
  await pool([...red, ...greenE2e], 8, async (j) => {
    let log;
    try {
      log = await rest(`repos/${REPO}/actions/jobs/${j.id}/logs`, {
        raw: true,
      });
    } catch {
      return; // expired
    }
    read++;
    const lines = log
      .split("\n")
      .map((l) => l.replace(/^\S+Z /, "").replace(/\x1b\[[0-9;]*m/g, ""));
    const hits = new Set();
    lines.forEach((line, n) => {
      const block = line.match(/^\s*\d+ (flaky|failed)$/);
      if (block) {
        for (let k = n + 1; k < lines.length; k++) {
          const test = lines[k].match(
            /^\s+\[[\w-]+\] › (\S+?):(\d+):\d+ › (.+?)[ ─]*$/,
          );
          if (!test) break;
          hits.add(
            `${block[1] === "flaky" ? "retried" : "failed"}|${test[1].startsWith("e2e/") ? "" : "e2e/"}${test[1]}:${test[2]}|${test[3]}`,
          );
        }
      }
      const unit = line.match(
        /^\s*(?:FAIL|×)\s+(\S+\.(?:test|spec)\.tsx?)\s*>\s*(.*)/,
      );
      if (unit) hits.add(`failed|${unit[1]}|${unit[2].trim()}`);
      const rust = line.match(/^test (\S+) \.\.\. FAILED/);
      if (rust) hits.add(`failed|(Rust)|${rust[1]}`);
    });
    for (const hit of hits) {
      const entry = found.get(hit) ?? {
        n: 0,
        branches: new Set(),
        rerunGreen: 0,
      };
      entry.n++;
      entry.branches.add(j.run.head_branch);
      if (
        j.run.jobs.some(
          (o) =>
            o.name === j.name &&
            o.attempt > j.attempt &&
            o.conclusion === "success",
        )
      )
        entry.rerunGreen++;
      found.set(hit, entry);
    }
  });
  say(
    `### Failed and retried tests (${read} job logs: every red test job, the newest ${greenE2e.length} green E2E jobs)`,
  );
  say(
    "A test that is red on one branch only is usually a real failure of that change; red or retried on several branches, or green on a re-run of the same commit, points to a flake. Line numbers are those of the commit that ran.",
  );
  say(
    table(
      [
        "Test (file:line)",
        "Title",
        "Result",
        "Jobs",
        "Branches",
        "Green on re-run of the same commit",
      ],
      [...found]
        .sort(
          (a, b) => b[1].branches.size - a[1].branches.size || b[1].n - a[1].n,
        )
        .map(([key, e]) => {
          const [kind, file, title] = key.split("|");
          return [
            `\`${file}\``,
            title.slice(0, 90),
            kind,
            e.n,
            e.branches.size,
            e.rerunGreen,
          ];
        }),
    ),
  );
}

// ---------- 4. push to green ----------
// Per pull-request commit: from the first run created for it to the end of the last job of every run of that
// commit (re-runs included). "Green" = every run of the commit ended in success or skipped.
let required = [];
try {
  const rules = await rest(`repos/${REPO}/rules/branches/develop`);
  required = rules
    .filter((r) => r.type === "required_status_checks")
    .flatMap((r) => r.parameters.required_status_checks.map((c) => c.context));
} catch {
  /* not readable with this token: every check of the commit counts */
}
const prRuns = done.filter(
  (r) => r.event === "pull_request" || r.cls === "full-ci label",
);
const commits = [
  ...groupBy(prRuns, (r) => `${r.head_branch}@${r.head_sha}`),
].map(([key, rs]) => {
  const start = Math.min(...rs.map((r) => ms(r.created_at)));
  const jobs = rs.flatMap((r) =>
    r.ranJobs.map((j) => ({ ...j, workflow: r.name })),
  );
  const last =
    [...jobs]
      .sort((a, b) => ms(b.completed) - ms(a.completed))
      .find((j) => j.duration > 0.5) ?? jobs[0];
  const conclusions = new Set(rs.map((r) => r.conclusion));
  return {
    key,
    branch: rs[0].head_branch,
    rs,
    start,
    state: conclusions.has("cancelled")
      ? "overtaken"
      : conclusions.has("failure")
        ? "red"
        : "green",
    toGreen: (Math.max(...rs.map((r) => r.end)) - start) / 60000,
    lastJob: last ? `${last.workflow} / ${last.group}` : "",
    lastQueue: last?.queue ?? NaN,
    maxQueue: Math.max(0, ...jobs.map((j) => j.queue).filter(Number.isFinite)),
    sumQueue: sum(jobs.map((j) => j.queue)),
    rerun: rs.some((r) => r.run_attempt > 1),
    developMerge: rs.some((r) => r.developMerge),
    docsOnly: false,
  };
});
const green = commits.filter((c) => c.state === "green");
say("### Pull requests: from push to green");
say(
  `Required checks from the ruleset on \`develop\`: ${required.length ? required.map((c) => `\`${c}\``).join(", ") : "none readable (or none set), so every check of the commit counts"}.`,
);
say(
  table(
    [
      "",
      "Commits",
      "Push → green median",
      "p90",
      "Wait of the job that finished last, median",
      "p90",
      "Longest wait of any job, median",
      "p90",
    ],
    [
      ["green at first try", green.filter((c) => !c.rerun)],
      ["green after a re-run", green.filter((c) => c.rerun)],
      [
        "red (left red or fixed by a new push)",
        commits.filter((c) => c.state === "red"),
      ],
      [
        "overtaken by a newer push (cancelled)",
        commits.filter((c) => c.state === "overtaken"),
      ],
    ].map(([label, cs]) => [
      label,
      cs.length,
      f(med(cs.map((c) => c.toGreen))),
      f(p90(cs.map((c) => c.toGreen))),
      f(med(cs.map((c) => c.lastQueue))),
      f(p90(cs.map((c) => c.lastQueue))),
      f(med(cs.map((c) => c.maxQueue))),
      f(p90(cs.map((c) => c.maxQueue))),
    ]),
  ),
);
say(
  "Job that finished last on green commits: " +
    ([...groupBy(green, (c) => c.lastJob)]
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 6)
      .map(([name, cs]) => `${name} (${cs.length}×)`)
      .join(", ") || "–") +
    ".",
);
// Per pull request: opened → first green commit, and how many pushes it took.
const pulls = allPulls.filter((p) => ms(p.created_at) >= ms(from));
const byBranch = groupBy(commits, (c) => c.branch);
const prRows = pulls
  .map((p) => {
    const cs = (byBranch.get(p.head.ref) ?? []).sort(
      (a, b) => a.start - b.start,
    );
    const firstGreen = cs.find((c) => c.state === "green");
    return {
      p,
      cs,
      opened: firstGreen
        ? (firstGreen.start + firstGreen.toGreen * 60000 - ms(p.created_at)) /
          60000
        : NaN,
    };
  })
  .filter((r) => r.cs.length);
say(
  `Pull requests opened in the window: ${prRows.length}. Opened → first green: median ${f(med(prRows.map((r) => r.opened)))}, p90 ${f(p90(prRows.map((r) => r.opened)))} ` +
    `(${prRows.filter((r) => Number.isFinite(r.opened)).length} reached green in the window). Pushes per pull request: median ${f(med(prRows.map((r) => r.cs.length)), 0)}, ` +
    `p90 ${f(p90(prRows.map((r) => r.cs.length)), 0)}, max ${Math.max(0, ...prRows.map((r) => r.cs.length))}. ` +
    `Pushes that only merge \`develop\` in: ${commits.filter((c) => c.developMerge).length} of ${commits.length} commits ` +
    `(${f(sum(commits.filter((c) => c.developMerge).flatMap((c) => c.rs.map((r) => r.runnerMinutes))), 0)} runner minutes).`,
);

// ---------- 5. load over the day ----------
const timeline = [];
for (const j of allJobs) {
  timeline.push([ms(j.started), 1, 0], [ms(j.completed), -1, 0]);
  if (j.queue > 0.25)
    timeline.push([ms(j.created), 0, 1], [ms(j.started), 0, -1]);
}
timeline.sort((a, b) => a[0] - b[0] || a[1] + a[2] - (b[1] + b[2]));
const perHour = new Map();
let running = 0;
let queued = 0;
let peak = 0;
let atLimit = 0;
let anyQueued = 0;
let previous = timeline[0]?.[0] ?? 0;
for (const [at, dRun, dQueue] of timeline) {
  if (running >= RUNNER_LIMIT) atLimit += at - previous;
  if (queued > 0) anyQueued += at - previous;
  previous = at;
  running += dRun;
  queued += dQueue;
  peak = Math.max(peak, running);
  const hour = new Date(at).toISOString().slice(0, 13);
  const h = perHour.get(hour) ?? { running: 0, queued: 0 };
  h.running = Math.max(h.running, running);
  h.queued = Math.max(h.queued, queued);
  perHour.set(hour, h);
}
const runsPerHour = groupBy(done, (r) => r.created_at.slice(0, 13));
say("### Runner load over the day (UTC)");
say(
  `Peak ${peak} jobs at once (account limit assumed: ${RUNNER_LIMIT}). At or above the limit for ${f(atLimit / 60000, 0)} min, ` +
    `at least one job waiting longer than 15 s for ${f(anyQueued / 60000, 0)} min of ${f(hours * 60, 0)} min. ` +
    `All jobs together waited ${f(sum(allJobs.map((j) => Math.max(0, j.queue))), 0)} min for a runner and ran ${f(sum(allJobs.map((j) => j.duration)), 0)} min. ` +
    `Jobs that waited more than 1 min: ${allJobs.filter((j) => j.queue > 1).length} of ${allJobs.length}, more than 5 min: ${allJobs.filter((j) => j.queue > 5).length}.`,
);
say(
  table(
    [
      "Hour",
      "Runs started",
      "Pushes (commits)",
      "Max jobs at once",
      "Max jobs waiting",
    ],
    [...perHour]
      .sort()
      .map(([hour, h]) => [
        hour.replace("T", " ") + ":00",
        runsPerHour.get(hour)?.length ?? 0,
        new Set((runsPerHour.get(hour) ?? []).map((r) => r.head_sha)).size,
        h.running,
        h.queued,
      ]),
  ),
);
// A run whose branch got a newer commit while it was still going, and that ran to the end anyway.
const overtaken = [];
for (const rs of groupBy(
  done,
  (r) => `${r.workflow_id}|${r.event}|${r.head_branch}`,
).values()) {
  rs.sort((a, b) => ms(a.created_at) - ms(b.created_at));
  rs.forEach((r, i) => {
    const newer = rs
      .slice(i + 1)
      .find((n) => n.head_sha !== r.head_sha && ms(n.created_at) < r.end);
    if (!newer || r.conclusion === "cancelled" || r.conclusion === "skipped")
      return;
    const wasted = sum(
      r.ranJobs.map((j) =>
        Math.max(
          0,
          (ms(j.completed) - Math.max(ms(j.started), ms(newer.created_at))) /
            60000,
        ),
      ),
    );
    overtaken.push({ r, wasted });
  });
}
say("### Overtaken by a newer push, but not cancelled");
say(
  table(
    ["Workflow", "Event", "Runs", "Runner min after the newer push"],
    [...groupBy(overtaken, (o) => `${o.r.name}|${o.r.cls}`)].map(
      ([key, os]) => [
        ...key.split("|"),
        os.length,
        f(sum(os.map((o) => o.wasted)), 0),
      ],
    ),
  ),
);

// ---------- 6. steps of the most expensive jobs ----------
const expensive = [...groupBy(allJobs, (j) => `${j.run.name}|${j.group}`)]
  .map(([key, js]) => ({ key, js, total: sum(js.map((j) => j.duration)) }))
  .sort((a, b) => b.total - a.total)
  .slice(0, TOP);
say(
  `### Steps of the ${TOP} most expensive jobs (median minutes per successful job)`,
);
const kinds = [
  "Checkout",
  "Setup",
  "Cache",
  "Install",
  "Build",
  "Tests",
  "Upload",
  "Other",
];
const stepRows = [];
const cacheRows = [];
for (const e of expensive) {
  const ok = e.js.filter((j) => j.conclusion === "success");
  const perKind = kinds.map((kind) =>
    f(
      med(
        ok.map((j) =>
          sum(j.steps.filter((s) => s.kind === kind).map((s) => s.duration)),
        ),
      ),
      2,
    ),
  );
  const slow = [
    ...groupBy(
      ok.flatMap((j) => j.steps),
      (s) => s.name,
    ),
  ]
    .map(([name, ss]) => [name, med(ss.map((s) => s.duration))])
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name, m]) => `${name.replace(/@[0-9a-f]{40}/, "")} ${f(m)}`)
    .join("; ");
  stepRows.push([
    e.key.replace("|", " / "),
    ok.length,
    f(e.total, 0),
    ...perKind,
    slow,
  ]);
  // Cache hits are only in the logs: read a few of the newest successful jobs.
  let hit = 0;
  let miss = 0;
  let read = 0;
  for (const j of ok.slice(0, LOG_SAMPLES)) {
    try {
      const log = await rest(`repos/${REPO}/actions/jobs/${j.id}/logs`, {
        raw: true,
      });
      read++;
      hit += (
        log.match(
          /Cache hit for:|Cache restored from key:|cache hit: true|Restored from cache|restored full match: true/gi,
        ) ?? []
      ).length
        ? 1
        : 0;
      miss += (
        log.match(
          /Cache not found|No cache found|cache miss|restored full match: false/gi,
        ) ?? []
      ).length;
    } catch {
      /* logs expired or not readable */
    }
  }
  cacheRows.push([e.key.replace("|", " / "), read, hit, miss]);
}
say(
  table(["Job", "n", "Runner min total", ...kinds, "Slowest steps"], stepRows),
);
say(
  table(
    ["Job", "Logs read", "Jobs with a cache hit", '"Cache not found" lines'],
    cacheRows,
  ),
);

// ---------- 7. waste ----------
// Docs-only: every changed file is documentation, a change note or the notes folder. Pull request = all files
// of the pull request (one request per pull request), push = files of the head commit against its first parent.
const filesOf = new Map();
await pool(
  [
    ...new Set(
      done
        .filter((r) => r.event === "pull_request" || r.event === "push")
        .map((r) =>
          r.event === "push" ? `c:${r.head_sha}` : `p:${pullOf(r)}`,
        ),
    ),
  ],
  6,
  async (key) => {
    if (key === "p:") return;
    try {
      const data = key.startsWith("c:")
        ? (await rest(`repos/${REPO}/commits/${key.slice(2)}`)).files
        : await rest(`repos/${REPO}/pulls/${key.slice(2)}/files?per_page=100`);
      filesOf.set(
        key,
        (data ?? []).map((x) => x.filename),
      );
    } catch {
      /* commit or pull request gone */
    }
  },
);
const docsOnly = (r) => {
  const files = filesOf.get(
    r.event === "push" ? `c:${r.head_sha}` : `p:${pullOf(r)}`,
  );
  return (
    Boolean(files?.length) &&
    files.length < 100 &&
    files.every((x) => DOCS_ONLY.test(x))
  );
};
const wasteRow = (label, rs) => [
  label,
  rs.length,
  f(sum(rs.map((r) => r.runnerMinutes)), 0),
  [...groupBy(rs, (r) => r.name)]
    .map(([n, x]) => `${n} ${x.length}`)
    .join(", ") || "–",
];
const pushAndPr = [
  ...groupBy(
    done.filter((r) => r.event === "push" || r.event === "pull_request"),
    (r) => `${r.workflow_id}|${r.head_sha}`,
  ).values(),
]
  .filter((rs) => new Set(rs.map((r) => r.event)).size > 1)
  .flat();
const previewBuilds = done.filter((r) =>
  r.ranJobs.some((j) => /^Dev-Preview build \/ (Windows|Android)/.test(j.name)),
);
const previewMinutes = sum(
  previewBuilds.flatMap((r) =>
    r.ranJobs
      .filter((j) => j.name.startsWith("Dev-Preview"))
      .map((j) => j.duration),
  ),
);
const developPushes = done.filter(
  (r) => r.cls === "develop" && r.name === "CI",
);
say("### Where runner time goes without anyone needing the result");
say(
  table(
    ["What", "Runs", "Runner min", "Workflows"],
    [
      wasteRow(
        "Docs-, notes- or change-note-only change (pull request)",
        done.filter((r) => r.event === "pull_request" && docsOnly(r)),
      ),
      wasteRow(
        "Docs-, notes- or change-note-only change (push)",
        done.filter((r) => r.event === "push" && docsOnly(r)),
      ),
      wasteRow(
        "Same commit, same workflow, started by push and by pull_request",
        pushAndPr,
      ),
      wasteRow(
        "Started by a bot (Dependabot and others)",
        done.filter((r) => r.bot),
      ),
      wasteRow(
        "Cancelled runs (work thrown away)",
        done.filter((r) => r.conclusion === "cancelled"),
      ),
      wasteRow(
        "Runs where every job was skipped",
        done.filter((r) => r.conclusion === "skipped" || !r.ranJobs.length),
      ),
      wasteRow(
        "Pull-request runs of a commit that only merges develop in",
        done.filter((r) => r.event === "pull_request" && r.developMerge),
      ),
      wasteRow(
        "Draft pull requests",
        done.filter(
          (r) =>
            r.event === "pull_request" &&
            allPulls.find((p) => p.head.ref === r.head_branch)?.draft,
        ),
      ),
    ],
  ),
);
say(
  `Dev-Preview: ${previewBuilds.length} builds for ${developPushes.length} CI runs on \`develop\` pushes, ${f(previewMinutes, 0)} runner minutes ` +
    `(${f(previewMinutes / Math.max(1, previewBuilds.length))} per build).`,
);
const total = sum(done.map((r) => r.runnerMinutes));
say(
  `Total: ${f(total, 0)} runner minutes in ${f(hours)} h (${f(total / Math.max(1, hours), 0)} per hour, ` +
    `${f(sum(allJobs.filter((j) => j.windows).map((j) => j.duration)), 0)} of them on Windows). ${calls} API requests.`,
);

if (JSON_OUT)
  writeFileSync(
    JSON_OUT,
    JSON.stringify(
      done.map(
        ({
          id,
          name,
          event,
          cls,
          head_branch,
          head_sha,
          conclusion,
          run_attempt,
          created_at,
          jobs,
        }) => ({
          id,
          name,
          event,
          cls,
          head_branch,
          head_sha,
          conclusion,
          run_attempt,
          created_at,
          jobs,
        }),
      ),
    ),
  );
const text = out.join("\n");
if (OUT) writeFileSync(OUT, text);
else console.log(text);
