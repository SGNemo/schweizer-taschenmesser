# Spotify: "Now playing" on the Overview

Nemo can show what is playing in Spotify as one quiet line on the Overview and offer Pause/Resume and Next. Nemo does not play music itself. Windows app only for now.

You need your own free Spotify "app" – a few minutes, once:

1. Open the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) and sign in with your Spotify account (accept the developer terms).
2. **Create app.** Any name and description. Under *Redirect URIs* add exactly `http://127.0.0.1:38417/callback` (not `localhost`, no trailing slash). Under *APIs used* tick **Web API**. Save.
3. Open the app → *Settings* → **User management** and add your own Spotify account (name and the e-mail of that account). Apps in development mode only work for accounts listed there.
4. Copy the **Client ID** (not the secret – Nemo does not need it).
5. In Nemo: *Settings → Connections → Spotify*, paste the Client ID, save. Choose **Show** (what is playing) and, if you like, **Control** (Pause, Resume, Next).
6. Click **Connect**. Your browser opens Spotify; allow access. Nemo then shows "Now playing: …" on the Overview whenever something plays.

Good to know:
- Controlling needs Spotify **Premium**. Without it Nemo hides the buttons once, with one short note; the display keeps working.
- "Port in use": another program uses port 38417. Close it and click Connect again – Nemo never picks another port, because Spotify checks the address exactly.
- Nemo asks Spotify about every 30 seconds, only while the app is open and visible. Title and artist stay on this device: no sync, no AI, no error reports.
- Disconnect any time under *Connections → Spotify*; you can also remove the app's access in your Spotify account.
- Spotify may change its rules for developer apps; if the connection stops working, check the dashboard first.
