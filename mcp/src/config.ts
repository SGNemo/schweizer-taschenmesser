/**
 * Where the app listens and which token to send. The token is only ever sent to the app's
 * loopback address: any other host is refused, so a wrong setting cannot leak it.
 */

export const DEFAULT_URL = 'http://127.0.0.1:47631';
const LOOPBACK = new Set(['127.0.0.1', 'localhost']);

export interface Config {
  /** Origin of the local API, e.g. `http://127.0.0.1:47631` (no path). */
  baseUrl: string;
  token: string;
}

export class ConfigError extends Error {}

export function readConfig(env: Record<string, string | undefined>): Config {
  const token = env.TASCHENMESSER_TOKEN?.trim() ?? '';
  if (!token) {
    throw new ConfigError(
      'TASCHENMESSER_TOKEN fehlt. Lege in der App unter Einstellungen → KI-Zugriff einen Zugang an.',
    );
  }
  if (!/^tm_[A-Za-z0-9_-]{16,250}$/.test(token)) {
    throw new ConfigError('TASCHENMESSER_TOKEN sieht nicht wie ein Schlüssel der App aus (tm_…).');
  }
  let url: URL;
  try {
    url = new URL(env.TASCHENMESSER_URL?.trim() || DEFAULT_URL);
  } catch {
    throw new ConfigError('TASCHENMESSER_URL ist keine gültige Adresse.');
  }
  if (url.protocol !== 'http:' || !LOOPBACK.has(url.hostname)) {
    throw new ConfigError(
      'TASCHENMESSER_URL muss auf diesen Computer zeigen (http://127.0.0.1:<Port> oder http://localhost:<Port>).',
    );
  }
  if (url.pathname !== '/' || url.search || url.hash || url.username || url.password) {
    throw new ConfigError('TASCHENMESSER_URL darf nur Adresse und Port enthalten.');
  }
  return { baseUrl: url.origin, token };
}
