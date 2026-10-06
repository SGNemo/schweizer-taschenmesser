/**
 * The diagnostics report: app facts, enabled modules and tools, appearance, sync phase, record
 * counts per module, migration state, storage use, the last log lines and the last errors. Never
 * record contents, vault data, settings values with secrets, the data folder, server URLs, tokens,
 * keys, e-mail addresses or IP addresses (`diagnostics.test.ts` checks that with a negative list).
 * It is shown to the user before saving and only leaves the app when the user attaches it.
 */
import { getAboutInfo, type AboutInfo } from '@/core/about/info';
import { db } from '@/core/db/db';
import { tableName } from '@/core/db/schema';
import { getLang } from '@/core/i18n/lang';
import { loadModuleStates } from '@/core/modules/activation';
import { availableManifests } from '@/core/modules/available';
import { getPlatform } from '@/core/platform';
import { useSyncStatus } from '@/core/sync/status';
import { toDateString } from '@/core/time/now';
import {
  DEFAULT_TOOLS,
  activeTools,
  migrateToolIds,
  toolsSettingsSchema,
  TOOLS_SCOPE,
} from '@/core/tools/layout';
import { allTools } from '@/core/tools/registry';
import { getSettings } from '@/core/settings/settings';
import { errorLog, logLines, scrub, type LogEntry, type LogLine } from './errorLog';

/** Modules whose record counts are never listed (the vault: not even its size). */
const NO_COUNTS = new Set(['accounts']);
/** Appearance attributes of `<html>` that may appear (values are short enums). */
const APPEARANCE = new Set([
  'theme',
  'accent',
  'textSize',
  'leading',
  'motion',
  'density',
  'sidebar',
  'colorMode',
  'readAid',
  'palette',
]);

export interface Diagnostics {
  format: 'nemo-diagnostics';
  version: 2;
  app: Omit<AboutInfo, 'dataDir'>;
  os: string;
  language: string;
  appearance: Record<string, string>;
  activeModules: string[];
  activeTools: string[];
  sync: {
    connected: boolean;
    phase: string;
    encrypted: boolean;
    pending: number;
    failures: number;
  };
  counts: Record<string, number>;
  migrations: { dbVersion: number; modules: Record<string, number> };
  storage?: { usageMb: number; quotaMb: number };
  lines: LogLine[];
  errors: LogEntry[];
}

/** "Windows NT 10.0; Win64" instead of the full user agent: platform and browser major version only. */
export function describeOs(ua: string): string {
  const platform = /\(([^)]*)\)/.exec(ua)?.[1] ?? 'unknown';
  const browser = /(Edg|Chrome|Firefox|Safari|WebView2)\/(\d+)/.exec(ua);
  return `${platform}${browser ? `; ${browser[1]} ${browser[2]}` : ''}`;
}

const mb = (n: number) => Math.round((n / 1024 / 1024) * 10) / 10;

async function recordCounts(
  manifests: ReturnType<typeof availableManifests>,
  active: Set<string>,
): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const m of manifests) {
    if (!active.has(m.id) || NO_COUNTS.has(m.id)) continue;
    let total = 0;
    for (const c of Object.keys(m.dataSchema.collections)) {
      try {
        total += await db
          .table(tableName(m.id, c))
          .filter((r: { deletedAt?: unknown }) => !r.deletedAt)
          .count();
      } catch {
        // a table that cannot be read counts as 0; the errors list shows why
      }
    }
    counts[m.id] = total;
  }
  return counts;
}

export async function buildDiagnostics(): Promise<Diagnostics> {
  const { dataDir: _dataDir, ...app } = await getAboutInfo();
  const manifests = availableManifests();
  const states = await loadModuleStates(manifests);
  const active = new Set(manifests.filter((m) => states[m.id]).map((m) => m.id));

  const tools = migrateToolIds(await getSettings(TOOLS_SCOPE, toolsSettingsSchema, DEFAULT_TOOLS));
  const sync = useSyncStatus.getState();

  const modules: Record<string, number> = {};
  try {
    for (const row of await db.table('_meta').toArray()) {
      const m = /^moduleVersion\.(\w+)$/.exec(String(row.key));
      if (m && active.has(m[1]!) && typeof row.value === 'number') modules[m[1]!] = row.value;
    }
  } catch {
    // unreadable meta table: reported through the errors list
  }

  const est = await navigator.storage?.estimate?.().catch(() => undefined);
  const root = typeof document !== 'undefined' ? document.documentElement.dataset : {};
  return {
    format: 'nemo-diagnostics',
    version: 2,
    app,
    os: describeOs(typeof navigator !== 'undefined' ? navigator.userAgent : ''),
    language: getLang(),
    appearance: Object.fromEntries(
      Object.entries(root).filter(
        (e): e is [string, string] => APPEARANCE.has(e[0]) && /^[\w-]{1,20}$/.test(e[1] ?? ''),
      ),
    ),
    activeModules: [...active],
    activeTools: activeTools(allTools, tools).map((t) => t.id),
    sync: {
      connected: sync.phase !== 'off',
      phase: sync.phase,
      encrypted: sync.encrypted,
      pending: sync.pending,
      failures: sync.failures,
    },
    counts: await recordCounts(manifests, active),
    migrations: { dbVersion: db.verno, modules },
    ...(est?.usage != null && est.quota != null
      ? { storage: { usageMb: mb(est.usage), quotaMb: mb(est.quota) } }
      : {}),
    lines: logLines().slice(),
    errors: errorLog().slice(),
  };
}

const iso = (at: number) => new Date(at).toISOString().replace(/\.\d+Z$/, 'Z');

/** The readable text file. Final scrub: no URL, IP, mail address, path with a user name or token survives. */
export function renderDiagnostics(d: Diagnostics): string {
  const L: string[] = [];
  const kv = (k: string, v: string | number | boolean) => L.push(`${k}: ${v}`);
  L.push(
    'Nemo diagnostics (nothing in here was sent anywhere; you decide whether to share it)',
    '',
  );
  L.push('## App');
  kv('Version', d.app.version);
  kv('Build', `${d.app.commit || '-'} (${d.app.buildDate || '-'})`);
  kv('Channel', d.app.channel);
  kv('Platform', d.app.platform);
  kv('Install kind', d.app.installKind);
  kv('OS / browser', d.os);
  kv('Language', d.language);
  kv(
    'Appearance',
    Object.entries(d.appearance)
      .map(([k, v]) => `${k}=${v}`)
      .join(', ') || '-',
  );
  L.push('', '## Modules and tools');
  kv('Active modules', d.activeModules.join(', ') || '-');
  kv('Active tools', d.activeTools.join(', ') || '-');
  L.push('', '## Sync');
  kv('Connected', d.sync.connected);
  kv('Phase', d.sync.phase);
  kv('Encrypted', d.sync.encrypted);
  kv('Pending changes', d.sync.pending);
  kv('Failed cycles in a row', d.sync.failures);
  L.push('', '## Record counts (numbers only, no contents)');
  for (const [id, n] of Object.entries(d.counts)) kv(id, n);
  L.push('', '## Migrations');
  kv('Database version', d.migrations.dbVersion);
  for (const [id, v] of Object.entries(d.migrations.modules)) kv(`Module ${id}`, v);
  L.push('', '## Storage');
  kv('Used / quota (MB)', d.storage ? `${d.storage.usageMb} / ${d.storage.quotaMb}` : 'unknown');
  L.push('', `## Last log lines (${d.lines.length})`);
  for (const l of d.lines) L.push(`${iso(l.at)} ${l.level} [${l.source}] ${l.message}`);
  L.push('', `## Last errors (${d.errors.length})`);
  for (const e of d.errors) {
    L.push(`${iso(e.at)} [${e.source}] ${e.message}`);
    if (e.stack) L.push(...e.stack.split('\n').map((f) => `    ${f}`));
  }
  let text = scrub(L.join('\n')).replace(/https?:\/\/[^\s"'<>)]+/g, '[url]');
  // The sync server's host may appear bare in a log line: never print it.
  const host = useSyncStatus.getState().server;
  if (host) text = text.split(host).join('[server]');
  return text + '\n';
}

export async function diagnosticsText(): Promise<string> {
  return renderDiagnostics(await buildDiagnostics());
}

export async function saveDiagnostics(text: string): Promise<'saved' | 'cancelled'> {
  return getPlatform().saveFile({
    fileName: `nemo-diagnose-${toDateString(new Date())}.txt`,
    data: text,
    mime: 'text/plain',
  });
}
