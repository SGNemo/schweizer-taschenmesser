import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';

/**
 * Update path: a device that still runs the LAST RELEASE (its Dexie schema and invented data from
 * `tests/fixtures/backups`) opens the app built from this checkout. The browser database is
 * created in the old schema first, then the current build starts and must upgrade it, show no
 * recovery screen and still display the data. Run it alone with `npm run test:update-path`.
 *
 * Not covered here: the real Windows exe / Android apk (their data folders are WebView profiles);
 * see docs/LAUNCH-CHECKLIST.md for the manual update steps.
 */
const DIR = resolve(process.cwd(), 'tests/fixtures/backups');

interface Release {
  schemaVersion: number;
  stores: Record<string, string>;
}

/** Highest release by semver; a pre-release sorts below its release (0.3.0-beta.1 < 0.3.0). */
function lastRelease(tags: string[]): string {
  const key = (t: string) => {
    const [core, pre] = t.replace(/^v/, '').split('-');
    const [a = 0, b = 0, c = 0] = core!.split('.').map(Number);
    return [a, b, c, pre ? 0 : 1, pre ?? ''] as const;
  };
  return [...tags].sort((x, y) => {
    const [kx, ky] = [key(x), key(y)];
    for (let i = 0; i < 4; i++) if (kx[i] !== ky[i]) return (kx[i] as number) - (ky[i] as number);
    return String(kx[4]).localeCompare(String(ky[4]), 'en', { numeric: true });
  })[tags.length - 1]!;
}

const index = JSON.parse(readFileSync(resolve(DIR, 'index.json'), 'utf8')) as Record<
  string,
  Release
>;
const tag = lastRelease(
  readdirSync(DIR)
    .filter((f) => /^v\d.*\.json$/.test(f))
    .map((f) => f.replace(/\.json$/, '')),
);
const release = index[tag]!;
const backup = JSON.parse(readFileSync(resolve(DIR, `${tag}.json`), 'utf8')) as {
  tables: Record<string, { id: string; deletedAt: number | null }[]>;
};

test(`${tag} → this build: the old database upgrades, the app starts and shows the data`, async ({
  page,
}) => {
  // 1. the old installation: plain IndexedDB in the schema of that release (Dexie stores version × 10)
  // A bare page of the same origin: the app must not run (and hold the database open) yet.
  await page.route('**/__blank', (r) =>
    r.fulfill({ contentType: 'text/html', body: '<!doctype html><title>x</title>' }),
  );
  await page.goto('/__blank');
  await page.evaluate(
    () =>
      new Promise<void>((resolveDelete) => {
        const req = indexedDB.deleteDatabase('taschenmesser');
        req.onsuccess = req.onerror = req.onblocked = () => resolveDelete();
      }),
  );
  const created = await page.evaluate(
    ({ stores, version, rows }) =>
      new Promise<number>((resolveOpen, reject) => {
        const open = indexedDB.open('taschenmesser', version * 10);
        open.onupgradeneeded = () => {
          const db = open.result;
          for (const [name, spec] of Object.entries(stores)) {
            const parts = spec.split(',').map((s) => s.trim());
            const first = parts[0]!;
            const store = first.startsWith('++')
              ? db.createObjectStore(name, { keyPath: first.slice(2), autoIncrement: true })
              : first.startsWith('[')
                ? db.createObjectStore(name, { keyPath: first.slice(1, -1).split('+') })
                : db.createObjectStore(name, { keyPath: first });
            for (const idx of parts.slice(1)) {
              const keyPath = idx.startsWith('[')
                ? idx.slice(1, -1).split('+')
                : idx.replace(/^[&*]/, '');
              store.createIndex(idx, keyPath, {
                unique: idx.startsWith('&'),
                multiEntry: idx.startsWith('*'),
              });
            }
          }
        };
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          let n = 0;
          const tx = db.transaction(
            Object.keys(rows).filter((t) => db.objectStoreNames.contains(t)),
            'readwrite',
          );
          for (const [table, list] of Object.entries(rows)) {
            if (!db.objectStoreNames.contains(table)) continue;
            for (const r of list) {
              tx.objectStore(table).put(r);
              n++;
            }
          }
          tx.oncomplete = () => {
            db.close();
            resolveOpen(n);
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
    { stores: release.stores, version: release.schemaVersion, rows: backup.tables },
  );
  expect(created).toBeGreaterThan(10);

  // 2. the current build starts on top of it
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/todos');
  await expect(page.locator('main h1')).toBeVisible();
  await expect(page.getByTestId('fatal-error')).toHaveCount(0);
  await expect(page.getByTestId('recovery-detail')).toHaveCount(0);
  await expect(page.getByText('Aufgabe 1').first()).toBeVisible();

  // 3. the database really moved to the current schema and still holds every row
  const after = await page.evaluate(
    (tables) =>
      new Promise<{ version: number; counts: Record<string, number> }>((resolveRead, reject) => {
        const open = indexedDB.open('taschenmesser');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const counts: Record<string, number> = {};
          const present = tables.filter((t) => db.objectStoreNames.contains(t));
          const tx = db.transaction(present, 'readonly');
          for (const t of present) {
            const req = tx.objectStore(t).count();
            req.onsuccess = () => (counts[t] = req.result);
          }
          tx.oncomplete = () => {
            const version = db.version;
            db.close();
            resolveRead({ version, counts });
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
    Object.keys(backup.tables),
  );
  expect(after.version).toBeGreaterThan(release.schemaVersion * 10);
  for (const [table, rows] of Object.entries(backup.tables)) {
    if (rows.length === 0 || !(table in after.counts)) continue;
    expect(after.counts[table], table).toBeGreaterThanOrEqual(rows.length);
  }
  expect(errors).toEqual([]);
});
