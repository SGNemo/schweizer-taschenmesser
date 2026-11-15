# Merkliste – role and plan (round "Tiefe & Politur", 2026-11)

Maintainer: "Merkliste ist nicht polished genug, mir fehlt der Sinn." This file fixes the role first, then the packages. Decisions: [decisions/modules-bookmarks.md](../../decisions/modules-bookmarks.md).

## Role (two sentences)

**Die Merkliste sammelt, was du dir noch anschauen, lesen, kaufen, ausprobieren oder besuchen willst – mit Vorschau, Sammlung und einem Weg in den Plan. Jeder Merkzettel hat ein Ende: erledigt oder weg; was du immer wieder brauchst, liegt im Tab „Lesezeichen“.**

| Neighbour         | It holds                                | The Merkliste differs                                                                                                                           |
| ----------------- | --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Notizen           | what I know or wrote myself             | things from outside I have not got to yet                                                                                                       |
| ToDos             | what I must do, with a date             | what I would like to do; no date, no "überfällig", it goes into the plan only when I say so                                                     |
| Browser bookmarks | every address, for ever, on one browser | few things with an end, on every device; the tab "Lesezeichen" holds the handful of links used daily and says it does not replace the browser's |
| Read-later apps   | articles only                           | also films, books, places, things to buy or try – one list for "sometime"                                                                       |

Words (QA CONSOLIDATED §"ein Wort je Konzept", Lena, Sofía): **Merkliste** = the module, **Merkzettel** = one entry, **Lesezeichen** = the permanent links of the second tab. No other word.

## Checked against the persona rounds (`docs/qa/**`)

Method: read CONSOLIDATED (7 personas), round 5 (persons A–D), round 6 (reviewers, tour). Limit: every round tested in the browser with seed data; nobody was asked about the Merkliste.

- **Nobody names a use.** 0 of 11 personas mention the Merkliste as a reason to stay or leave; the only persona finding is the three words for one thing (Lena, Sofía). Observation, read as: the page does not say what it is for (the maintainer's point).
- **It looks like its neighbour.** Reviewer 3 (R36): same hue and head as Unterlagen, the pinboard mark shows empty tiles, all 31 seed entries sit under "Heute".
- **Calm, literal, few decisions.** Person A reads every text literally and leaves when a text claims too much; person C gives an app two minutes; Jonas wants no growing counters. So: say plainly what the page is not (no browser replacement), no "31 offen" as a debt, one next thing instead of a backlog.
- **Friction list #15:** a row opened the editor, the link was a tiny icon (fixed since: the title is the link).

Consequences: a Merkzettel goes into the plan only by choice; the widget offers three things, not a count; the empty state and the links tab say honestly what belongs here.

## State before (develop, 2026-11-15)

Kinds link/read/watch/book/place/idea/other; tags (filter in the "⋯" menu); status open/started/done; list or pinboard cards; link preview only with a setting (off), fetched on every save; reader mode; share target and quick capture (`m `, URL) write kind `link`; duplicate check only for `bookmark.requested`; widgets "last four" and link tiles; not plannable.

## Packages (stacked branches, one PR each against `develop`)

| #   | Branch                      | What                                                                                                                                                                         | Schema                                                  |
| --- | --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| 1   | `feat/bookmarks-purpose-p1` | Role in the texts (description, empty states, honest line on the links tab), kinds "Kaufen" and "Ausprobieren", the grouping (by first tag = "Sammlung") is a stored setting | `manifest.version` 3 (two enum values, no-op migration) |
| 2   | `-p2`                       | Capture: duplicate hint in the editor and on share, kind from the first word ("m film Dune"), preview on a click ("Vorschau holen") and for a shared link                    | none                                                    |
| 3   | `-p3`                       | "In den Plan" (`contributions.plannable`, only entries the person marked), widget "Als Nächstes" (three things; "Fürs Wochenende" from Friday)                               | optional field `inPlan`                                 |

Order 1 → 2 → 3; each is mergeable on its own after the one before.

## Not built (with reason)

- Tag chips on the page: focus audit 2 moved every filter into the page menu on purpose (`e2e/bookmarks.spec.ts` pins it); the grouping by first tag is the collection view and now stays.
- Seed spread over weeks (R36 "all under Heute"): seed rows carry no `createdAt`; a loader change is outside this module.
- Own "Sammlung" entity (table, order, cover): tags already group and filter; a second grouping would be a decision per entry (FOCUS "fewer decisions"). Revisit if tags prove too flat.
- Reminder per Merkzettel: the plan is the reminder; a second notification path would need its own switch and limits.
- Head change against Unterlagen (R36): a module-identity decision (CHATS "waits on the maintainer" #485).
