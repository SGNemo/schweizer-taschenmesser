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
