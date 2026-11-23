# S13 – where the Android update's authenticity comes from (decision paper)

Launch review 2026-11, finding S13 (medium, recommendation: accept). Package 4 builds nothing here; this page is the basis for Sven's decision.

## Today

The app finds the release on GitHub, reads the expected SHA-256 from the release asset `Nemo.apk.sha256`, and the installer plugin downloads the APK only from this repository's releases (`plugins/apk-installer/src/validate.rs`), checks the digest, then hands it to Android. The `.sha256` file is unsigned: anyone who can change the release (or break TLS to github.com) can change both files. What stops a foreign APK is Android: an update must be signed with the same certificate as the installed app, otherwise the system refuses it and the app and its data stay.

## Three ways

| Way | Effort | What it buys | Costs and risks |
|---|---|---|---|
| A. Digest in a signed manifest (like `latest.json` for the desktop, minisign) | M: release job writes `android` into the signed manifest, app verifies the minisign signature before trusting the digest | the digest no longer rests on GitHub + TLS alone | touches `release.yml` and the updater key (hard limit: Sven); the key then guards both platforms |
| B. `.apk.sig` with the updater key, verified in the plugin | M: one more release asset, Rust verify in the plugin (as `portable.rs`) | the same as A, without changing the manifest | same hard limit; a second asset that can go missing (update stops, fails closed) |
| C. Leave as is | none | – | a GitHub account or TLS break can offer an APK the OS then refuses unless it carries the release certificate; that needs the Android keystore too |

## Recommendation

**C, accept for 1.0.** An attacker must already hold the Android signing key to get anything installed; with that key, A and B add little (they guard against a changed digest, which Android's own check already catches). Revisit if updates ever come from a second host or if the signing key moves to a less protected place. If Sven prefers defence in depth, **A** is the better of the two (one signed source of truth for both platforms).
