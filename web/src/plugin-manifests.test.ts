import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Android 12+ refuses to merge a manifest whose component has an intent-filter but no explicit
 * android:exported. The error only shows up in the Gradle step of the release build, so check it here.
 */
const plugins = resolve(__dirname, '..', 'src-tauri', 'plugins');
const manifests = readdirSync(plugins).map((name) =>
  resolve(plugins, name, 'android', 'src', 'main', 'AndroidManifest.xml'),
);

describe('Android plugin manifests', () => {
  it.each(manifests)('%s declares android:exported on components with an intent-filter', (path) => {
    const xml = readFileSync(path, 'utf8').replace(/<!--[\s\S]*?-->/g, '');
    const components = xml.matchAll(
      /<(activity|activity-alias|service|receiver)\b([^>]*)>([\s\S]*?)<\/\1>/g,
    );
    for (const [, , attrs, body] of components) {
      if (body?.includes('<intent-filter'))
        expect(attrs).toMatch(/android:exported="(true|false)"/);
    }
  });
});
