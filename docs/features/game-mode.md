# Zock-Modus – leise Erinnerungen im Spiel

Ziel: Läuft ein Vollbild-Spiel (oder eine Präsentation), kommt eine Erinnerung ohne Windows-Ton, dafür mit einem kurzen, leichten Ton der App. Sonst bleibt alles wie es ist. Alles geräte-lokal (`localStorage` `tm-game-mode`), nichts verlässt das Gerät.

## Teile
| Was | Wo |
|---|---|
| Erkennung (ein Ja/Nein) | `crates/system-info/src/gaming.rs` → `SHQueryUserNotificationState`: Zustände 2 beschäftigt, 3 D3D-Vollbild, 4 Präsentation; Befehl `system_game_active` (`src/system.rs`) |
| Native Tonausgabe | `crates/system-info/src/tone.rs`: Noten + Lautstärke → WAV im Speicher → `PlaySoundW` (`SND_MEMORY\|SND_SYNC`, eigener Thread); Befehl `system_play_tone` |
| Befehle freigeben | `build.rs` `COMMANDS` + `capabilities/desktop.json` (nur Desktop) |
| Zugriff aus dem Frontend | `getPlatform().desktop.gameActive?()` / `playTone?()` (`core/platform/tauri/desktop.ts`) |
| Zustand, Schalter | `core/notifications/gameMode.ts`: `off` / `auto` (Desktop: Erkennung) / `on` (manuell), Ton, Lautstärke |
| Zustellung | `core/notifications/gameDelivery.ts` `withGameDelivery` (im Scheduler um den Plattform-Dienst gelegt): Spiel → `show({quiet:true})` + Ton; „Stumm“ (`quiet`) bleibt stumm |
| Ton (Web Audio) | `core/notifications/sound.ts`: drei Klänge (Sanft, Glocke, Tropfen), synthetisiert, kein Asset |
| Android / PWA | kein Ton, keine Erkennung: Schalter „An“ → `policy.ts` `quietAll` (über `collect.ts`) → Kanal `nemo-quiet` bzw. `silent` |
| Einstellungen | Einstellungen → Benachrichtigungen → „Zock-Modus“ (`pages/settings/GameModeCard.tsx`, Texte `strings.gamemode.ts`) |

## Wo der Ton abgespielt wird (Prüfung)
- **Fenster sichtbar:** Web Audio. Läuft der `AudioContext` nach `resume()` nicht an (Autoplay-Regel: ohne vorherigen Klick bleibt er `suspended`), wird nach 250 ms auf Rust gewechselt.
- **Fenster unsichtbar (Tray, minimiert, vom Spiel verdeckt):** Rust (`PlaySound`). Grund: WebView2 gibt dort keine Garantie – versteckte Seiten drosseln Timer (30-s-Intervall des Schedulers wird bis zu ~1 min spät), und ein Kontext ohne Nutzerklick startet nicht. Die Rust-Seite hängt von beidem nicht ab. Der Test unter Handtest Z2 klärt, was ein echtes Gerät tut; das Ergebnis gehört hierher.
- Die Erinnerung selbst kommt bei verstecktem Fenster mit bis zu ~1 min Verzögerung (Timer-Drosselung); unverändert, nicht Teil dieses Pakets.

## Datenschutz
Die Erkennung liefert nur Ja/Nein von Windows selbst. Keine Prozessliste, keine Fenstertitel, kein Name eines Spiels, nichts wird gespeichert oder gesendet. Der Ton enthält keine Nutzerdaten (Noten, Lautstärke).

## System-Ton von Windows
Nach dem Quelltext (`tauri-plugin-notification` 2.5 → `notify-rust` 4.18 → `tauri-winrt-notification` 0.8) setzt die App keinen `sound`; dann schreibt die Toast-XML `<audio silent="true"/>`. Die Windows-Toasts der App sind also schon ohne Systemton; der Zock-Modus fügt nur den eigenen Ton hinzu. Handtest Z1 bestätigt das am Gerät.
