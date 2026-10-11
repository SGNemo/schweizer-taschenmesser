**English** | [Deutsch](ai-assistant.de.md)

# Search, AI assistant and AI import

## Search and AI assistant

Ctrl+K (phone: the search field at the top) opens the command palette: jump, search across all modules and ask questions.

- **Local, free of charge:** the app understands simple questions itself, such as "What's on today?", "events tomorrow", "open invoices",
  "overdue tasks", "account balance", "What do my subscriptions cost?", "How much do I still have to pay?", "search dentist".
  Short keywords start the full-text search. (Today the app understands these questions in German.)
- **With AI (optional):** more complex questions ("How much did I spend on groceries in September?") and sentences like
  "Remind me of the rent every 1st" can be passed to AI providers. *Settings → AI assistant*: add providers:
  **Claude**, **OpenAI**, **Google Gemini**, **Groq**, **OpenRouter** (including free models), **Mistral**, **Ollama** (local) or your
  own OpenAI-compatible server. Several providers are asked **in order** (local → free → paid, adjustable with the arrow
  keys); if one is exhausted, failing or refuses, the next one steps in. Per provider you can set limits (requests per day, cost
  per month) and prices; the settings show requests, errors, fallbacks and estimated costs. "Test connection"
  checks a provider with a minimal request. Free providers sometimes use inputs for training; the app points this out.
  In the installed app (Windows/Android) there is no CORS restriction; in the browser, reachability depends on the provider.
- **Privacy:** providers only receive your question, today's date and a short description of the active modules, **never your
  data** (and never the password vault "Accounts"). The model only picks a structured query; it is checked and run locally.
  API keys stay encrypted in this device's database (not synced, not in the backup).
- **Costs at a glance:** identical questions on the same day come from the cache (0 tokens); usage per answer and in total is shown in the answer
  and in the settings.
- **Creating only with confirmation:** if the AI suggests a new entry, the app shows it first; it is saved after "Create".

## Adding entries with AI

Simply type into the bar what you want to add, for example "Rechnung Stadtwerke 89,90 € fällig 15.10.", "Abo Netflix 12,99 monatlich ab 1.11.", "Lösche das Abo Spotify" or "Markiere die Stadtwerke-Rechnung als bezahlt" (the built-in rules currently understand German sentences). Separate several entries with a line break or a semicolon.

- **Always a preview first:** fields can be changed, for changes and deletions you see before/after, missing details are asked for in the preview. Nothing is saved until "Add" (Enter); "Undo" in the notice reverts everything.
- **Costs almost nothing:** fixed rules try to understand the sentence first (0 tokens, nothing leaves the device). Only if that is not enough and you allow it is an AI provider asked, with the sentence, the date and the field names of the modules, never with your entries. The statistics under *Settings → AI* show where each answer came from.
- **Under your control:** under *Settings → AI → Add with AI* it can be turned off globally and per module. Each module has "Add with AI" at the top. The password vault is never included.
- **Your Claude subscription:** Anthropic only allows subscription access in Claude Code and claude.ai, not in other apps. If you want to use your subscription, let Claude Code on your PC fill Nemo (see below).

## Importing data with AI

You do not have to type in existing data: an AI (Claude Code, ChatGPT …) delivers it in the app's format and you confirm a
preview. In the Windows app this works through a local, secured interface (*Settings → AI access*, off by default),
everywhere else via "Paste JSON" in the starter-data assistant. Guide, examples and a ready-made prompt:
[`docs/AI-IMPORT.md`](../AI-IMPORT.md).

## Chat
The **Chat** module (enable it in the module library) is a simple chat with several conversations. Each chat answers either with the **built-in local model** (Windows only, offline, free) or with **your providers** from Settings → AI.

- By default the chat sees **no data from the app**. In the chat's gear menu you can pick modules it may answer questions from. When sending with "Attach data" you first see exactly the text that is sent along. The vault is never included.
- You can copy answers and have them regenerated; your own questions can be edited. Chats can be renamed, pinned, archived, exported as Markdown and deleted for good.
- Settings → Modules → Chat: default answer route and "Delete old chats after".
