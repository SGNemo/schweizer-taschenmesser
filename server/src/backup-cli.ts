/** `node dist/backup-cli.js [destDir] [keep]` – backs up `DB_PATH` (default ./data/sync.db). */
import { backupDatabase } from './backup.js';

const dbPath = process.env.DB_PATH ?? './data/sync.db';
const destDir = process.argv[2] ?? process.env.BACKUP_DIR ?? './data/backups';
const keep = Number(process.argv[3] ?? process.env.BACKUP_KEEP ?? 7);

try {
  const { file, pruned } = await backupDatabase(dbPath, destDir, Number.isInteger(keep) ? keep : 7);
  console.log(`backup written: ${file}${pruned.length ? ` (removed ${pruned.length} old)` : ''}`);
} catch (e) {
  console.error('backup failed:', e instanceof Error ? e.message : e);
  process.exit(1);
}
