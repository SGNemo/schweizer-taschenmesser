# Persona D – Daniel, Systemintegrator

Round 5 (Erstkontakt, allein). Sven's facts are unmarked; everything marked *(A)* is an assumption of this chat.

## Who
- Systemintegrator at Siemens: commissions plants, configures PLCs and networks, writes test protocols. Thinks in "what is connected to what, and who talks to whom".
- *(A)* 34, lives with his partner; two devices in daily use: a Windows 11 desktop at home (1920 × 1080, dark taskbar, light apps) and a Samsung Galaxy (One UI, Android 14, 412 px wide, dark mode at night).
- Very tidy: folders with numbered prefixes, tags, file names with dates (`2026-11-08_…`).
- Uses note apps and "much more" – *(A)* Obsidian today (vault on the PC, ~600 Markdown notes in folders, YAML front matter with `tags:`, `[[links]]`), synced to the phone by a third-party plugin he does not trust.
- Will probably **not** look at the code. He will look at the network tab and at what the app *says* it does.

## Patience and what annoys him
- Patient while he is in control, impatient as soon as something happens he did not ask for.
- *(A)* Annoyed by: apps that phone home without saying so, "cloud account required", sync that silently duplicates or loses notes, imports that flatten his folder tree, timestamps that change on import, vague status ("Synchronisiert" without when/what), different words for the same thing in different screens.
- *(A)* Likes: a list he can check against reality (network tab, Wireshark), deterministic behaviour, export formats he can read in a text editor.

## Goal of the first 15 minutes alone
Find out whether Nemo can replace his note app + sync plugin **without the cloud**: PC and phone keep the same notes over his home Wi-Fi, nothing leaves the house, and he can get his data out again at any time.

## Three tasks he must manage without help
1. **Pair PC and phone** (QR on the PC, the phone scans) and see one note on both.
2. **Backup → delete app data → restore**, and the result is identical (same notes, folders, dates).
3. **Import notes from his current app** (Markdown/Obsidian export, fixture `web/e2e/fixtures/obsidian-d/`) and find them again tidily sorted (his folders, his tags).

## Personal disturbance (how he tests trust)
- Network tab open for 10 minutes of normal use: every request logged. Expectation: only the update check and, if switched on, AI.
- Phone out of the Wi-Fi and back: what happens, what does the app show.
- Two windows at the same time.
- System clock moved.
- Change the language with a dialog open.
- Read the diagnostics report: anything private in it?

## What would please him (from Sven's list, judged against the persona)
- A settings page "Was geht ins Netz" with the actual list, derived from the code and tested.
- Export as readable JSON with a schema hint; importing the same export is lossless.
- Sync state in one sentence ("Zuletzt mit PC abgeglichen: vor 2 Min, 14 Änderungen").
- Consistent naming across settings, setup and help.
