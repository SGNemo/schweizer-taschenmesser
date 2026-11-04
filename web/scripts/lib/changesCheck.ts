/** The PR rule: a note in `.changes/` or the label `no-changelog`. Pure; the CLI feeds it git and env. */
export const NO_CHANGELOG_LABEL = 'no-changelog';

export function checkPullRequest(input: {
  changedFiles: string[];
  labels: string[];
}): string | undefined {
  if (input.labels.includes(NO_CHANGELOG_LABEL)) return undefined;
  const hasNote = input.changedFiles.some(
    (f) => /^\.changes\/[^/]+\.md$/.test(f) && !/(^|\/)README\.md$/.test(f),
  );
  return hasNote
    ? undefined
    : `No change note: add a file to .changes/ (npm run change in web/) or give the PR the label "${NO_CHANGELOG_LABEL}" (docs, tests, CI only).`;
}
