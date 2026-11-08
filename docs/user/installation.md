**English** | [Deutsch](installation.de.md)

# Installation

Nemo comes as a portable Windows file, as an Android app and as a PWA in the browser. The download links always point to the latest **stable** version. Pre-releases (beta) are on the [releases page](https://github.com/SGNemo/schweizer-taschenmesser/releases).

- **Windows:** [Nemo-Portable.exe](https://github.com/SGNemo/schweizer-taschenmesser/releases/latest/download/Nemo-Portable.exe)
- **Android:** [Nemo.apk](https://github.com/SGNemo/schweizer-taschenmesser/releases/latest/download/Nemo.apk) (checksum: [Nemo.apk.sha256](https://github.com/SGNemo/schweizer-taschenmesser/releases/latest/download/Nemo.apk.sha256))

## Windows: a single file, no installation

1. Download `Nemo-Portable.exe`, put it anywhere you can write to
   (for example a folder in your user directory; **not** `C:\Program Files`) and double-click it.
2. Windows may show "Windows protected your PC" (SmartScreen), because unknown `.exe` files without a purchased
   code-signing certificate are always treated this way: **"More info" → "Run anyway"**. The update payload is signed
   with the project's update key; the app checks the signature itself before every update (and refuses unsigned or
   foreign-signed files). If Windows shows **Smart App Control** instead, with no "Run anyway", it does not allow
   unsigned apps at all; more on this and every click including the Edge download warning: [step by step](https://nemo-adhd-helper.online/en/install) ([Deutsch](https://nemo-adhd-helper.online/install)).
3. **Requirement: Microsoft WebView2.** On Windows 10/11 the component is usually already there (it ships with Edge).
   If it is missing, the app explains this in a window and can open the
   [download page](https://developer.microsoft.com/microsoft-edge/webview2/) ("Evergreen Bootstrapper").
4. **Updates:** Settings → Updates. The app first makes a backup copy, downloads the new `.exe`, checks the
   signature, replaces itself and restarts (if anything fails, the old version stays).
   The folder of the `.exe` needs write access for this.
   Note: version 0.2.x (named "Taschenmesser") can no longer update itself, because new releases no longer contain `Taschenmesser-…` files. Download and install the current `Nemo-Portable.exe` or `Nemo.apk` once (bring your data along via backup or sync).
5. **Where is my data?** By default in your user profile (`%LOCALAPPDATA%\io.github.sgnemo.taschenmesser`), not
   next to the `.exe`, so you can replace or move the file at any time. **Portable mode (for example a USB stick):**
   put an empty folder `data` next to the `.exe` and the app data lives there instead of in your profile (the
   automatic update backups stay in `%APPDATA%`).
6. **Tray icon:** a right-click shows "Today" at the top: up to 5 things of today (title and time only, never amounts); a click opens the entry. Can be turned off under Settings → Quick capture.

**Switching from the installed version (Setup/MSI, up to `0.2.0-beta.1`):** the portable app uses the same
app id and therefore finds your data in your profile right away.
1. In the old app: Settings → Backup → export (safety copy).
2. Start `Nemo-Portable.exe` and check that everything is there (do not run it at the same time as the old app).
3. Uninstall the old version via "Apps & features". In the uninstall window, do **NOT tick "Delete application
   data"**. If something is missing after all: import the backup in the new app.
The old installed version cannot update itself to the portable file; the switch is a one-time manual step.

## Installing on Android

1. Download `Nemo.apk` on your phone (for example in Chrome) and open it.
2. The first time, Android asks whether **installing from unknown sources** is allowed: **"Settings" →
   "Allow from this source"** for the browser or the files app, then go back and tap "Install". Play Protect
   may offer an extra check ("Install anyway" or "Scan app"). If **Auto Blocker** on newer Samsung phones blocks
   the installation: Settings → Security and privacy → Auto Blocker off, install, turn it back on (while it is on,
   updates from inside the app fail too).
3. For later updates open Settings → Updates and tap "Update now": the app downloads the update, checks its checksum and hands over to
   Android's installer (if asked, allow installing from this source). The new APK must be signed with the same
   key, otherwise Android rejects it.

> **Bringing data over from the PWA:** the installed app has its own storage. Move your data via *Settings → Backup*
> (export in the PWA, import in the app) or simply via the sync server.

## Installing as a PWA
Open Chrome/Edge (Windows) or Chrome (Android) → "Install app". Service worker and installation need
HTTPS (or `localhost`).

## Moving from another app
**Settings → Sync & Backup → Move from another app → Start moving** (also from the command palette, "Import from another app"). Three steps on one sheet:
1. **Where are you coming from?** Google, Apple, Microsoft, Todoist, TickTick, Notion, Evernote, Obsidian/Markdown, bank statement, password manager, browser bookmarks, or "I don't know". Nemo says where to get the export.
2. **Files:** choose the files or the ZIP as it is (Google Takeout, Todoist backup, Notion export). They are read on this device only.
3. **Check:** Nemo shows what it recognised, why, how sure it is and how much ("Todoist (CSV) · 3 projects · 214 tasks"). Then the usual preview per area: new entries, already there, not readable, and what stays out and why.

Repeats (Todoist "every Monday", TickTick repeats) and planned durations become real repeats and effort estimates. Every move can be undone as a whole: in the summary after a move with several parts, or later under **Recent moves** on the same card; entries you changed since stay. Passwords are only imported in the vault, with your master password. The **Checklist** button keeps the list of what is still missing per origin. All of it is optional.

## Dev preview (untested builds)

After a green push to `develop` that changes code, GitHub automatically builds a preview (Windows portable and Android APK). It is meant for testers and may contain bugs.

- **Separate app, separate data.** The dev preview is called "Nemo Dev" and runs next to the stable app. The stable app's data is not there; bring it over via sync or backup. On Windows it has its own data folder (portable: folder `data-dev` instead of `data` next to the exe).
- **Download:** [Windows](https://github.com/SGNemo/schweizer-taschenmesser/releases/download/dev-preview/Nemo-Portable-dev.exe) · [Android](https://github.com/SGNemo/schweizer-taschenmesser/releases/download/dev-preview/Nemo-dev.apk). A "Dev" badge in the app shows that it is the preview.
- **Updates:** the dev preview always follows the dev channel (Settings → Updates) and makes a backup copy before every update. The stable app never offers a dev preview.
- **Back to the stable version:** the stable app is a separate program. Keep using it or reinstall it; you can simply delete the dev preview.
