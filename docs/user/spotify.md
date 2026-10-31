# Spotify: "Now playing" on the Overview

Nemo can show what is playing in Spotify as one quiet line on the Overview and offer Pause/Resume and Next. Nemo does not play music itself. Works in the Windows app and in the installed PWA (browser) – not in the Android app yet.

You need your own free Spotify "app" – a few minutes, once:

1. Open the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) and sign in with your Spotify account (accept the developer terms).
2. **Create app.** Any name and description. Under *Redirect URIs* add exactly `http://127.0.0.1:38417/callback` (not `localhost`, no trailing slash). Under *APIs used* tick **Web API**. Save.
3. Open the app → *Settings* → **User management** and add your own Spotify account (name and the e-mail of that account). Apps in development mode only work for accounts listed there.
4. Copy the **Client ID** (not the secret – Nemo does not need it).
5. In Nemo: *Settings → Connections → Spotify*, paste the Client ID, save. Choose **Show** (what is playing) and, if you like, **Control** (Pause, Resume, Next).
6. Click **Connect**. Your browser opens Spotify (in the PWA the page itself goes to Spotify and comes back); allow access. Nemo then shows "Now playing: …" on the Overview whenever something plays.

In the **PWA** (browser or installed from the browser) the Redirect URI is different: Nemo shows it on the Spotify card – it is your Nemo address plus `/oauth/callback`, for example `https://your-nemo-address/oauth/callback`. Register exactly that one in step 2 (an additional entry is fine, you can keep the Windows one). It must be an `https://` address; `http://localhost` is not accepted by Spotify.

**The player** (tap the "Now playing" card on the Overview): your library on the left (liked songs, recently played, queue, search, every playlist), the opened list in the middle with all its songs, and a bar at the bottom with what plays, the controls, volume and the device.
- A tap on a **playlist** opens its songs – nothing plays until you tap a song or "Play". A tap on a song plays it inside its playlist.
- **♥** saves a song to your liked songs (or removes it). **⋯** adds it to the queue, hides it in this list or opens it in Spotify.
- **Hide:** a hidden song disappears from the list in Nemo only; at Spotify nothing changes. "Play" skips hidden songs. "Show hidden" brings them back.
- Extra permissions are opt-in when connecting: *Playlists*, *Liked songs* (read **and** save) and *Recently played*. If you connected earlier, tick them under Connections → Spotify and connect again.

Good to know:
- Controlling needs Spotify **Premium**. Without it Nemo hides the buttons once, with one short note; the display keeps working.
- "Port in use": another program uses port 38417. Close it and click Connect again – Nemo never picks another port, because Spotify checks the address exactly.
- Optional: **Music in the focus round** (Settings → Focus & attention → More settings, off by default; needs *Control*). Nemo can keep playing at the start or start one of your playlists (tick *Playlists* when connecting), and pause at the end. It only touches Spotify at the start and the end of a round; if that fails the round carries on normally.
- Tap the card on the Overview to open the **player**: previous / pause / next, shuffle, repeat, position and volume, and your **playlists**, your **liked songs** (tick *Liked songs* when connecting) and a **search**. Playing needs *Control* and Premium. You can switch the card off under *Customize → Cards → Now playing (Spotify)*. The cover picture comes from Spotify's image server; the search words go to Spotify only.
- Nemo asks Spotify about every 30 seconds, only while the app is open and visible. Title and artist stay on this device: no sync, no AI, no error reports.
- Disconnect any time under *Connections → Spotify*; you can also remove the app's access in your Spotify account.
- Spotify may change its rules for developer apps; if the connection stops working, check the dashboard first.
