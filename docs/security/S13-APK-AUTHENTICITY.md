# S13 – where the Android update's authenticity comes from (decision paper)

Launch review 2026-11, finding S13 (medium, recommendation: accept). Package 4 builds nothing here; this page is the basis for Sven's decision.

## Today

The app finds the release on GitHub, reads the expected SHA-256 from the release asset `Nemo.apk.sha256`, and the installer plugin downloads the APK only from this repository's releases (`plugins/apk-installer/src/validate.rs`), checks the digest, then hands it to Android. The `.sha256` file is unsigned: anyone who can change the release (or break TLS to github.com) can change both files. What Android stops: an APK with **the same package id** must carry the same certificate, otherwise the system refuses it and the app and its data stay. What it does not stop: the plugin (`ApkInstallerPlugin.kt`) checks only the digest, not the APK's package name or certificate, so an APK under **another package id** with a matching `.sha256` installs as a second app once the user confirms the system dialog (council round 2).

## Four ways

| Way | Effort | What it buys | Costs and risks |
|---|---|---|---|
| A. A minisign signature over the APK's digest, carried in `latest.json` or the release (note: `latest.json` itself is not signed – only each payload's `.sig` in it, see NS2) | M: release job signs the digest with the updater key, app verifies it before trusting the digest | the digest no longer rests on GitHub + TLS alone | touches `release.yml` and the updater key (hard limit: Sven); the key then guards both platforms |
| B. `.apk.sig` with the updater key, verified in the plugin | M: one more release asset, Rust verify in the plugin (as `portable.rs`) | the same as A, without changing the manifest | same hard limit; a second asset that can go missing (update stops, fails closed) |
| C. Leave as is | none | – | a GitHub account or TLS break can offer an APK under another package id; it installs as a second app after the user confirms (it cannot replace Nemo or read its data) |
| D. Before handing the file to Android, check with `PackageManager.getPackageArchiveInfo` that package name and signing certificate equal the running app's | S: a few lines of Kotlin in the plugin, no release change, no key | closes the "second app" path; the update offered is provably the same app | Kotlin in the plugin (Sven merges); needs a hand test on a device |

## Decision (2026-11-23)

Sven chose **D**. Built as the smallest form: before the system installer opens, the plugin reads the APK's package name (`getPackageArchiveInfo(path, 0)`) and refuses anything that is not the running app's (`wrong-app`); the certificate is then checked by Android itself, because the package names match. An unreadable file is refused too.

## Recommendation (before the decision)

**D, as a small follow-up package; until then C (accept for 1.0).** Replacing Nemo itself needs the Android signing key, so the data stays safe; what is open is a foreign second app offered through Nemo's own update dialog. D closes that without touching keys or the release job. A and B only protect the digest and touch the updater key (hard limit); worth it only if updates ever come from a second host.
