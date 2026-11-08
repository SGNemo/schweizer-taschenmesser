#!/usr/bin/env node
// Offline schema check for the Managed Agents definitions in docs/meta/agents-v3/nemo-*.json.
// Field names and limits follow https://platform.claude.com/docs/en/api/beta/agents/create and the
// @anthropic-ai/sdk 1.6 Params types (2026-11-08); no network, no SDK. Usage: node scripts/agents/validate.mjs [dir]
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
const TOP = [
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
];
// nested key whitelists
const KEYS = {
  model: ["id", "effort", "speed", "inference_geo"],
  effort: ["type"],
  mcp_server: ["type", "name", "url"],
  toolset: ["type", "configs", "default_config"],
  mcp_toolset: ["type", "mcp_server_name", "configs", "default_config"],
  custom_tool: ["type", "name", "description", "input_schema"],
  config: [
    "name",
    "type",
    "enabled",
    "permission_policy",
    "allowed_domains",
    "blocked_domains",
    "max_content_tokens",
    "url_sources",
    "user_location",
  ],
  mcp_config: ["name", "enabled", "permission_policy"],
  default_config: ["enabled", "permission_policy"],
  permission_policy: ["type"],
  skill: ["type", "skill_id", "version"],
  multiagent: ["type", "subagents", "workflows", "advisor"],
  subagents: ["type", "inline_agents", "predefined_agents"],
  inline_agents: ["type"],
  advisor: ["type", "model"],
  predefined: ["type", "id", "version"],
};
// GitHub MCP policy (tool names as the remote server reports them): off for every role / merge only for nemo-merge
const GH_OFF_ALL = [
  "enable_pr_auto_merge",
  "disable_pr_auto_merge",
  "actions_run_trigger",
  "push_files",
  "create_or_update_file",
  "delete_file",
];
const SECRET =
  /(ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-ant-[A-Za-z0-9-]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|xox[abp]-[A-Za-z0-9-]{10,})/;
const PLACEHOLDER =
  /(<token>|<github_token>|ghp_x+|github_pat_x+|REPLACE_ME|TODO_TOKEN)/i;

// coordinators: exactly these carry a multiagent block; delegation is one level deep (an agent with multiagent
// cannot be anyone's subagent – the API answers 400), so neither may appear in any predefined_agents list
const COORDINATORS = ["nemo-auditor", "nemo-lead"];
// per-coordinator roster exclusions: these agents must NOT be in that coordinator's lists. The auditor never reaches
// nemo-merge, so a manipulated audit cannot message the only merging agent (security finding on PR #537)
const ROSTER_EXCLUDE = { "nemo-auditor": ["nemo-merge"] };
// the five hard limits are one template for every agent except the lead; role name, the merge line (nemo-merge only)
// and the read-only clause (review roles + auditor) are the per-role parts, each checked exactly
const READ_ONLY = new Set([
  "nemo-po",
  "nemo-creativity",
  "nemo-design",
  "nemo-a11y",
  "nemo-security",
  "nemo-reviewer",
  "nemo-auditor",
]);
// the auditor also copies its report to the session outputs (Sven downloads it from there)
const READ_ONLY_EXTRA = {
  "nemo-auditor": " and the report copy in `/mnt/session/outputs/`",
};
const MERGE_LINE = {
  merge:
    "- You are the only agent that merges, and only into `develop` per your six merge-ready rules (merge commit, `expectedHeadSha`); never auto-merge, never a direct push to `develop`/`main`, never over a red check or a missing MERGE-READY.",
  other:
    "- Only `nemo-merge` merges; you never merge, enable auto-merge or push to `develop`/`main`.",
};
function hardLimitsOf(a) {
  const i = a.system.indexOf("## Hard limits");
  if (i < 0) return null;
  const role = a.name.replace("nemo-", "");
  const expect =
    (a.name === "nemo-merge" ? MERGE_LINE.merge : MERGE_LINE.other) +
    (READ_ONLY.has(a.name)
      ? ` You are read-only: no commits, no pushes, no edits outside \`/workspace/wt-${role}-notes/\`${READ_ONLY_EXTRA[a.name] ?? ""}, except your own scribble notes (SHARED.md "Scribble").`
      : "");
  const block = a.system.slice(i);
  if (!block.includes(expect + "\n"))
    return {
      error:
        "merge/read-only line of the hard limits is not the expected one for this role",
    };
  return {
    norm: block
      .replace(expect, "- MERGE-LINE")
      .replace(new RegExp(`wt-${role}`, "g"), "wt-ROLE"),
  };
}

let problems = 0;
const names = new Set();
let hardRef = null;
const hardBlocks = [];
const mergeCapable = [];
const withMultiagent = [];
function bad(file, msg) {
  problems++;
  console.log(`✗ ${file}: ${msg}`);
}
function keys(file, obj, kind, where) {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return;
  for (const k of Object.keys(obj))
    if (!KEYS[kind].includes(k))
      bad(
        file,
        `${where}: unknown field "${k}" (allowed: ${KEYS[kind].join(", ")})`,
      );
}
const refOf = (p) =>
  typeof p === "string" ? p : p?.type === "self" ? "self" : p?.id;

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
    if (!TOP.includes(k)) bad(file, `unknown top-level field "${k}"`);
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
  if (typeof a.system !== "string" || a.system.length < 200) {
    bad(file, "system prompt missing or suspiciously short");
    continue;
  }
  if (a.system.length > 100000) bad(file, "system > 100000 chars");
  if (!a.system.includes("docs/meta/agents-v3/SHARED.md"))
    bad(file, "system does not reference SHARED.md");
  if (a.name !== "nemo-lead") {
    const hl = hardLimitsOf(a);
    if (!hl) bad(file, 'no "## Hard limits" block');
    else if (hl.error) bad(file, hl.error);
    else if (file === "nemo-qa.json")
      hardRef = { file, hl: hl.norm }; // fixed template file, compared after the loop
    else hardBlocks.push({ file, hl: hl.norm });
  }
  // model
  const m = typeof a.model === "string" ? { id: a.model } : a.model;
  keys(file, m, "model", "model");
  if (m?.effort && typeof m.effort === "object")
    keys(file, m.effort, "effort", "model.effort");
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
  const githubServers = new Set();
  for (const s of a.mcp_servers ?? []) {
    keys(file, s, "mcp_server", `mcp server ${s.name}`);
    if (s.type !== "url" || !s.name || !s.url)
      bad(file, "mcp_servers entry needs type=url, name, url");
    if (servers.has(s.name)) bad(file, `duplicate mcp server name "${s.name}"`);
    servers.set(s.name, false);
    if (
      /(^|\.)githubcopilot\.com$/.test(
        (() => {
          try {
            return new URL(s.url).hostname;
          } catch {
            return "";
          }
        })(),
      )
    )
      githubServers.add(s.name);
  }
  if ((a.mcp_servers ?? []).length > 20) bad(file, "more than 20 mcp servers");
  if (!Array.isArray(a.tools) || a.tools.length === 0)
    bad(file, "tools missing");
  if ((a.tools ?? []).length > 256) bad(file, "more than 256 tools");
  let toolset = null;
  for (const t of a.tools ?? []) {
    const checkCfg = (c, where, known, kind = "config") => {
      keys(file, c, kind, where);
      if (c.permission_policy)
        keys(
          file,
          c.permission_policy,
          "permission_policy",
          `${where}.permission_policy`,
        );
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
      toolset = t;
      keys(file, t, "toolset", "agent toolset");
      if (t.default_config)
        checkCfg(
          t.default_config,
          "agent toolset default_config",
          undefined,
          "default_config",
        );
      for (const c of t.configs ?? [])
        checkCfg(c, `agent toolset config ${c.name}`, TOOLSET);
      const pol = t.default_config?.permission_policy?.type ?? "always_allow";
      if (pol !== "always_allow")
        console.log(
          `  note ${file}: agent toolset policy ${pol} – the session runner must answer requires_action`,
        );
    } else if (t.type === "mcp_toolset") {
      keys(file, t, "mcp_toolset", "mcp toolset");
      if (!servers.has(t.mcp_server_name))
        bad(
          file,
          `mcp_toolset references undeclared server "${t.mcp_server_name}"`,
        );
      else servers.set(t.mcp_server_name, true);
      if (t.default_config)
        checkCfg(
          t.default_config,
          "mcp default_config",
          undefined,
          "default_config",
        );
      const cfgNames = new Set();
      for (const c of t.configs ?? []) {
        if (cfgNames.has(c.name))
          bad(file, `mcp config "${c.name}" listed twice`);
        cfgNames.add(c.name);
      }
      for (const c of t.configs ?? []) {
        if (!c.name) bad(file, "mcp config without name");
        checkCfg(c, `mcp config ${c.name}`, undefined, "mcp_config");
      }
      const pol = t.default_config?.permission_policy?.type ?? "always_ask";
      if (pol === "always_ask")
        console.log(
          `  note ${file}: mcp toolset defaults to always_ask – sessions will pause on every GitHub call`,
        );
      if (githubServers.has(t.mcp_server_name)) {
        const off = new Set(
          (t.configs ?? [])
            .filter((c) => c.enabled === false)
            .map((c) => c.name),
        );
        for (const n of GH_OFF_ALL)
          if (!off.has(n))
            bad(file, `github tool "${n}" must be disabled for every role`);
        if (!off.has("merge_pull_request")) mergeCapable.push(a.name);
      }
    } else if (t.type === "custom") {
      keys(file, t, "custom_tool", `custom tool ${t.name}`);
      if (
        !/^[a-zA-Z0-9_-]{1,128}$/.test(t.name ?? "") ||
        /^(mcp__|ant__)/.test(t.name)
      )
        bad(file, `custom tool name "${t.name}" invalid`);
    } else bad(file, `unknown tool type "${t.type}"`);
  }
  if (!toolset) bad(file, "agent_toolset_20260401 missing (no bash/files)");
  for (const w of ["web_search", "web_fetch"])
    if (
      !(toolset?.configs ?? []).some((c) => c.name === w && c.enabled === false)
    )
      bad(
        file,
        `${w} must be disabled (limited networking; MODELS.md states it)`,
      );
  for (const [n, used] of servers)
    if (!used)
      bad(file, `mcp server "${n}" has no mcp_toolset (API rejects it)`);
  // skills
  for (const s of a.skills ?? []) {
    keys(file, s, "skill", "skills entry");
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
  // multiagent: only the coordinators, one level, ≤ 20 distinct, inline off → predefined required, workflows explicit
  if (a.multiagent) {
    withMultiagent.push(a.name);
    if (!COORDINATORS.includes(a.name))
      bad(
        file,
        `only ${COORDINATORS.join(" and ")} may carry a multiagent block (delegation is one level deep)`,
      );
    const ma = a.multiagent;
    keys(file, ma, "multiagent", "multiagent");
    keys(file, ma.subagents, "subagents", "multiagent.subagents");
    keys(file, ma.workflows, "subagents", "multiagent.workflows");
    keys(file, ma.advisor, "advisor", "multiagent.advisor");
    if (ma.subagents?.inline_agents)
      keys(
        file,
        ma.subagents.inline_agents,
        "inline_agents",
        "multiagent.subagents.inline_agents",
      );
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
    // every coordinator's roster = all agents that are not coordinators, minus its ROSTER_EXCLUDE entries
    // (lead: all 19; auditor: 18, nemo-merge excluded)
    const others = files
      .map((f) => f.replace(/\.json$/, ""))
      .filter((n) => !COORDINATORS.includes(n));
    const excluded = ROSTER_EXCLUDE[a.name] ?? [];
    for (const n of excluded)
      if (!others.includes(n))
        bad(file, `roster exclusion "${n}" is not a sibling subagent file`);
    const roster = (list, where) => {
      const seen = new Set();
      for (const p of list) {
        if (typeof p === "object") {
          keys(file, p, "predefined", `${where} entry`);
          if (p.type !== "agent" && p.type !== "self")
            bad(file, `${where}: entry type must be "agent" or "self"`);
        }
        const ref = refOf(p);
        if (seen.has(ref))
          bad(
            file,
            `${where}: "${ref}" listed twice (entries must be distinct)`,
          );
        seen.add(ref);
        if (excluded.includes(ref))
          bad(
            file,
            `${where}: "${ref}" must not be in the ${a.name} roster (excluded for this coordinator)`,
          );
        else if (COORDINATORS.includes(ref))
          bad(
            file,
            `${where}: "${ref}" carries a multiagent block and cannot be a subagent (one level deep, API 400)`,
          );
        else if (
          ref !== "self" &&
          !others.includes(ref) &&
          !/^agent_/.test(ref ?? "")
        )
          bad(
            file,
            `${where}: "${ref}" is neither a sibling file nor an agent_ id`,
          );
      }
    };
    roster(pre, "subagents.predefined_agents");
    const wfPre = ma.workflows?.predefined_agents ?? [];
    if (wfPre.length > 20)
      bad(
        file,
        `workflows.predefined_agents must hold ≤ 20 entries (has ${wfPre.length})`,
      );
    roster(wfPre, "workflows.predefined_agents");
    for (const n of others)
      if (!excluded.includes(n) && !pre.some((p) => refOf(p) === n))
        bad(file, `subagent ${n} missing from the ${a.name} roster`);
    if (ma.workflows && !["enabled", "disabled"].includes(ma.workflows.type))
      bad(file, "multiagent.workflows must be enabled|disabled");
    if (!ma.workflows || ma.workflows.type === "enabled")
      console.log(
        `  note ${file}: workflows enabled – the lead may start workflow runs (cost: own threads, 24 h lifetime)`,
      );
    if (ma.advisor && ma.advisor.type === "enabled" && !ma.advisor.model)
      bad(file, "advisor enabled needs a model");
  } else if (COORDINATORS.includes(a.name))
    bad(
      file,
      `${a.name} has no multiagent block – it would do everything itself`,
    );
}
// cross-file: the agents with a multiagent block are exactly the coordinators (present ones, sorted)
const presentCoordinators = COORDINATORS.filter((n) =>
  files.includes(`${n}.json`),
);
if (withMultiagent.sort().join() !== presentCoordinators.join()) {
  problems++;
  console.log(
    `✗ agents with a multiagent block must be exactly [${presentCoordinators.join(", ")}], found [${withMultiagent.join(", ")}]`,
  );
}
// cross-file: merge capability and inference_geo
if (!hardRef) {
  problems++;
  console.log(
    "✗ nemo-qa.json (template for the hard-limits block) missing or invalid",
  );
} else
  for (const b of hardBlocks)
    if (b.hl !== hardRef.hl)
      bad(
        b.file,
        "hard-limits block differs from the template nemo-qa.json (one block for all 19)",
      );
if (mergeCapable.join() !== "nemo-merge") {
  problems++;
  console.log(
    `✗ merge-capable roles must be exactly [nemo-merge], found [${mergeCapable.join(", ")}]`,
  );
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
