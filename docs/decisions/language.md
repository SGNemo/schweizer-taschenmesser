# Decisions – languages (docs and UI)

Index: [DECISIONS](../DECISIONS.md).

- **Docs source language is English; README and user docs also German** – 2026-10-06. The repo goes public for international visitors; German users keep full user docs. German copies sit next to the source as `*.de.md` (`README.de.md`, `docs/user/<name>.de.md`, `docs/AI-IMPORT.de.md`) instead of a `docs/de/` tree, so relative links keep their depth and pairs are easy to compare. `npm run check:readme` (CI job `docs-pairs`, blocking) keeps headings, `<details>`, links and images in step. Developer docs are English only; German stays where it is internal or legal (STATUS "Offen – macht Sven", MANUAL-TESTS, `legal/`, `design/FOCUS-WORDING.md`, archive). Rejected: `docs/de/` mirror (deeper links, harder pairing), English only (German users are the current audience).
- **Brand claim per language: "Notes · Events · Modules · Offline" / "Notizen · Erinnerungen · Module · Offline"** – 2026-10-06. Keeps the NEMO backronym; `gen:icons` renders English images under the existing names and German copies as `*.de.png`; the German-default website keeps the German OG image.
