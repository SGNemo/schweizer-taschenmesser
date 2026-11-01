/**
 * Launcher shortcuts of the Android app (`share-intent` plugin, `res/xml/shortcuts.xml`).
 * Resource XML knows no `${applicationId}`, so the file names the stable app id and CI rewrites
 * the shortcut targets to the id of the flavour it builds (Dev-Preview: `….dev`).
 * Erasable TypeScript, imported by `../android-shortcuts.mjs`.
 */

/** The id committed in shortcuts.xml (= `identifier` in tauri.conf.json, never changes). */
export const STABLE_APP_ID = 'io.github.sgnemo.taschenmesser';

const ID = /^[a-zA-Z][\w]*(\.[a-zA-Z][\w]*)+$/;

/** Sets `targetPackage` and the package part of `targetClass` (`<id>.MainActivity`) to `appId`. */
export function setShortcutAppId(xml: string, appId: string): string {
  if (!ID.test(appId)) throw new Error(`Not an application id: ${appId}`);
  const out = xml
    .replace(/android:targetPackage="[^"]*"/g, `android:targetPackage="${appId}"`)
    .replace(
      /android:targetClass="[^"]*\.MainActivity"/g,
      `android:targetClass="${appId}.MainActivity"`,
    );
  const targets = (out.match(/android:targetPackage="/g) ?? []).length;
  // Plain substring count: no regular expression is built from the id.
  const classes = out.split(`android:targetClass="${appId}.MainActivity"`).length - 1;
  if (targets === 0 || targets !== classes)
    throw new Error('shortcuts.xml: every shortcut needs targetPackage and targetClass');
  return out;
}
