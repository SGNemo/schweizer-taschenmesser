/** Shape of `src/generated/changelog.json` (written by `scripts/changelog-release.mjs`). */
export type ChangeType = 'added' | 'changed' | 'fixed' | 'removed' | 'security' | 'performance';

export interface ChangelogEntry {
  type: ChangeType;
  area: string;
  breaking: boolean;
  highlight: boolean;
  de: string;
  en: string;
  pr?: number;
  /** Preview builds only: the build number the note came with. */
  build?: number;
}
export interface ChangelogVersion {
  /** 'x.y.z', a pre-release, or 'unreleased'. */
  version: string;
  /** 'YYYY-MM-DD'; '' for unreleased. */
  date: string;
  entries: ChangelogEntry[];
}
export interface ChangelogData {
  areas: Record<string, { de: string; en: string }>;
  /** Newest first. */
  versions: ChangelogVersion[];
}
export const UNRELEASED = 'unreleased';
