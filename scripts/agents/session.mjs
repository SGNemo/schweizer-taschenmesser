#!/usr/bin/env node
// Nemo agent team – everyday runner for a Managed Agents session (lead + environment + repo mount + budget).
// Streams events to the console, sends Sven's message, answers permission prompts on request. After the primary
// thread ends its turn it keeps listening while child threads still run (checks threads every 30 s) and stops only
// when the primary thread ends its turn again after the last child report; --no-wait stops at the first end_turn.
//
//   node scripts/agents/session.mjs --routing-check                       the decision tree (five questions), no session
//   node scripts/agents/session.mjs "Routing: Lead, S (5 USD) · PR #560 · done means: merged or one sentence why not"
//   node scripts/agents/session.mjs --class M --file brief.md
//   node scripts/agents/session.mjs "Routing: Auditor, M (10 USD) · PR #535 · done means …"   the line picks the auditor
//   node scripts/agents/session.mjs --session sess_… "Nachfrage …"        resume an existing session
//   node scripts/agents/session.mjs --session sess_… --auto-approve       approve waiting tool calls, keep streaming
//   node scripts/agents/session.mjs budget sess_… 12 --yes                raise the cap (prints usage so far; without --yes it stops)
//   node scripts/agents/session.mjs threads sess_… [--archive-idle]       threads with tokens/cost, free slots
//   node scripts/agents/session.mjs interrupt sess_…
//   node scripts/agents/session.mjs --dry-run …                           print the request, no network
//
// Budget (docs/meta/WORK-ROUTING.md): the class sets it (S 5, M 10, L 15 USD) – --class, else a leading `Routing: Lead, M …`
// line in the message, else the smallest class holding --budget, else S; --budget <USD> overrides the amount,
// above 15 USD only with --yes-expensive. The first message starts with a routing header (class + budget) that the lead
// checks. A warning is printed at 70 % of the budget, and every run ends with a cost line (primary / children / advisor,
// class). Rule: when a budget runs out, do not raise it – start a new session (SETUP.md §4 "Was kostet was").
//
// Configuration (env or flags): ANTHROPIC_API_KEY, GITHUB_TOKEN (repo mounts only, sent only to the Nemo repo and the
// private notes repo SGNemo/nemo-scribble, mounted as a second resource; --no-scribble leaves it out),
// NEMO_LEAD_AGENT_ID / NEMO_ENV_ID / NEMO_VAULT_ID (or --agent/--env/--vault; defaults read from claude-lock.json).
// --agent takes `lead` (default), `auditor` (resolved via claude-lock.json) or an agent_… id.
// Requires `npm i` in scripts/agents (@anthropic-ai/sdk 1.6.0, pinned; the SDK adds the managed-agents-2026-04-01 beta header).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(here, "../..");
const DEFAULTS = {
  repo: "https://github.com/SGNemo/schweizer-taschenmesser",
  mount: "/workspace/schweizer-taschenmesser",
  checkout: "develop",
  // Private notes repo (scribble), second mount; the same token, nothing else gets it.
  scribbleRepo: "https://github.com/SGNemo/nemo-scribble",
  scribbleMount: "/workspace/nemo-scribble",
  scribbleCheckout: "main",
  lock: path.join(REPO_ROOT, "claude-lock.json"),
  leadFile: "docs/meta/agents-v3/nemo-lead.md",
  auditorFile: "docs/meta/agents-v3/nemo-auditor.md",
  envFile: "docs/meta/agents-v3/environment.yaml",
};

// ---------- args ----------
const argv = process.argv.slice(2);
const flags = {};
const positional = [];
const boolFlags = new Set([
  "dry-run",
  "auto-approve",
  "archive-idle",
  "verbose",
  "help",
  "no-vault",
  "no-wait",
  "no-scribble",
  "yes",
  "yes-expensive",
  "routing-check",
]);
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a.startsWith("--")) {
    const k = a.slice(2);
    flags[k] = boolFlags.has(k) ? true : argv[++i];
  } else positional.push(a);
}
// --routing-check prints the decision tree straight from docs/meta/WORK-ROUTING.md (the one source) and exits before
// anything needs a key, a lock file or the SDK
if (flags["routing-check"]) {
  const routing = path.join(REPO_ROOT, "docs/meta/WORK-ROUTING.md");
  const md = fs.readFileSync(routing, "utf8");
  const tree = md.slice(
    md.indexOf("## Decision tree"),
    md.indexOf("## Session rules"),
  );
  console.log(
    tree
      .replace(/\*\*/g, "")
      .replace(/^```\n?/gm, "")
      .trimEnd(),
  );
  console.log(
    `\nSource: docs/meta/WORK-ROUTING.md · then: Claude Code → a chat, no session; Lead → node scripts/agents/session.mjs "Routing: Lead, S … · done means …"; Auditor → the same with "Routing: Auditor, M …" (picks --agent auditor). No session was started.`,
  );
  process.exit(0);
}
if (flags.help || (positional.length === 0 && !flags.file && !flags.session)) {
  const lines = fs
    .readFileSync(fileURLToPath(import.meta.url), "utf8")
    .split("\n")
    .slice(1);
  const header = lines.slice(
    0,
    lines.findIndex((l) => !l.startsWith("//")),
  );
  console.log(header.map((l) => l.replace(/^\/\/ ?/, "")).join("\n"));
  process.exit(0);
}
const sub = ["budget", "threads", "interrupt"].includes(positional[0])
  ? positional.shift()
  : null;

function fromLock(fileKey) {
  // claude-lock.json: { resources: { '<path as given to ant apply>': { kind, id, … } } } – match on the normalised path tail
  try {
    const lock = JSON.parse(
      fs.readFileSync(flags.lock ?? DEFAULTS.lock, "utf8"),
    );
    const want = path.normalize(fileKey).replace(/^\.\//, "");
    for (const [k, v] of Object.entries(lock.resources ?? lock)) {
      if (!v || typeof v !== "object" || !v.id) continue;
      const key = path.normalize(k).replace(/^\.\//, "");
      if (key === want || key.endsWith("/" + want) || want.endsWith("/" + key))
        return v.id;
    }
  } catch {
    /* no lockfile yet */
  }
  return undefined;
}
const normUrl = (u) =>
  String(u)
    .trim()
    .replace(/\.git$/, "")
    .replace(/\/+$/, "")
    .toLowerCase();
const repoUrl = flags.repo ?? process.env.NEMO_REPO ?? DEFAULTS.repo;
const foreignRepo = normUrl(repoUrl) !== normUrl(DEFAULTS.repo);
// the message is read once (new session or resume); a missing --file is a clean error, not a stack trace
const messageText = (() => {
  if (sub) return "";
  if (!flags.file) return positional.join(" ");
  try {
    return fs.readFileSync(flags.file, "utf8");
  } catch (e) {
    console.error(`error: --file ${flags.file}: ${e.code ?? e.message}`);
    process.exit(1);
  }
})();
// the pasted first line from docs/meta/WORK-ROUTING.md: `Routing: Claude Code | Lead[ → builder] | Auditor, <S|M|L> …`
const routing = (() => {
  // the first `Routing:` line among the first 5 non-empty lines (a brief may start with a heading); pointer lines
  // such as `Routing: #routing` (PROMPT-TEMPLATES shorthand) are skipped
  const first = messageText
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 5)
    .find((l) => /^Routing:/i.test(l) && !/^Routing:\s*#/i.test(l));
  if (!first) {
    if (!sub && messageText.trim())
      console.warn(
        "warning: no routing line – runs as Lead S; check: node scripts/agents/session.mjs --routing-check",
      );
    return {};
  }
  const m =
    /^Routing:\s*(Claude Code|Lead(?:\s*(?:→|->)\s*[\w-]+)?|Auditor)\b(?:\s*,?\s*([SML])\b)?/i.exec(
      first,
    );
  if (!m) {
    console.warn(
      `warning: routing line not understood (forms: docs/meta/WORK-ROUTING.md): ${first.slice(0, 80)}`,
    );
    return {};
  }
  const who = m[1].toLowerCase();
  if (!who.startsWith("claude") && !m[2] && flags.class === undefined)
    console.warn(
      `warning: routing line has no class – add S|M|L to it or pass --class; the session runs as S unless --budget says more`,
    );
  return {
    role: who.startsWith("claude")
      ? "claude-code"
      : who.startsWith("auditor")
        ? "auditor"
        : "lead",
    cls: m[2]?.toUpperCase(),
    title: first.split(" · ").slice(1).join(" · "),
  };
})();
// --agent: short role name (lead | auditor, with or without `nemo-`) resolved via claude-lock.json, or an agent_… id;
// without --agent the routing line picks the auditor
const AGENT_FILES = { lead: DEFAULTS.leadFile, auditor: DEFAULTS.auditorFile };
const agentRole = (() => {
  if (flags.agent === undefined)
    return routing.role === "auditor" ? "auditor" : "lead";
  const r = String(flags.agent).replace(/^nemo-/, "");
  if (AGENT_FILES[r]) {
    if (routing.role && routing.role !== "claude-code" && routing.role !== r)
      console.warn(
        `warning: --agent ${r} but the routing line names ${routing.role} – the session starts ${r}`,
      );
    return r;
  }
  if (/^agent_/.test(flags.agent)) return null; // explicit id
  console.error(
    `error: --agent "${flags.agent}": use lead, auditor or an agent_… id`,
  );
  process.exit(1);
})();
const agentId =
  agentRole === null
    ? flags.agent
    : agentRole === "lead"
      ? (process.env.NEMO_LEAD_AGENT_ID ?? fromLock(DEFAULTS.leadFile))
      : fromLock(AGENT_FILES[agentRole]);
const cfg = {
  agent: agentId,
  agentLabel: (agentRole ?? "agent").toUpperCase(),
  env: flags.env ?? process.env.NEMO_ENV_ID ?? fromLock(DEFAULTS.envFile),
  // the vault holds the Nemo repo's GitHub credentials: not attached to another --repo unless --vault is explicit
  vault: flags["no-vault"]
    ? undefined
    : (flags.vault ?? (foreignRepo ? undefined : process.env.NEMO_VAULT_ID)),
  repo: repoUrl,
  mount: flags.mount ?? DEFAULTS.mount,
  checkout: flags.checkout ?? DEFAULTS.checkout,
  title: flags.title,
  budgetUsd: flags.budget !== undefined ? Number(flags.budget) : undefined,
  session: flags.session,
  autoApprove: !!flags["auto-approve"],
  verbose: !!flags.verbose,
  dryRun: !!flags["dry-run"],
  noWait: !!flags["no-wait"],
};
const githubToken = process.env.GITHUB_TOKEN;
// the PAT goes to exactly these two repositories (the Nemo repo and the notes repo); any other --repo is mounted without it
const TOKEN_REPOS = new Set(
  [DEFAULTS.repo, DEFAULTS.scribbleRepo].map(normUrl),
);
const tokenFor = (url) =>
  githubToken && TOKEN_REPOS.has(normUrl(url)) ? githubToken : undefined;
const repoToken = tokenFor(cfg.repo);
if (githubToken && !repoToken)
  console.warn(
    `warning: GITHUB_TOKEN is sent only to ${DEFAULTS.repo} and ${DEFAULTS.scribbleRepo}; ${cfg.repo} is mounted without a token${cfg.vault ? " (the vault is attached because --vault was given)" : " and without the vault"}`,
  );
// The notes repo is the second mount of a session for the Nemo repo only: a session for any other --repo
// (including the notes repo itself) never gets it, so the token never reaches a foreign repo through it.
// It is private: without the token the mount would fail, so it is left out then.
const withScribble = !flags["no-scribble"] && !!githubToken && !foreignRepo;
if (
  !flags["no-scribble"] &&
  foreignRepo &&
  normUrl(cfg.repo) !== normUrl(DEFAULTS.scribbleRepo)
)
  console.warn(
    `warning: --repo is not ${DEFAULTS.repo}: the private notes repo is not mounted`,
  );
else if (!flags["no-scribble"] && !githubToken)
  console.warn(
    "warning: no GITHUB_TOKEN – the private notes repo is not mounted (session folder /workspace/scribble only)",
  );

// budget classes (docs/meta/WORK-ROUTING.md): the class names the expected cost of the task and sets the budget
const CLASSES = { S: 5, M: 10, L: 15 };
const DEFAULT_CLASS = "S";
const EXPENSIVE_USD = 15; // above this only with --yes-expensive (above class L: split the task)
const WARN_SHARE = 0.7; // warn once the session has used 70 % of its budget
// class: --class wins; else the routing line's class; else the smallest class that holds --budget; else S
// (subcommands such as `budget` never look at it)
const taskClass = (() => {
  if (sub) return DEFAULT_CLASS;
  if (flags.class !== undefined) {
    const c = String(flags.class).toUpperCase();
    if (!(c in CLASSES)) {
      console.error(`error: --class "${flags.class}": use S, M or L`);
      process.exit(1);
    }
    if (routing.cls && routing.cls !== c)
      console.warn(
        `warning: --class ${c} but the routing line says ${routing.cls} – the session runs as ${c}`,
      );
    return c;
  }
  if (routing.cls) return routing.cls;
  if (flags.budget !== undefined)
    return (
      Object.keys(CLASSES).find((k) => CLASSES[k] >= Number(flags.budget)) ??
      "L"
    );
  return DEFAULT_CLASS;
})();
function checkExpensive(usd) {
  if (usd > EXPENSIVE_USD && !flags["yes-expensive"])
    throw new Error(
      `a budget above ${EXPENSIVE_USD} USD needs --yes-expensive (WORK-ROUTING: above class L means split the task into several sessions)`,
    );
}
const classLine = () => `class ${taskClass} (≤ ${CLASSES[taskClass]} USD)`;
function cents(usd) {
  if (!Number.isFinite(usd) || usd <= 0)
    throw new Error("--budget must be a positive number of US dollars");
  return String(Math.round(usd * 100));
}
function budgetObj(usd) {
  return {
    type: "limit",
    max_list_cost: { amount: cents(usd), currency: "USD" },
  };
}
const userMessage = (text) => ({
  type: "user.message",
  content: [{ type: "text", text }],
});

// ---------- client ----------
async function client() {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  return new Anthropic(); // reads ANTHROPIC_API_KEY
}

const short = (s, n = 160) =>
  (s ?? "").toString().replace(/\s+/g, " ").slice(0, n);
const textOf = (content) =>
  Array.isArray(content)
    ? content
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("\n")
    : "";
const stamp = () => new Date().toISOString().slice(11, 19);

// ---------- usage ----------
const amountCents = (m) =>
  m?.amount !== undefined && m.amount !== null ? Number(m.amount) : undefined;
const usd = (c) => (c === undefined ? "?" : `${(c / 100).toFixed(2)} $`);
const tok = (n) =>
  !n
    ? "0"
    : n >= 1e6
      ? `${(n / 1e6).toFixed(1)}M`
      : n >= 1e3
        ? `${Math.round(n / 1e3)}k`
        : String(n);
// input side = fresh input + cache reads + cache writes (what grows with the context)
const inTokens = (u) =>
  (u?.input_tokens ?? 0) +
  (u?.cache_read_input_tokens ?? 0) +
  (u?.cache_creation?.ephemeral_5m_input_tokens ?? 0) +
  (u?.cache_creation?.ephemeral_1h_input_tokens ?? 0);
const usageText = (u) =>
  u
    ? `${usd(amountCents(u.list_cost))}  in ${tok(inTokens(u))} (cache read ${tok(u.cache_read_input_tokens)})  out ${tok(u.output_tokens)}`
    : "no usage reported";
const threadKind = (th) =>
  th.agent?.type === "advisor"
    ? "advisor"
    : th.parent_thread_id
      ? "child"
      : "primary";
const threadName = (th) =>
  th.agent?.type === "advisor"
    ? `advisor ${th.agent.model ?? ""}`.trim()
    : String(th.agent?.name ?? th.agent?.id ?? th.agent?.type ?? "");

// one line per session: authoritative session total (incl. runtime) + split by primary / children / advisor
// (thread figures are rounded per thread and exclude runtime, so they do not add up exactly)
// a thread from the list carries `usage` once it was idle once; otherwise ask for the single thread
async function threadUsage(c, sessionId, th) {
  if (th.usage) return th.usage;
  try {
    return (
      (await c.beta.sessions.threads.retrieve(th.id, { session_id: sessionId }))
        .usage ?? null
    );
  } catch {
    return null;
  }
}
async function printUsage(c, sessionId, { withClass = false } = {}) {
  try {
    const s = await c.beta.sessions.retrieve(sessionId);
    const split = { primary: 0, child: 0, advisor: 0 };
    let kids = 0;
    let missing = 0;
    let threads = 0;
    for await (const th of c.beta.sessions.threads.list(sessionId)) {
      threads++;
      const k = threadKind(th);
      if (k === "child") kids++;
      const cost = amountCents(
        (await threadUsage(c, sessionId, th))?.list_cost,
      );
      if (cost === undefined) missing++;
      else split[k] += cost;
    }
    const cap = amountCents(s.budget?.max_list_cost);
    const total = amountCents(s.usage?.list_cost);
    const perThread =
      threads > 0 && missing === threads
        ? "  no per-thread cost reported (yet) – the session total above is the figure that counts"
        : `  primary ${usd(split.primary)} · ${kids} child thread(s) ${usd(split.child)}${split.advisor ? ` · advisor ${usd(split.advisor)}` : ""}${missing ? ` · ${missing} thread(s) without cost yet` : ""} (per-thread figures exclude session runtime)`;
    const over =
      withClass && total !== undefined && total > CLASSES[taskClass] * 100
        ? ` – above ${classLine()}: next time split the task or pick a higher class`
        : "";
    console.log(
      `usage ${sessionId}: ${usageText(s.usage)}${cap ? ` · budget ${usd(cap)} (${Math.round(((total ?? 0) / cap) * 100)} %)` : ""}\n${perThread}${withClass ? `\n  ${classLine()}${over}` : ""}`,
    );
    return s;
  } catch (e) {
    console.log(`usage: not available (${e.message ?? e})`);
  }
}

let warned70 = false;
function warnBudget(ev) {
  const used = amountCents(ev.usage?.list_cost);
  const cap = amountCents(ev.budget?.max_list_cost);
  if (warned70 || used === undefined || !cap || used < cap * WARN_SHARE) return;
  warned70 = true;
  console.log(
    `\n${stamp()} WARNING: ${Math.round((used / cap) * 100)} % of the budget used (${usd(used)} of ${usd(cap)}). Let the lead finish this request; for the next one start a new session instead of raising the budget.\n`,
  );
}

function printEvent(ev) {
  const t = ev.type;
  if (t === "event_start" || t === "event_delta" || t?.startsWith("span."))
    return;
  const thread = ev.session_thread_id
    ? ` [${ev.session_thread_id.slice(-6)}]`
    : "";
  switch (t) {
    case "agent.message":
      console.log(
        `\n${stamp()} ${cfg.agentLabel}${thread}:\n${textOf(ev.content)}\n`,
      );
      break;
    case "agent.thinking":
      if (cfg.verbose) console.log(`${stamp()} …thinking`);
      break;
    case "agent.tool_use":
      console.log(
        `${stamp()} tool ${ev.name}${thread}: ${short(JSON.stringify(ev.input))}`,
      );
      break;
    case "agent.mcp_tool_use":
      console.log(
        `${stamp()} mcp ${ev.mcp_server_name}/${ev.name}${thread}: ${short(JSON.stringify(ev.input))}`,
      );
      break;
    case "agent.tool_result":
    case "agent.mcp_tool_result":
      if (cfg.verbose)
        console.log(
          `${stamp()} result${thread}: ${short(textOf(ev.content), 300)}`,
        );
      break;
    case "agent.thread_message_sent":
      console.log(
        `${stamp()} → ${ev.to_agent_name}: ${short(textOf(ev.content), 200)}`,
      );
      break;
    case "agent.thread_message_received":
      console.log(
        `\n${stamp()} ← ${ev.from_agent_name}:\n${textOf(ev.content)}\n`,
      );
      break;
    case "session.thread_created":
      console.log(
        `${stamp()} thread created for ${ev.agent_name} (${ev.session_thread_id})`,
      );
      break;
    case "session.thread_status_idle":
      console.log(`${stamp()} thread idle${thread}: ${ev.stop_reason?.type}`);
      break;
    case "session.usage":
      warnBudget(ev);
      console.log(
        `${stamp()} usage: list cost ${ev.usage?.list_cost?.amount ?? "?"} ${ev.usage?.list_cost?.currency ?? ""} (cents), active ${ev.usage?.active_seconds ?? "?"} s, budget ${ev.budget?.max_list_cost?.amount ?? "none"}`,
      );
      break;
    case "session.error":
      console.log(
        `${stamp()} ERROR ${ev.error?.type}: ${ev.error?.message ?? ""} ${ev.mcp_server_name ?? ""}`,
      );
      break;
    case "session.status_running":
      console.log(`${stamp()} running`);
      break;
    case "session.status_idle":
      console.log(`${stamp()} idle: ${ev.stop_reason?.type}`);
      break;
    case "session.status_terminated":
      console.log(`${stamp()} terminated`);
      break;
    case "session.updated":
      console.log(
        `${stamp()} session updated (budget ${JSON.stringify(ev.budget ?? null)})`,
      );
      break;
    case "user.message":
      break;
    default:
      if (cfg.verbose) console.log(`${stamp()} ${t}`);
  }
}

const approvedIds = new Set(); // a stream may replay the idle event that listPending already handled
async function approve(c, sessionId, allIds) {
  const ids = allIds.filter((id) => !approvedIds.has(id));
  if (!ids.length) return;
  ids.forEach((id) => approvedIds.add(id));
  console.log(
    `${stamp()} approving ${ids.length} tool call(s) (--auto-approve)`,
  );
  await c.beta.sessions.events.send(sessionId, {
    events: ids.map((id) => ({
      type: "user.tool_confirmation",
      tool_use_id: id,
      result: "allow",
    })),
  });
}

// what the session is waiting for right now: status idle, latest idle event only; the waiting tools are listed.
async function listPending(c, sessionId) {
  const current = await c.beta.sessions.retrieve(sessionId);
  let latest = null;
  if (current.status === "idle")
    for await (const ev of c.beta.sessions.events.list(sessionId, {
      types: ["session.status_idle"],
      order: "desc",
      limit: 1,
    })) {
      latest = ev;
      break;
    }
  const pending =
    latest?.stop_reason?.type === "requires_action"
      ? (latest.stop_reason.event_ids ?? [])
      : [];
  if (!pending.length) {
    console.log(
      `${stamp()} nothing waiting for approval (status ${current.status})`,
    );
    return pending;
  }
  const left = new Set(pending);
  for await (const ev of c.beta.sessions.events.list(sessionId, {
    types: ["agent.tool_use", "agent.mcp_tool_use"],
    order: "desc",
  })) {
    if (left.has(ev.id)) {
      console.log(
        `${stamp()} waiting: ${ev.mcp_server_name ? ev.mcp_server_name + "/" : ""}${ev.name} ${short(JSON.stringify(ev.input), 200)}`,
      );
      left.delete(ev.id);
    }
    if (left.size === 0) break;
  }
  return pending;
}

// child threads that are still working (archived ones are done for good)
async function runningChildren(c, sessionId) {
  const names = [];
  for await (const th of c.beta.sessions.threads.list(sessionId))
    if (
      th.parent_thread_id &&
      !th.archived_at &&
      (th.status === "running" || th.status === "rescheduling")
    )
      names.push(
        String(th.agent?.name ?? th.agent?.type ?? th.id).replace(/^nemo-/, ""),
      );
  return names;
}

const POLL_MS = 30_000;
async function streamUntilIdle(c, sessionId, afterOpen) {
  const stream = await c.beta.sessions.events.stream(sessionId);
  // waiting for child threads: poll every 30 s; if every child is done and the session stays idle for two polls
  // (no report woke the primary thread again), stop instead of waiting forever
  let timer = null;
  let lastNote = "";
  let quietPolls = 0;
  let endedQuietly = false;
  let inFlight = false; // one thread check at a time
  let done = false; // set when the stream loop has returned
  let reportThisTurn = false; // a child report reached the primary thread since its last end_turn
  const note = (kids) => {
    const line = `${stamp()} wartet auf ${kids.length} Kind-Thread${kids.length === 1 ? "" : "s"} (${kids.join(", ")})`;
    if (line.slice(9) !== lastNote) console.log(line);
    lastNote = line.slice(9);
  };
  const poll = async () => {
    if (inFlight || done) return;
    inFlight = true;
    try {
      const kids = await runningChildren(c, sessionId);
      if (kids.length) {
        quietPolls = 0;
        return note(kids);
      }
      const s = await c.beta.sessions.retrieve(sessionId);
      if (done) return;
      if (s.status !== "idle") quietPolls = 0;
      else if (++quietPolls >= 2) {
        console.log(
          `${stamp()} all child threads done, the session stayed idle – stopping`,
        );
        endedQuietly = true;
        clearInterval(timer);
        stream.controller.abort();
      }
    } catch (e) {
      console.log(`${stamp()} thread check failed: ${e.message ?? e}`);
    } finally {
      inFlight = false;
    }
  };
  try {
    if (afterOpen) await afterOpen();
    for await (const ev of stream) {
      printEvent(ev);
      if (ev.type === "session.status_running") quietPolls = 0;
      if (ev.type === "agent.thread_message_received") reportThisTurn = true;
      if (ev.type !== "session.status_idle") {
        if (ev.type === "session.status_terminated") return "terminated";
        continue;
      }
      const reason = ev.stop_reason?.type;
      if (reason === "end_turn" && !cfg.noWait) {
        const kids = await runningChildren(c, sessionId);
        const report = reportThisTurn;
        reportThisTurn = false;
        if (kids.length) {
          note(kids);
          if (!timer) timer = setInterval(poll, POLL_MS);
          continue;
        }
        // already waiting and this turn saw no child report: a child may have gone idle before its report
        // woke the lead – the poll's two-quiet-checks rule decides, not this end_turn
        if (timer && !report) continue;
      }
      if (reason === "requires_action") {
        const ids = ev.stop_reason.event_ids ?? [];
        if (cfg.autoApprove) {
          await approve(c, sessionId, ids);
          continue;
        }
        console.log(
          `\nThe session waits for a tool confirmation (${ids.join(", ")}). Run: node scripts/agents/session.mjs --session ${sessionId} --auto-approve   (or answer in the Console: platform.claude.com → Agents → Sessions)`,
        );
        return "requires_action";
      }
      if (reason === "budget_reached") {
        console.log(
          `\nBudget reached. Rule: start a new session for the rest (the lead's last report says where it stopped).\nOnly to let a nearly finished step land: node scripts/agents/session.mjs budget ${sessionId} <USD>  (shows the usage, asks first)`,
        );
        return "budget_reached";
      }
      return reason ?? "idle";
    }
  } catch (e) {
    if (!endedQuietly) throw e;
  } finally {
    done = true;
    clearInterval(timer);
  }
  return endedQuietly ? "end_turn" : "stream_closed";
}

async function main() {
  if (sub === "budget") {
    const [sessionId, usdArg] = positional;
    if (!sessionId || !usdArg)
      throw new Error(
        "usage: budget <session_id> <USD> [--yes] [--yes-expensive]",
      );
    checkExpensive(Number(usdArg));
    if (cfg.dryRun)
      return console.log(
        JSON.stringify(
          { update: sessionId, budget: budgetObj(Number(usdArg)) },
          null,
          2,
        ),
      );
    const c = await client();
    const before = await printUsage(c, sessionId);
    const used = amountCents(before?.usage?.list_cost);
    if (used !== undefined && Number(cents(Number(usdArg))) <= used)
      throw new Error(
        `the new budget must be above the cost so far (${usd(used)})`,
      );
    console.log(
      "Rule (WORK-ROUTING): never raise to keep going – start a new session; raise only to let a nearly finished step land.",
    );
    // raising is never a prompt answer: only --yes on the command line, after the usage above was printed
    if (!flags.yes)
      return console.log(
        `budget unchanged: read the usage above, then re-run with --yes (WORK-ROUTING: a new session is usually the better step)`,
      );
    const s = await c.beta.sessions.update(sessionId, {
      budget: budgetObj(Number(usdArg)),
    });
    console.log(
      `budget of ${s.id} is now ${s.budget?.max_list_cost?.amount} cents (${s.status}); a paused session resumes on its own`,
    );
    return;
  }
  if (sub === "threads") {
    const [sessionId] = positional;
    if (!sessionId)
      throw new Error("usage: threads <session_id> [--archive-idle]");
    if (cfg.dryRun)
      return console.log(
        JSON.stringify(
          { list_threads: sessionId, archive_idle: !!flags["archive-idle"] },
          null,
          2,
        ),
      );
    const c = await client();
    let idle = 0,
      archived = 0;
    for await (const th of c.beta.sessions.threads.list(sessionId)) {
      const child = threadKind(th);
      console.log(
        `${th.id}  ${child.padEnd(7)} ${String(th.status).padEnd(10)} ${threadName(th).padEnd(24)} ${usageText(await threadUsage(c, sessionId, th))}`,
      );
      if (child === "child" && th.status === "idle") {
        idle++;
        if (flags["archive-idle"]) {
          await c.beta.sessions.threads.archive(th.id, {
            session_id: sessionId,
          });
          archived++;
        }
      }
    }
    console.log(
      `${idle} idle child thread(s)${flags["archive-idle"] ? `, ${archived} archived (frees slots under the 25-thread limit; the lead loses follow-up access to them)` : " – add --archive-idle to free slots"}`,
    );
    await printUsage(c, sessionId);
    return;
  }
  if (sub === "interrupt") {
    const [sessionId] = positional;
    if (!sessionId) throw new Error("usage: interrupt <session_id>");
    if (cfg.dryRun)
      return console.log(JSON.stringify({ interrupt: sessionId }, null, 2));
    const c = await client();
    await c.beta.sessions.events.send(sessionId, {
      events: [{ type: "user.interrupt" }],
    });
    console.log(
      "interrupt sent to every thread; the session goes idle, then send a new message to continue",
    );
    return;
  }

  const message = messageText;
  // a task routed to Claude Code never starts a paid session
  if (routing.role === "claude-code" && !cfg.session) {
    console.log(
      "blocked – out of routing: Claude Code task · next: open a Claude Code chat with this prompt (no session was started)",
    );
    return;
  }
  if (!message.trim() && !(cfg.session && cfg.autoApprove))
    throw new Error("no message: pass it as argument or --file <path>");

  if (cfg.session) {
    if (cfg.dryRun)
      return console.log(
        JSON.stringify(
          { resume: cfg.session, message, autoApprove: cfg.autoApprove },
          null,
          2,
        ),
      );
    const c = await client();
    console.log(`resuming ${cfg.session}`);
    // approvals are sent only after the stream is open, so the idle event that follows is never missed
    const pending = cfg.autoApprove ? await listPending(c, cfg.session) : [];
    if (!message.trim() && !pending.length) return;
    const outcome = await streamUntilIdle(c, cfg.session, async () => {
      if (pending.length) await approve(c, cfg.session, pending);
      if (message.trim())
        await c.beta.sessions.events.send(cfg.session, {
          events: [userMessage(message)],
        });
    });
    console.log(`\nsession ${cfg.session} → ${outcome}`);
    await printUsage(c, cfg.session, { withClass: flags.class !== undefined });
    return;
  }

  if (cfg.dryRun && !cfg.agent && agentRole)
    cfg.agent = `<id of ${AGENT_FILES[agentRole]} from claude-lock.json – run ant apply first>`;
  if (cfg.dryRun && !cfg.env)
    cfg.env = `<id of ${DEFAULTS.envFile} from claude-lock.json – run ant apply first>`;
  if (!cfg.agent || !cfg.env)
    throw new Error(
      agentRole === "auditor"
        ? "auditor id or environment id missing: run `ant apply --yes docs/meta/agents-v3/nemo-auditor.md` (claude-lock.json in the repo root), or pass --agent agent_…/--env"
        : `${agentRole ?? "agent"} id and environment id missing: run \`ant apply docs/meta/agents-v3/environment.yaml docs/meta/agents-v3/nemo-*.md\` first (claude-lock.json in the repo root), or pass --agent/--env or set NEMO_LEAD_AGENT_ID/NEMO_ENV_ID`,
    );
  // a budget can only be added when the session is created: always send one (the class sets it, default S = 5 USD)
  if (cfg.budgetUsd === undefined) cfg.budgetUsd = CLASSES[taskClass];
  checkExpensive(cfg.budgetUsd);
  if (cfg.budgetUsd > CLASSES[taskClass])
    console.warn(
      `warning: budget ${cfg.budgetUsd} USD is above ${classLine()} – the lead treats the task as ${taskClass}; pass --class for a bigger task`,
    );
  // routing header: the lead's routing gate reads class and budget from the first line (docs/meta/WORK-ROUTING.md)
  const routed = `[session.mjs] Budget-Klasse ${taskClass} (≤ ${CLASSES[taskClass]} USD) · Session-Budget ${cfg.budgetUsd} USD · Routing: docs/meta/WORK-ROUTING.md\n\n${message}`;
  if (!repoToken)
    console.warn(
      "warning: no GITHUB_TOKEN for the repository – it is cloned without a token; git push will fail",
    );
  if (!cfg.vault)
    console.warn(
      "warning: no vault id (NEMO_VAULT_ID / --vault) – the GitHub MCP server and $GITHUB_TOKEN in the sandbox will be unauthenticated",
    );

  const body = {
    agent: cfg.agent,
    environment_id: cfg.env,
    title:
      cfg.title ??
      `nemo${agentRole === "auditor" ? "-auditor" : ""}: ${short(routing.title || message, 60)}`,
    budget: budgetObj(cfg.budgetUsd),
    resources: [
      {
        type: "github_repository",
        url: cfg.repo,
        mount_path: cfg.mount,
        checkout: { type: "branch", name: cfg.checkout },
        ...(repoToken ? { authorization_token: repoToken } : {}),
      },
      ...(withScribble
        ? [
            {
              type: "github_repository",
              url: DEFAULTS.scribbleRepo,
              mount_path: DEFAULTS.scribbleMount,
              checkout: { type: "branch", name: DEFAULTS.scribbleCheckout },
              authorization_token: tokenFor(DEFAULTS.scribbleRepo),
            },
          ]
        : []),
    ],
    ...(cfg.vault ? { vault_ids: [cfg.vault] } : {}),
    metadata: { team: "nemo", runner: "session.mjs" },
  };
  if (cfg.dryRun) {
    const shown = structuredClone(body);
    for (const r of shown.resources)
      if (r.authorization_token)
        r.authorization_token = "<GITHUB_TOKEN from env>";
    console.log(
      JSON.stringify(
        { create: shown, class: taskClass, first_message: routed },
        null,
        2,
      ),
    );
    return;
  }
  const c = await client();
  const session = await c.beta.sessions.create(body);
  console.log(
    `session ${session.id} created (budget ${body.budget.max_list_cost.amount} cents, checkout ${cfg.checkout}, ${body.resources.length} repo mount(s))`,
  );
  console.log(
    `approve the plan / answer the lead: node scripts/agents/session.mjs --session ${session.id} "…" (a new request = a new session)`,
  );
  const outcome = await streamUntilIdle(c, session.id, () =>
    c.beta.sessions.events.send(session.id, { events: [userMessage(routed)] }),
  );
  console.log(`\nsession ${session.id} → ${outcome}`);
  await printUsage(c, session.id, { withClass: true });
}

main().catch((e) => {
  console.error(`error: ${e.message ?? e}`);
  if (cfg.verbose) console.error(e);
  process.exit(1);
});
