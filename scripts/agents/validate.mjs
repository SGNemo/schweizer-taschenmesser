#!/usr/bin/env node
// Offline schema check for the Managed Agents definitions in docs/meta/agents-v3/nemo-*.json.
// Field names and limits follow https://platform.claude.com/docs/en/api/beta/agents/create (2026-11-08);
// no network, no SDK. Usage: node scripts/agents/validate.mjs [dir]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const dir = path.resolve(
  process.argv[2] ?? path.join(here, "../../docs/meta/agents-v3"),
);
const files = fs
  .readdirSync(dir)
  .filter((f) => /^nemo-.*\.json$/.test(f))
  .sort();

const MODELS = new Set([
  "claude-fable-5-1",
  "claude-opus-5-5",
  "claude-sonnet-5-5",
  "claude-haiku-5-5",
]);
const EFFORT = new Set(["low", "medium", "high", "xhigh", "max"]);
const SPEED = new Set(["standard", "fast"]);
const POLICY = new Set(["always_allow", "always_ask", "auto"]);
const TOOLSET = new Set([
  "bash",
  "read",
  "write",
  "edit",
  "glob",
  "grep",
  "web_fetch",
  "web_search",
]);
const TOP = new Set([
  "name",
  "description",
  "model",
  "system",
  "tools",
  "mcp_servers",
  "skills",
  "multiagent",
  "metadata",
  "execution_identity",
]);
const SECRET =
  /(ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-ant-[A-Za-z0-9-]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|xox[abp]-[A-Za-z0-9-]{10,})/;
const PLACEHOLDER =
  /(<token>|<github_token>|ghp_x+|github_pat_x+|REPLACE_ME|TODO_TOKEN)/i;

let problems = 0;
const names = new Set();
function bad(file, msg) {
  problems++;
  console.log(`✗ ${file}: ${msg}`);
}

for (const file of files) {
  const raw = fs.readFileSync(path.join(dir, file), "utf8");
  if (SECRET.test(raw)) bad(file, "looks like a real secret");
  if (PLACEHOLDER.test(raw))
    bad(
      file,
      "placeholder token in file (tokens come from the vault/session, never from the definition)",
    );
  let a;
  try {
    a = JSON.parse(raw);
  } catch (e) {
    bad(file, "invalid JSON: " + e.message);
    continue;
  }
  for (const k of Object.keys(a))
    if (!TOP.has(k)) bad(file, `unknown top-level field "${k}"`);
  // name / description / system
  if (typeof a.name !== "string" || a.name.length < 1 || a.name.length > 256)
    bad(file, "name missing or > 256 chars");
  if (a.name !== file.replace(/\.json$/, ""))
    bad(file, `name "${a.name}" does not match the file name`);
  if (names.has(a.name)) bad(file, "duplicate name");
  names.add(a.name);
  if (
    a.description != null &&
    (typeof a.description !== "string" || a.description.length > 2048)
  )
    bad(file, "description > 2048 chars");
  if (typeof a.system !== "string" || a.system.length < 200)
    bad(file, "system prompt missing or suspiciously short");
  if (a.system.length > 100000) bad(file, "system > 100000 chars");
  if (!a.system.includes("docs/meta/agents-v3/SHARED.md"))
    bad(file, "system does not reference SHARED.md");
  // model
  const m = typeof a.model === "string" ? { id: a.model } : a.model;
  if (!m || !MODELS.has(m.id))
    bad(
      file,
      `model id "${m?.id}" not in the allowed set ${[...MODELS].join(", ")}`,
    );
  const eff = typeof m?.effort === "string" ? m.effort : m?.effort?.type;
  if (m?.effort !== undefined && !EFFORT.has(eff))
    bad(file, `effort "${eff}" invalid`);
  if (m?.speed !== undefined && !SPEED.has(m.speed))
    bad(file, `speed "${m.speed}" invalid`);
  if (m?.speed === "fast" && !/opus/.test(m.id))
    bad(file, "speed fast is only offered for Opus models");
  if (
    m?.inference_geo !== undefined &&
    !["us", "global"].includes(m.inference_geo)
  )
    bad(file, "inference_geo must be us|global");
  // mcp servers + toolsets
  const servers = new Map();
  for (const s of a.mcp_servers ?? []) {
    if (s.type !== "url" || !s.name || !s.url)
      bad(file, "mcp_servers entry needs type=url, name, url");
    if (s.authorization_token || s.token || s.headers)
      bad(file, `mcp server "${s.name}" carries credentials (use the vault)`);
    if (servers.has(s.name)) bad(file, `duplicate mcp server name "${s.name}"`);
    servers.set(s.name, false);
  }
  if ((a.mcp_servers ?? []).length > 20) bad(file, "more than 20 mcp servers");
  if (!Array.isArray(a.tools) || a.tools.length === 0)
    bad(file, "tools missing");
  let hasToolset = false;
  for (const t of a.tools ?? []) {
    const checkCfg = (c, where, known) => {
      if (c.permission_policy && !POLICY.has(c.permission_policy.type))
        bad(
          file,
          `${where}: permission_policy "${c.permission_policy.type}" invalid`,
        );
      if (c.enabled !== undefined && typeof c.enabled !== "boolean")
        bad(file, `${where}: enabled must be boolean`);
      if (known && c.name && !known.has(c.name))
        bad(file, `${where}: unknown tool "${c.name}"`);
    };
    if (t.type === "agent_toolset_20260401") {
      hasToolset = true;
      if (t.default_config)
        checkCfg(t.default_config, "agent toolset default_config");
      for (const c of t.configs ?? [])
        checkCfg(c, "agent toolset config", TOOLSET);
      const pol = t.default_config?.permission_policy?.type ?? "always_allow";
      if (pol !== "always_allow")
        console.log(
          `  note ${file}: agent toolset policy ${pol} – the session runner must answer requires_action`,
        );
    } else if (t.type === "mcp_toolset") {
      if (!servers.has(t.mcp_server_name))
        bad(
          file,
          `mcp_toolset references undeclared server "${t.mcp_server_name}"`,
        );
      else servers.set(t.mcp_server_name, true);
      if (t.default_config) checkCfg(t.default_config, "mcp default_config");
      for (const c of t.configs ?? []) {
        if (!c.name) bad(file, "mcp config without name");
        if (c.type) bad(file, 'mcp config entries take no "type"');
        checkCfg(c, `mcp config ${c.name}`);
      }
      const pol = t.default_config?.permission_policy?.type ?? "always_ask";
      if (pol === "always_ask")
        console.log(
          `  note ${file}: mcp toolset defaults to always_ask – sessions will pause on every GitHub call`,
        );
    } else if (t.type === "custom") {
      if (
        !/^[a-zA-Z0-9_-]{1,128}$/.test(t.name ?? "") ||
        /^(mcp__|ant__)/.test(t.name)
      )
        bad(file, `custom tool name "${t.name}" invalid`);
    } else bad(file, `unknown tool type "${t.type}"`);
  }
  if (!hasToolset) bad(file, "agent_toolset_20260401 missing (no bash/files)");
  for (const [n, used] of servers)
    if (!used)
      bad(file, `mcp server "${n}" has no mcp_toolset (API rejects it)`);
  // skills
  for (const s of a.skills ?? []) {
    if (!["anthropic", "custom"].includes(s.type) || !s.skill_id)
      bad(file, "skills entry needs type anthropic|custom and skill_id");
    if (s.type === "custom" && !/^skill_/.test(s.skill_id))
      bad(
        file,
        `custom skill_id "${s.skill_id}" should be a skill_… id (to-ant.mjs maps repo paths)`,
      );
  }
  // metadata
  const md = a.metadata ?? {};
  if (Object.keys(md).length > 16) bad(file, "metadata > 16 keys");
  for (const [k, v] of Object.entries(md))
    if (k.length > 64 || String(v).length > 512)
      bad(file, `metadata "${k}" too long`);
  // multiagent: only the lead, one level, ≤ 20, inline off → predefined required, workflows explicit
  if (a.multiagent) {
    if (a.name !== "nemo-lead")
      bad(
        file,
        "only nemo-lead may carry a multiagent block (delegation is one level deep)",
      );
    const ma = a.multiagent;
    if (ma.type !== "multiagent_20261001")
      bad(file, `multiagent.type "${ma.type}" unexpected`);
    const sub = ma.subagents;
    if (sub?.type !== "enabled")
      bad(file, "multiagent.subagents must be enabled");
    const pre = sub?.predefined_agents ?? [];
    if (pre.length < 1 || pre.length > 20)
      bad(file, `predefined_agents must hold 1–20 entries (has ${pre.length})`);
    if (sub?.inline_agents?.type === "disabled" && pre.length === 0)
      bad(file, "inline_agents disabled needs ≥ 1 predefined agent");
    const others = files
      .map((f) => f.replace(/\.json$/, ""))
      .filter((n) => n !== "nemo-lead");
    for (const p of pre) {
      const ref = typeof p === "string" ? p : p.id;
      if (!others.includes(ref) && !/^agent_/.test(ref))
        bad(
          file,
          `predefined agent "${ref}" is neither a sibling file nor an agent_ id`,
        );
    }
    for (const n of others)
      if (!pre.some((p) => (typeof p === "string" ? p : p.id) === n))
        bad(file, `subagent ${n} missing from the lead's roster`);
    if (ma.workflows && !["enabled", "disabled"].includes(ma.workflows.type))
      bad(file, "multiagent.workflows must be enabled|disabled");
    if (!ma.workflows || ma.workflows.type === "enabled")
      console.log(
        `  note ${file}: workflows enabled – the lead may start workflow runs (cost: own threads, 24 h lifetime)`,
      );
    if (ma.advisor && ma.advisor.type === "enabled" && !ma.advisor.model)
      bad(file, "advisor enabled needs a model");
  } else if (a.name === "nemo-lead")
    bad(
      file,
      "nemo-lead has no multiagent block – it would do everything itself",
    );
  // inference_geo must agree across the roster (all unset or all equal)
}
const geos = new Set(
  files.map((f) => {
    const a = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
    return (
      (typeof a.model === "object" ? a.model.inference_geo : undefined) ??
      "(unset)"
    );
  }),
);
if (geos.size > 1) {
  problems++;
  console.log(
    `✗ inference_geo differs across agents: ${[...geos].join(", ")} (coordinator and subagents must match)`,
  );
}

console.log(
  problems === 0
    ? `✓ ${files.length} agent definitions valid (${dir})`
    : `${problems} problem(s) in ${files.length} files`,
);
process.exit(problems === 0 ? 0 : 1);
