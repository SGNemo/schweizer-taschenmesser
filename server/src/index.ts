import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { buildApp } from './app.js';
import { MIN_TOKEN_LENGTH } from './auth.js';
import { openStore } from './store.js';

const env = process.env;

const tokens = (env.SYNC_TOKENS ?? env.SYNC_TOKEN ?? '')
  .split(',')
  .map((t) => t.trim())
  .filter(Boolean);

if (tokens.length === 0 || tokens.some((t) => t.length < MIN_TOKEN_LENGTH)) {
  console.error(
    `SYNC_TOKEN (or SYNC_TOKENS, comma separated) is required and every token needs at least ${MIN_TOKEN_LENGTH} characters.\n` +
      "Generate one with:  node -e \"console.log(require('crypto').randomBytes(24).toString('base64url'))\"",
  );
  process.exit(1);
}

const dbPath = env.DB_PATH ?? './data/sync.db';
if (dbPath !== ':memory:') mkdirSync(dirname(resolve(dbPath)), { recursive: true });

const origins = (env.CORS_ORIGINS ?? '*')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const store = openStore(dbPath);
const app = await buildApp({
  store,
  tokens,
  corsOrigins: origins.includes('*') ? '*' : origins,
  webDir: env.WEB_DIR ? resolve(env.WEB_DIR) : undefined,
  rateLimit: env.RATE_LIMIT ? Number(env.RATE_LIMIT) : undefined,
  logger: true,
});

const shutdown = async () => {
  await app.close();
  store.close();
  process.exit(0);
};
process.on('SIGTERM', () => void shutdown());
process.on('SIGINT', () => void shutdown());

await app.listen({ port: Number(env.PORT ?? 8787), host: env.HOST ?? '0.0.0.0' });
