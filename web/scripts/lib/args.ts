/**
 * Minimal command-line flag parser for the release scripts. Erasable TypeScript.
 *
 * `--name value` and `--name=value` give a string, a flag without a value (last argument, or followed
 * by another `--flag`) gives `true`. Works on the unfiltered argument list, so a value is never
 * mistaken for the next flag. Arguments that do not start with `--` and are no value are ignored.
 */
export function parseArgs(argv: readonly string[]): Record<string, string | true> {
  const out: Record<string, string | true> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (!arg.startsWith('--') || arg === '--') continue;
    const eq = arg.indexOf('=');
    if (eq > 2) {
      out[arg.slice(2, eq)] = arg.slice(eq + 1);
      continue;
    }
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith('--')) {
      out[arg.slice(2)] = next;
      i++;
    } else {
      out[arg.slice(2)] = true;
    }
  }
  return out;
}
