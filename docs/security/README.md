# Security reports

Rules live in root `CLAUDE.md` and [../RULES.md](../RULES.md); reporting path for outsiders: [../../SECURITY.md](../../SECURITY.md). Alert handling recipe: [../howto/release-deps.md](../howto/release-deps.md).

| File | Date | What |
|---|---|---|
| [AUDIT-2026-09-30.md](AUDIT-2026-09-30.md) | 2026-09-30 | read-only audit of backup, sync, data protection |
| [VAULT-EXTENSION.md](VAULT-EXTENSION.md) | 2026-10-01 | threat model of the browser extension and the vault bridge |
| [FINDINGS-2026-10-01.md](FINDINGS-2026-10-01.md) | 2026-10-01 | open code-scanning/Dependabot alerts and their handling |
| [LAUNCH-REVIEW-2026-10-06.md](LAUNCH-REVIEW-2026-10-06.md) | 2026-10-06 | read-only launch review of all security areas, privacy comparison, phase-2 plan |
| [DEPS-AUDIT-2026-11-08.md](DEPS-AUDIT-2026-11-08.md) | 2026-11-08 | read-only review of dependency advisories on `develop` (cargo/npm audit), real vs. dev-only, proposals |
| [LAUNCH-REVIEW-2026-11.md](LAUNCH-REVIEW-2026-11.md) | 2026-11-21 | launch review 2 at `7ef17176`: verdict per channel, the areas new since October, status of the old findings, network inventory; packages 1–11 merged (2026-11-23), open items and proposals marked in the rows |
| [CODEQL-ERRORLOG-2026-11-22.md](CODEQL-ERRORLOG-2026-11-22.md) | 2026-11-22 | CodeQL clear-text-storage alert on `errorLog.ts`: cross-program false positive, short labelled secrets now scrubbed |
