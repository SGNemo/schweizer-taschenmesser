# Person A – Follow-ups (nicht gebaut)

## F1 Android-Widget „Heute“ für das Außendisplay (A12)

**Warum:** Auf dem zugeklappten Flip (Außendisplay 720 × 748 px, ≈ 320 × 332 CSS-px) läuft die App zwar ohne Querscrollen, zeigt aber nur Kopf, Begrüßung und Leiste; der „+“-Knopf liegt über „Ruhig/Ausführlich“, im Assistenten ist „Weiter“ erst nach Scrollen erreichbar ([shots/after-13-cover-display.jpg](shots/after-13-cover-display.jpg)). A will dort nur sehen: Wetter jetzt und die drei Dinge von heute. One UI erlaubt auf dem Außendisplay Widgets, keine Vollbild-Apps (außer per Labs-Schalter).

**Was es gibt:** Keine eigene „Local-Widget-Schnittstelle“ für Android. Am nächsten dran ist der Tray-Snapshot der Windows-App (`web/src/core/platform/tauri/traySnapshot.ts` → Rust `desktop_set_tray_today` in `src-tauri/src/capture.rs`): höchstens 5 Zeilen, nur ToDos + Kalender, nie Beträge, Tresor oder Notizinhalte, Klick = Index → Route. Dieses Muster passt 1:1.

**Paket-Schnitt (je eigener Branch/PR, Stopp dazwischen):**

1. `feat/android-today-snapshot` (S–M, nur Web + Plattform-Naht): Snapshot-Bau aus `traySnapshot.ts` in `core/today/snapshot.ts` herauslösen (gemeinsam für Tray und Widget), Wetter-Zeile aus `core/weather/cache.ts` (nur Symbol, Temperatur, kein Ort im Klartext), höchstens 3 Zeilen ToDo/Termin. Neue optionale Plattform-Methode `today.publish(snapshot)` in `core/platform/types.ts` (Hotspot: eine Zeile CHATS.md vorher), Web = no-op. Tests: Snapshot ohne Beträge/Notizen/Tresor (Negativliste wie Tray).
2. `feat/android-today-widget` (M–L, Kotlin): neues Tauri-Plugin `src-tauri/plugins/today-widget/android` mit `AppWidgetProvider` + `RemoteViews` (Layout für 2×2 und Außendisplay-Größe, `widget_info.xml` mit `widgetCategory="home_screen|keyguard"`), Daten aus einer `SharedPreferences`-Datei, die `today.publish` schreibt (kein Netz, kein Content-Provider nach außen). Tipp auf eine Zeile → `Intent` mit Route in die App (wie die Share-Intent-Kurzbefehle). Aktualisierung: beim Schreiben + `updatePeriodMillis` 30 min, kein eigener Alarm.
3. `docs/android-today-widget` (S): MANUAL-TESTS-Zeilen (Flip zugeklappt, Hell/Dunkel, Sperrbildschirm), User-Doku de/en.

**Risiken:** (a) Sperrbildschirm/Außendisplay zeigt ToDo-Titel ohne Entsperren – Schalter „Auf dem Sperrbildschirm zeigen“ standardmäßig **aus**, Titel kürzen wie Tray; (b) `gen/android` wird bei `tauri android init` neu erzeugt – Code nur im Plugin, nichts in `gen/` von Hand; (c) Samsung-spezifische Außendisplay-Widgets brauchen evtl. ein eigenes Metadaten-Feld (`com.samsung.android.appwidget.provider`) – auf dem Gerät prüfen; (d) Release-Signing und Bundle-Id bleiben unverändert.

**Prompt-Skizze (Paket 1):**

> Branch `feat/android-today-snapshot` von develop. Ziel: ein gemeinsamer „Heute“-Snapshot für Tray (Windows) und ein späteres Android-Widget. Löse den Bau aus `core/platform/tauri/traySnapshot.ts` in `core/today/snapshot.ts` heraus (Tray-Verhalten unverändert, Tests grün), ergänze eine optionale Wetter-Zeile aus dem Wetter-Cache und begrenze für das Widget auf 3 Zeilen. Neue optionale Plattform-Methode `today.publish` (Web: no-op; vorher Hotspot-Zeile in CHATS.md). Negativ-Test: keine Beträge, keine Notizinhalte, kein Tresor. Keine Kotlin-Arbeit in diesem Paket. Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text

## F2 Gezählte Schritte ändern sich ohne Zutun an der Einrichtung (A11)

„2 von 10“ am ersten Tag, „2 von 9“ am nächsten: `core.migrate` gilt nur für eine leere Installation (`migrateStepApplies`, `core/setup/migrate.ts:225`) und fällt nach der ersten eigenen Notiz aus der Liste. Vorschlag (S, `core/setup/**`, demo-a-Besitz, nach dieser Runde): einmal angezeigte Schritte bleiben in der Zählung, bis sie erledigt oder ausgeblendet sind, oder die Checkliste sagt in einem Satz, warum ein Schritt weggefallen ist.

## F3 Planer im Einrichtungsweg (Frage an Sven, siehe PR)

Das Modul „Planer“ (verteilt ToDos auf Tage) ist standardmäßig aus und in keinem Profil. A sucht „Planung“ und landet über „Planen“ bei Kalender/ToDos – das reicht für seine Aufgaben. Ob der Planer in „Alltag“/„Studium“ gehört, ist eine Produktentscheidung.
