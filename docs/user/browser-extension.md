**English** | [Deutsch](browser-extension.de.md)

# Browser extension (Brave)

The extension helps you sign up and log in on websites. It has **no vault of its own**: everything comes live from the vault of the Nemo desktop app and is saved there (and from there synced to your phone). If Nemo is not running or the vault is locked, the extension says so and does nothing.

## Setting up
1. Unzip `nemo-extension-….zip` (from the build artifacts or from the developer).
2. In Brave open `brave://extensions`, turn on **Developer mode**, click **Load unpacked** and pick the folder.
3. In Nemo: **Vault → Browser extension** → enable the connection. (Only for your Windows account, no administrator rights needed.)
4. Click the extension icon. The 6-digit code shown must match the dialog in Nemo, then click **Connect**. You only do this once.

## Using it
- **New account:** when you click into the password field of a sign-up form, the extension suggests a password (re-roll, length and characters adjustable, passphrase possible). "Use" fills it into all password fields; afterwards it asks whether to save the account in the vault.
- **Logging in:** the key icon in the field shows matching entries; one click fills them in. One-time codes can be inserted or copied in the popup (the clipboard is cleared after 30 seconds).
- Nothing is filled in or saved automatically, always only after your click. Entries are only offered for the matching website (adjustable: same domain or exactly the same host).

## Troubleshooting
- "Nemo was not found": start the app and check in **Vault → Browser extension** that the connection is on.
- Portable folder moved: Nemo registers the new path itself on start; otherwise use **Register again** in the same dialog.
- Brave Shields: they do not block the extension. If a page shows nothing, briefly turn Shields off and check.
