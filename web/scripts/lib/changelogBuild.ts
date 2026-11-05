/** Build-time data for the app: released versions (committed JSON) plus, in previews, the open notes. */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { entriesWithBuilds, noteBuilds } from './changesBuild.ts';
import { loadChanges } from './changesDir.ts';
import { upsertVersion, type ChangelogData } from './changelogRelease.ts';

export function buildChangelogData(opts: {
  webDir: string;
  rootDir: string;
  includeUnreleased: boolean;
}): ChangelogData {
  const file = join(opts.webDir, 'src/generated/changelog.json');
  let data: ChangelogData = { areas: {}, versions: [] };
  if (existsSync(file)) {
    try {
      data = JSON.parse(readFileSync(file, 'utf8')) as ChangelogData;
    } catch {
      /* a broken file must not break the build: start empty */
    }
  }
  if (opts.includeUnreleased) {
    const loaded = loadChanges(join(opts.rootDir, '.changes'));
    const git = (a: string[]) => execFileSync('git', a, { cwd: opts.rootDir, encoding: 'utf8' });
    const entries = entriesWithBuilds(loaded.byFile, noteBuilds(loaded.files, '.changes', git));
    if (entries.length > 0) {
      const withUnreleased = upsertVersion(data, { version: 'unreleased', date: '', entries });
      // upsert puts the new version first, which is where "unreleased" belongs
      data = withUnreleased;
    }
  }
  return data;
}

/** Previews (Dev-Preview channel, pre-release versions, the dev server) show the open notes. */
export const wantsUnreleased = (opts: {
  channel?: string;
  version: string;
  serve: boolean;
}): boolean =>
  opts.serve || opts.channel === 'dev' || /^\d+\.\d+\.\d+-/.test(opts.version.replace(/\+.*$/, ''));
