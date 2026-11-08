# Nemo – docs index

Chats: start with root [CLAUDE.md](../CLAUDE.md), then load only the row you need. Budgets: [meta/DOCS-GUIDE.md](meta/DOCS-GUIDE.md).

## Developer docs (English)
| File | What | Read when |
|---|---|---|
| [ARCHITECTURE-MAP.md](ARCHITECTURE-MAP.md) | where things live (paths, interfaces, data flow) | locating code |
| [architecture.md](architecture.md) → [architecture/](architecture/) | design notes by topic (core, sync, ai, native, releases, vault, importer, local-api, connectors, …) | changing that area |
| [RULES.md](RULES.md) | hard rules, unabridged (root has the short list) | touching data, security, modules, platform |
| [DECISIONS.md](DECISIONS.md) → [decisions/](decisions/) | index of areas; one bullet per decision in the area file | asking "why" |
| [HOW-TO.md](HOW-TO.md) → [howto/](howto/) | commands, tests, recipes (module, tool, connector, CI, release, gotchas, …) | doing a known task |
| [STATUS.md](STATUS.md) | next one thing, 15-minute tasks, current release, open, known limits, "Offen – macht Sven" (German) | planning, hand-over |
| [MANUAL-TESTS.md](MANUAL-TESTS.md) | hardware checklists (German) | device testing |
| [ROADMAP.md](ROADMAP.md) | ideas, not built | proposing features |
| [CHATS.md](CHATS.md), scribble (`/workspace/scribble/`, private repo nemo-scribble) | running work, hotspots, hand-over | first and last step of every chat |
| [PROMPT-TEMPLATES.md](PROMPT-TEMPLATES.md), [meta/WORK-ROUTING.md](meta/WORK-ROUTING.md) | prompt blocks; Claude Code or agents? | writing a prompt |
| [meta/](meta/) | docs guide, audit reports | changing docs |
| [i18n/](i18n/README.md) | app languages: status of the translations, glossary, how to help | changing UI text |
| [legal/](legal/) | checklists for the maintainer (not legal advice), e.g. supporter mode | donations, privacy notices |
| [security/](security/), [perf/](perf/), [features/](features/) | reports and feature notes (each has an index) | that topic |
| [archive/](archive/) | historical reports (hidden from scans) | history only |
| [product/](product/), [design/](design/) | module plan (German), design spec, mockups, prompts; [FOCUS-GUIDELINES](design/FOCUS-GUIDELINES.md) = checklist for every new feature | module/design work, new features |
| design-proposals/, brand/, screenshots/ | images and token experiments | design work |

## For users (English; German copies `*.de.md` next to each file)
[installation](user/installation.md) · [modules](user/modules.md) · [ai-assistant](user/ai-assistant.md) (+ [AI-IMPORT.md](AI-IMPORT.md)) · [sync](user/sync.md) · [backup](user/backup.md) · [security](user/security.md) · [faq](user/faq.md) · [spotify](user/spotify.md) · [browser-extension](user/browser-extension.md) · [development](user/development.md)
