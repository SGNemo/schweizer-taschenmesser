#!/usr/bin/env node
// Nemo agent team – everyday runner for a Managed Agents session (lead + environment + repo mount + budget).
// Streams events to the console, sends Sven's message, answers permission prompts on request. After the primary
// thread ends its turn it keeps listening while child threads still run (checks threads every 30 s) and stops only
// when the primary thread ends its turn again after the last child report; --no-wait stops at the first end_turn.
//
//   node scripts/agents/session.mjs --budget 15 "Starte Paket 2 Website"
//   node scripts/agents/session.mjs --budget 15 --file brief.md
//   node scripts/agents/session.mjs --agent auditor --budget 5 "Prüfe PR #535"   auditor instead of the lead
//   node scripts/agents/session.mjs --session sess_… "Nachfrage …"        resume an existing session
//   node scripts/agents/session.mjs --session sess_… --auto-approve       approve waiting tool calls, keep streaming
//   node scripts/agents/session.mjs budget sess_… 30                      raise the cap to 30 USD
//   node scripts/agents/session.mjs threads sess_… [--archive-idle]       list child threads, free slots
//   node scripts/agents/session.mjs interrupt sess_…
//   node scripts/agents/session.mjs --dry-run …                           print the request, no network
//
// Configuration (env or flags): ANTHROPIC_API_KEY, GITHUB_TOKEN (repo mount only, sent only for the Nemo repo),
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
]);
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a.startsWith("--")) {
    const k = a.slice(2);
    flags[k] = boolFlags.has(k) ? true : argv[++i];
  } else positional.push(a);
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
// --agent: short role name (lead | auditor, with or without `nemo-`) resolved via claude-lock.json, or an agent_… id
const AGENT_FILES = { lead: DEFAULTS.leadFile, auditor: DEFAULTS.auditorFile };
const agentRole = (() => {
  if (flags.agent === undefined) return "lead";
  const r = String(flags.agent).replace(/^nemo-/, "");
  if (AGENT_FILES[r]) return r;
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
// the PAT goes to the Nemo repository only; any other --repo is mounted without it
const repoToken = foreignRepo ? undefined : githubToken;
if (githubToken && !repoToken)
  console.warn(
    `warning: GITHUB_TOKEN is sent only to ${DEFAULTS.repo}; ${cfg.repo} is mounted without a token and without the vault`,
  );

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
function readMessage() {
  if (flags.file) return fs.readFileSync(flags.file, "utf8");
  return positional.join(" ");
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
  const note = (kids) => {
    const line = `${stamp()} wartet auf ${kids.length} Kind-Thread${kids.length === 1 ? "" : "s"} (${kids.join(", ")})`;
    if (line.slice(9) !== lastNote) console.log(line);
    lastNote = line.slice(9);
  };
  const poll = async () => {
    try {
      const kids = await runningChildren(c, sessionId);
      if (kids.length) {
        quietPolls = 0;
        return note(kids);
      }
      const s = await c.beta.sessions.retrieve(sessionId);
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
    }
  };
  try {
    if (afterOpen) await afterOpen();
    for await (const ev of stream) {
      printEvent(ev);
      if (ev.type === "session.status_running") quietPolls = 0;
      if (ev.type !== "session.status_idle") {
        if (ev.type === "session.status_terminated") return "terminated";
        continue;
      }
      const reason = ev.stop_reason?.type;
      if (reason === "end_turn" && !cfg.noWait) {
        const kids = await runningChildren(c, sessionId);
        if (kids.length) {
          note(kids);
          if (!timer) timer = setInterval(poll, POLL_MS);
          continue;
        }
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
          `\nBudget reached. Raise it and the session continues by itself:\n  node scripts/agents/session.mjs budget ${sessionId} <USD>`,
        );
        return "budget_reached";
      }
      return reason ?? "idle";
    }
  } catch (e) {
    if (!endedQuietly) throw e;
  } finally {
    clearInterval(timer);
  }
  return endedQuietly ? "end_turn" : "stream_closed";
}

async function main() {
  if (sub === "budget") {
    const [sessionId, usd] = positional;
    if (!sessionId || !usd) throw new Error("usage: budget <session_id> <USD>");
    if (cfg.dryRun)
      return console.log(
        JSON.stringify(
          { update: sessionId, budget: budgetObj(Number(usd)) },
          null,
          2,
        ),
      );
    const c = await client();
    const s = await c.beta.sessions.update(sessionId, {
      budget: budgetObj(Number(usd)),
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
      const child = th.parent_thread_id ? "child" : "primary";
      console.log(
        `${th.id}  ${child.padEnd(7)} ${String(th.status).padEnd(10)} ${th.agent?.name ?? th.agent?.id ?? th.agent?.type ?? ""}`,
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

  const message = readMessage();
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
    return;
  }

  if (cfg.dryRun && !cfg.agent && agentRole)
    cfg.agent = `<id of ${AGENT_FILES[agentRole]} from claude-lock.json – run ant apply first>`;
  if (!cfg.agent || !cfg.env)
    throw new Error(
      `${agentRole ?? "agent"} id and environment id missing: run \`ant apply docs/meta/agents-v3/environment.yaml docs/meta/agents-v3/nemo-*.md\` first (claude-lock.json in the repo root), or pass --agent/--env or set NEMO_LEAD_AGENT_ID/NEMO_ENV_ID`,
    );
  if (cfg.budgetUsd === undefined)
    throw new Error(
      "--budget <USD> is required: a budget can only be added when the session is created (raise it later with `budget <id> <USD>`)",
    );
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
      `nemo${agentRole === "auditor" ? "-auditor" : ""}: ${short(message, 60)}`,
    budget: budgetObj(cfg.budgetUsd),
    resources: [
      {
        type: "github_repository",
        url: cfg.repo,
        mount_path: cfg.mount,
        checkout: { type: "branch", name: cfg.checkout },
        ...(repoToken ? { authorization_token: repoToken } : {}),
      },
    ],
    ...(cfg.vault ? { vault_ids: [cfg.vault] } : {}),
    metadata: { team: "nemo", runner: "session.mjs" },
  };
  if (cfg.dryRun) {
    const shown = structuredClone(body);
    if (shown.resources[0].authorization_token)
      shown.resources[0].authorization_token = "<GITHUB_TOKEN from env>";
    console.log(
      JSON.stringify({ create: shown, first_message: message }, null, 2),
    );
    return;
  }
  const c = await client();
  const session = await c.beta.sessions.create(body);
  console.log(
    `session ${session.id} created (budget ${body.budget.max_list_cost.amount} cents, checkout ${cfg.checkout})`,
  );
  console.log(
    `resume later: node scripts/agents/session.mjs --session ${session.id} "…"`,
  );
  const outcome = await streamUntilIdle(c, session.id, () =>
    c.beta.sessions.events.send(session.id, { events: [userMessage(message)] }),
  );
  console.log(`\nsession ${session.id} → ${outcome}`);
}

main().catch((e) => {
  console.error(`error: ${e.message ?? e}`);
  if (cfg.verbose) console.error(e);
  process.exit(1);
});
