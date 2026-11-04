/** Stand-in for `virtual:changelog` in unit tests (see vitest.config.ts). */
import type { ChangelogData } from './types';

const empty: ChangelogData = { areas: {}, versions: [] };
export default empty;
