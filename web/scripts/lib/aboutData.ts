/** Build-time data for "Über Nemo": the changelog section of a version (the licence list: `licenseList.ts`). */

/**
 * The part of `CHANGELOG.md` for `version` (`## 0.3.1 (…)`), or the `## Unreleased` block when the
 * version has no section yet. Returns '' when neither exists. Capped at `maxLines` lines.
 */
export function extractChangelogSection(markdown: string, version: string, maxLines = 60): string {
  const lines = markdown.split(/\r?\n/);
  const heading = (l: string) => /^##\s+(?!#)/.test(l);
  const find = (match: (l: string) => boolean) => lines.findIndex((l) => heading(l) && match(l));
  let start = find(
    (l) => l.replace(/^##\s+/, '').startsWith(`${version} `) || l.trim() === `## ${version}`,
  );
  if (start === -1) start = find((l) => /^##\s+Unreleased/i.test(l));
  if (start === -1) return '';
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((l) => heading(l));
  const body = (end === -1 ? rest : rest.slice(0, end)).join('\n').trim();
  const bodyLines = body.split('\n');
  return bodyLines.length > maxLines ? bodyLines.slice(0, maxLines).join('\n') + '\n…' : body;
}
