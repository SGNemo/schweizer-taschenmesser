/**
 * Top of the Dev-Preview release body: download links first, the two short install guides (Windows
 * SmartScreen, Android "unknown apps") and the SHA-256 of every file. Erasable TypeScript, used by
 * `../dev-release-body.mjs` (publish job of dev-preview.yml) and its unit test. Wording matches the
 * site page /install (site/src/i18n/{de,en}.ts `installPage`).
 */

export const INSTALL_PAGE = {
  de: 'https://nemo-adhd-helper.online/install',
  en: 'https://nemo-adhd-helper.online/en/install',
} as const;

export interface FileHash {
  name: string;
  sha256: string;
}

const isHex64 = (s: string) => /^[0-9a-f]{64}$/.test(s);

/** Markdown block for the release body. Throws when a hash is malformed or the exe/APK is missing. */
export function devInstallBlock(repo: string, tag: string, files: readonly FileHash[]): string {
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) throw new Error(`Invalid repository: "${repo}"`);
  for (const f of files) {
    if (!isHex64(f.sha256)) throw new Error(`Invalid SHA-256 for ${f.name}`);
  }
  const names = files.map((f) => f.name);
  for (const need of ['Nemo-Portable-dev.exe', 'Nemo-dev.apk']) {
    if (!names.includes(need)) throw new Error(`Missing ${need}`);
  }
  const url = (n: string) => `https://github.com/${repo}/releases/download/${tag}/${n}`;
  return [
    '## Download',
    '',
    `- **Windows:** [Nemo-Portable-dev.exe](${url('Nemo-Portable-dev.exe')}) (portable, no installation / keine Installation)`,
    `- **Android:** [Nemo-dev.apk](${url('Nemo-dev.apk')})`,
    '',
    '### Windows',
    '',
    'DE: Windows zeigt „Der Computer wurde durch Windows geschützt“, weil die Datei kein gekauftes Code-Signing-Zertifikat hat. Datei starten → **Weitere Informationen** → prüfen, dass dort „Nemo-Portable-dev.exe“ steht → **Trotzdem ausführen**. Meldet Edge „wird nicht häufig heruntergeladen“: **…** → **Beibehalten** → **Mehr anzeigen** → **Trotzdem beibehalten**. Steht dort „Intelligente App-Steuerung“ ohne „Trotzdem ausführen“, lässt Windows unsignierte Apps gar nicht zu.',
    '',
    'EN: Windows shows “Windows protected your PC” because the file has no purchased code-signing certificate. Run the file → **More info** → check that it says “Nemo-Portable-dev.exe” → **Run anyway**. If Edge says the file “isn’t commonly downloaded”: **…** → **Keep** → **Show more** → **Keep anyway**. If it says “Smart App Control” with no “Run anyway”, Windows does not allow unsigned apps at all.',
    '',
    '### Android (Samsung)',
    '',
    'DE: APK öffnen → **Einstellungen** → **Von dieser Quelle zulassen** → zurück → **Installieren**. Blockiert die „Automatische Blockierung“: Einstellungen → Sicherheit und Datenschutz → Automatische Blockierung aus, installieren, wieder einschalten.',
    '',
    'EN: Open the APK → **Settings** → **Allow from this source** → back → **Install**. If “Auto Blocker” blocks it: Settings → Security and privacy → Auto Blocker off, install, turn it back on.',
    '',
    `Step by step / Schritt für Schritt: ${INSTALL_PAGE.en} · ${INSTALL_PAGE.de}`,
    '',
    '### SHA-256',
    '',
    '| File | SHA-256 |',
    '| --- | --- |',
    ...files.map((f) => `| \`${f.name}\` | \`${f.sha256}\` |`),
    '',
    'Windows: `Get-FileHash .\\Nemo-Portable-dev.exe -Algorithm SHA256` · Linux/macOS: `sha256sum Nemo-dev.apk`',
    '',
    '---',
    '',
  ].join('\n');
}

/** GitHub rejects a release body above 125,000 characters (HTTP 422); stay well below it. */
export const MAX_RELEASE_BODY = 100_000;

const HEADING = /^## (?!#)/m;

/** Splits markdown into the text before the first `## ` heading and one chunk per `## ` section. */
function sections(md: string): { pre: string; parts: string[] } {
  const at = md.search(HEADING);
  if (at === -1) return { pre: md, parts: [] };
  const parts = md
    .slice(at)
    .split(/\n(?=## (?!#))/)
    .map((p) => p.trimEnd());
  return { pre: md.slice(0, at), parts };
}

/**
 * The full release body (`head` + `notes`), capped at `max` characters. `notes` is the output of
 * `changelog-release.mjs --unreleased`: a German and an English list of `## Build N` sections (newest
 * first) separated by a `---` line. When too long, the oldest builds are dropped from both languages
 * alike, always whole sections, and one line pointing to the full history is appended.
 */
export function capReleaseBody(
  head: string,
  notes: string,
  repo: string,
  max: number = MAX_RELEASE_BODY,
): string {
  if (head.length + notes.length <= max) return head + notes;
  const sep = notes.search(/\n---\n/);
  const halves = (
    sep === -1 ? [notes] : [notes.slice(0, sep), notes.slice(sep + 5).replace(/^\n+/, '')]
  ).map(sections);
  const footer =
    `\n_Older builds omitted (GitHub size limit) · Ältere Builds gekürzt. Full history / vollständige Liste: ` +
    `https://github.com/${repo}/tree/develop/.changes · https://github.com/${repo}/blob/develop/CHANGELOG.md_\n`;
  const build = (k: number) =>
    head +
    halves.map(({ pre, parts }) => pre + parts.slice(0, k).join('\n\n') + '\n').join('\n---\n\n') +
    footer;
  const most = Math.max(...halves.map((h) => h.parts.length));
  let k = most;
  while (k > 0 && build(k).length > max) k--;
  const body = build(k);
  if (body.length > max)
    throw new Error(`Release body too long even without build notes (${body.length} > ${max})`);
  return body;
}
