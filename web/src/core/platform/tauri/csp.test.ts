import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Guards the desktop webview CSP in `src-tauri/tauri.conf.json`: no inline or eval'd scripts, no
 * plugins, no frames, no form navigation, no `<base>` hijack. The app has no iframes, objects or
 * forms with an `action`; React forms submit through `onSubmit` + `preventDefault`.
 */
function readCsp(): Map<string, string[]> {
  const raw = readFileSync(
    new URL('../../../../src-tauri/tauri.conf.json', import.meta.url),
    'utf8',
  );
  const config = JSON.parse(raw) as { app?: { security?: { csp?: string } } };
  const csp = config.app?.security?.csp;
  expect(typeof csp).toBe('string');
  const directives = new Map<string, string[]>();
  for (const part of (csp as string).split(';')) {
    const [name, ...values] = part.trim().split(/\s+/);
    if (name) directives.set(name, values);
  }
  return directives;
}

describe('desktop CSP', () => {
  it('locks base, plugins, forms and frames', () => {
    const csp = readCsp();
    expect(csp.get('base-uri')).toEqual(["'self'"]);
    expect(csp.get('object-src')).toEqual(["'none'"]);
    expect(csp.get('form-action')).toEqual(["'none'"]);
    expect(csp.get('frame-src')).toEqual(["'none'"]);
  });

  it('never allows inline or eval scripts', () => {
    const csp = readCsp();
    const script = csp.get('script-src');
    expect(script).toBeDefined();
    expect(script).toContain("'self'");
    expect(script).not.toContain("'unsafe-eval'");
    expect(script).not.toContain("'unsafe-inline'");
    expect(csp.get('default-src')).toEqual(["'self'"]);
  });
});
