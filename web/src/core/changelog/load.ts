import type { ChangelogData } from './types';

/** The embedded data (own chunk, loaded when the changes list is opened; works offline). */
export async function loadChangelog(): Promise<ChangelogData> {
  try {
    return (await import('virtual:changelog')).default;
  } catch {
    return { areas: {}, versions: [] };
  }
}
