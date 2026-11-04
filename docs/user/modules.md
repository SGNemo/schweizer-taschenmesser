**English** | [Deutsch](modules.de.md)

# Modules and tools

## Overview

In the **module library** you turn modules on and off (when turning one off: keep or delete its data).

<!-- modules:start -->

| Area | Module | What it does | Status |
|---|---|---|---|
| **Plan** | Calendar | Events in month, week and day view | on by default |
|  | To-dos | Tasks in lists with priorities, due date and subtasks | on by default |
|  | Habits | Daily and weekly goals with rings | optional |
|  | Time tracking | Start and stop with one click, projects and clients with colour and hourly rate | optional |
|  | Weather | A page of its own for the weather at your place | on by default |
|  | Maps & places | Places and routes you need often | preview |
|  | People | Never forget a birthday again and collect gifts per person | optional |
| **Money** | Finances | Accounts, income and expenses with categories | on by default |
|  | Invoices | Open invoices with amount, payee and due date | on by default |
|  | Subscriptions | Subscriptions and recurring payments | on by default |
|  | Budgets & savings goals | Monthly limits per expense category (from Finances) and savings goals with deposits and progress | optional |
| **Household** | Lists | Shopping, packing lists and checklists | optional |
|  | Pantry | What’s in the fridge, the cupboard and the freezer? | optional |
| **Knowledge** | Saved | Save links, reading, films, places and ideas | optional |
|  | Notes | Notebook with formatted text (Markdown), a fixed scratchpad always at the top, pinning and search | optional |
|  | Chat | Conversations with the built-in local model or your providers | preview |
|  | Browser | Simple browser with tabs, bookmarks and a private mode | preview, Windows and Android apps only |
|  | Feeds | Your subscribed feeds (news, blogs, podcasts) in one place, sorted by group | optional |
|  | Mail | Inbox, search and reading mail | preview, Windows app only |
|  | Music | Spotify on one page | preview |
| **Vault** | Documents | IDs, contracts, insurance and warranties with end date, notice period and an attached file | optional |
|  | Passwords | Password vault | optional |
| **System** | This PC | Drives with a scan of the biggest folders and system info (processor, memory, battery, network) | optional, Windows app only |
|  | Downloads | Downloads files | preview, Windows app only |

**Tools:** Calculator · Currency · Timer & stopwatch · QR code · Units · Date calculator · Time zones · Dice & random · Text tool · Shrink images · PDF tool · Screenshot (preview) · Anonymous persona · Developer · Text compare (preview) · Regex tester (preview). Open with Ctrl+. or the Tools button; more can be turned on under “Manage tools”.

Preview modules and tools stay hidden until you turn on “Show work in progress” (Settings → Appearance).

<!-- modules:end -->

Highlights of the modules that start with a short line above:

- **Calendar** (on by default): reminders and a notification before events. **To-dos**: also recurring, with “Someday”.
- **Saved:** links, reading, films, places and ideas with tags; on the phone via “Share”. Its bookmarks view shows tiles grouped by first tag, for example parcel tracking, trains, maps …
- **Notes:** with a pinned **scratchpad** at the top for quick jots.
- **Lists:** shopping with “2 milk”, packing lists with progress and templates, checklists.
- **People:** birthdays yearly in the calendar, with age, reminder and WhatsApp greeting; gift ideas per person with price, link and status.
- **Budgets & savings goals:** monthly limits per finance category, savings goals with deposits.
- **Maps & places** (preview): saved places and routes, a map with place search, open in your map app; the map only loads when you open it.
- **Documents:** title, category, provider, start, end, notice period and note are synced like everything else; the **files stay only on the
  device** where they were added (not synced, not in the backup, max. 10 MB per file).
- **Share (Android, installed as a PWA):** "Nemo" appears in the share menu; the "Share" page asks where the content should go
  (Saved, note or to-do; only enabled modules are offered). The native Android app (APK) has the share target too.
- **Quick capture:** one line = one entry, so several things land at once (with a preview row each). In the Android app, long-press the app icon for "Capture", "Search" and "Today", or add the quick-settings tile "Nemo: Capture".
- **Tools:** the "Tools" button at the top (or **Ctrl+.**) opens the calculator (with percent/VAT and split modes), currency, timer and QR code;
  more (units, date calculator, time zones, dice, anonymous persona, text, images, PDF and **Developer** with Base64/URL, JSON, UUID, hash) can be turned on
  under "Manage tools". In the search (Ctrl+K) a calculation like "240 + 19 %" is computed right away, "Tool: …" opens a
  tool. The former scratch note now lives as the **scratchpad** at the top of Notes (your old text is carried over once).
- **Import into Notes:** "Set up start data" on the Notes card (Module library) reads Markdown files (e.g. from an Obsidian folder, several at once, or pasted text) and Google Keep exports (the `.json` files from Google Takeout). You see a preview first and untick what you do not want; notes you already have are marked. Titles come from the front matter, the first heading or the file name; tags are kept as `#tags` in the text, Keep checklists become task lists, Keep notes in the trash or archive are left out. ZIP files: unzip them first.
- **This PC** (Windows app only): analyse and clean up drives; the "System" tab shows processor, memory, battery, graphics and network.
- **Habits** (Planen, off by default): goals with rings – a tick or a number like "8 glasses" – rest days that never count against you, a year grid, and reminders in a time window that stop once the day's goal is met ("Drink water" template). This is a new module; the old habit tracker of 0.3.x stays retired; its old data is not carried over into the new module, but it stays in the database and in every backup.
- **Time tracking** (Planen, off by default): one click on a project starts the clock, pause and stop, manual entries, projects with colour, client and hourly rate, a week and month report with the amount (rounded to whole cents per entry) and CSV export. If you were away while the timer ran, the app asks – keep the time, deduct it as a break, or stop where you left – and never changes anything by itself. In an event, "Track time" starts the clock. This is a new module; the old time tracker of 0.3.x stays retired; its old data is not carried over into the new module, but it stays in the database and in every backup.
- **Retired (1.0.0):** Messages are no longer visible. Their data stays stored and is still part of every backup.
- **Map & WhatsApp:** events with a location have "Show on map"; for people with a birthday the button opens WhatsApp with a greeting
  (you pick the contact in WhatsApp).

## Importing a bank statement
In **Finances** (Settings → Modules → Finances → Set up starter data → *Import bank statement*) choose the file you exported in online banking: **OFX**, **QIF**, **CAMT** or **CSV**. Nothing is uploaded and no login is needed; you see a preview first and can undo the import. Well-known banks (Sparkasse, ING, DKB, N26, comdirect, Volksbank/GLS) are recognised from the file and named in the preview ("Recognised: DKB"). For a CSV the app does not know, you assign the columns date / amount / payee / purpose once; the app remembers it for the next export of that kind. A file imported twice adds nothing new, and a file in another currency is only booked to an account in that currency.

After an import the preview may suggest **rules** ("Always book Netflix in category Subscriptions?"). Nothing is ticked: a rule is only created if you tick it and confirm the import, it then sorts later imports, and you can remove it under Finances → Categories. A paid invoice is booked as an expense in Finances (Invoices → settings can turn that off), and a price rise of a subscription shows once under *Important now* (Subscriptions → settings can turn that off).

## Bringing tasks from Todoist or Google Tasks
Open **ToDos → Import → From Todoist or Google Tasks** (once the module holds tasks: Settings → Modules → ToDos → Set up starter data) and choose a file you exported yourself. Nothing is uploaded and no account is needed; you see a preview first and can undo the import.

- **Todoist:** project menu (⋯) → *Export as CSV*. One file per project; it becomes one list named like the file.
- **Google Tasks:** [Google Takeout](https://takeout.google.com) → only *Tasks* → `Tasks.json`. Choose *a separate list for each source list* to keep your lists apart.

Titles, notes, priority (Todoist), due days and subtasks come along. Completed tasks stay out unless you switch them on. Repeating tasks are **not** turned into repeating tasks: the repeat only appears as a line in the note, so nothing comes back by itself. Tasks you already have (same list and title) are marked *already there*.
