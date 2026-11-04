import type { SourceFile } from './types';

export const extOf = (name: string): string =>
  /\.([a-z0-9]+)$/i.exec(name)?.[1]?.toLowerCase() ?? '';
export const withExt = (files: readonly SourceFile[], ...exts: string[]) =>
  files.filter((f) => exts.includes(extOf(f.name)));
export const head = (f: SourceFile, n = 2000) => f.text.replace(/^\uFEFF/, '').slice(0, n);
/** Best (highest) confidence over the files, so one fitting file is enough for a mixed archive. */
export const best = (files: readonly SourceFile[], rate: (f: SourceFile) => number): number =>
  files.reduce((m, f) => Math.max(m, rate(f)), 0);
