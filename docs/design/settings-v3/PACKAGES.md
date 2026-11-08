# Settings identity v3.1 – next packages

Package 1 (blocks, Einrichtung tab, Schnellerfassung, large tabs via blocks): [ROUND-1.md](ROUND-1.md), branch `design/settings-identity`. Each package below is its own branch and PR from fresh `develop`.

## Package 2 – the remaining tabs (`design/settings-identity-2`) – built, see [ROUND-2.md](ROUND-2.md)

**DE (Prompt):**

> Einstellungen auf Identity v3.1, Paket 2: die übrigen Reiter. Branch `design/settings-identity-2` von frischem `develop`. Lies `docs/design/settings-v3/ROUND-1.md` (Variante B, Bausteine) und MODULE-IDENTITY „Settings and libraries“. Nutze nur die Bausteine aus Paket 1: `pages/settings/components/{SettingsHead,StatusCard}`, `@/ui` `SettingsGroup plain`, `SettingRow` mit `hint` (ⓘ), `ConnectParts` (`StateBanner` = `StatusCard`, `Step` ohne Nummer). Reiter: Allgemein, Darstellung, Barrierefreiheit, Module, Werkzeugkasten, Benachrichtigungen (zwei Zustandskarten → eine getönte, Push `tinted={false}` ist schon so), Sicherheit, Verbindungen (sehr lang: Teilen und Lokale Schnittstelle als eigene Gruppen mit Überschrift, je Karte höchstens ein Knopf gefüllt, „Verbinden“ ist schon sekundär), Updates, Entwickler. Je Reiter: höchstens eine gefüllte Primäraktion, keine Wiederholung, Schalter mit Unterzeile (ein Satz), lange Erklärungen hinter ⓘ, Kartenstapel → `plain`-Gruppen. Inhalte anderer offener Branches (`chats:status`) nur über die Bausteine. Vorher/Nachher 1920/412 hell/dunkel mit `docs/design/settings-v3/tools/shots.spec.ts` (`SHOTS_PREFIX=before|after`), Zahl der gefüllten Knöpfe je Reiter aus der Spec-Ausgabe. Abnahme: `check`, `test`, `check:i18n`, `e2e` (Einstellungs- und a11y-Specs) grün; Texte in allen Sprachen.

**EN:**

> Settings on identity v3.1, package 2: the remaining tabs. Branch `design/settings-identity-2` from fresh `develop`. Read `docs/design/settings-v3/ROUND-1.md` (variant B, blocks) and MODULE-IDENTITY "Settings and libraries". Use only the package 1 blocks (`SettingsHead`, `StatusCard`, `SettingsGroup plain`, `SettingRow hint`, `StateBanner`/`Step`). Tabs: Allgemein, Darstellung, Barrierefreiheit, Module, Werkzeugkasten, Benachrichtigungen (one tinted card), Sicherheit, Verbindungen (share and local API as headed groups, at most one filled button per card), Updates, Entwickler. Per tab: at most one filled primary, no repetition, one-line sub-lines, long text behind ⓘ, card stacks → plain groups. Other branches' content only through the blocks. Before/after shots with `tools/shots.spec.ts`. Acceptance: `check`, `test`, `check:i18n`, `e2e` (settings, a11y) green; texts in every language.

## Package 3 – navigation and search of the settings (`design/settings-nav`)

**DE (Prompt):**

> Einstellungen auf Identity v3.1, Paket 3: Navigation und Suche. Branch `design/settings-nav` von frischem `develop`. Heute: Suchfeld, Schnellleiste (Farbschema, Dichte, Lesehilfe, Profil, Ruhe), dann Kategorie-Liste und Kopf – drei Bänder, bevor der Inhalt beginnt (`shots/after-*-1920-*`). Ziel: Suche und Schnellleiste in eine Zeile oder in den Kopf des Überblicks, Kategorie-Liste mit Zustandswort (`CategoryStatus`) und Fortschritt der Einrichtung („4 von 9“) statt Punkt; Telefon: Liste ohne Doppelung der Köpfe. Keine Änderung an der Registry-Reihenfolge außer begründet; Deep Links (`settingsPath`, `#section--field`) und `legacyTarget` bleiben. Zwei Varianten nur in einem Punkt als HTML-Mockup (`settings-v3/mockups/render.mjs`), Empfehlung in 3 Sätzen, umsetzen. Abnahme wie Paket 2, dazu `e2e/settings.spec.ts` (Suche, Deep Link, Palette).

**EN:**

> Settings on identity v3.1, package 3: navigation and search. Branch `design/settings-nav` from fresh `develop`. Today search field, quick bar and category list stack three bands above the content. Goal: search and quick bar in one row (or in the overview head), the category list with the state word (`CategoryStatus`) and the setup progress ("4 of 9"); on the phone no doubled heads. Registry order, deep links and `legacyTarget` stay. Two mockup variants that differ in one point, a three-sentence recommendation, build it. Acceptance as package 2 plus `e2e/settings.spec.ts` (search, deep link, palette).

## Open from package 1 (for the owners)

- KI: the "KI-Assistent" card renders empty while its values load (`before-ki-1920-light.jpg`) – `fix/local-model-clarity`.
- Sync page rebuild – `design/sync-lan-concept` (status card and headed groups are in place to build on).
- `tSettingsConnect.quickCapture` (the old numbered-step texts) was removed in five languages with package 1.
