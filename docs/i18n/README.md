# App languages

The app UI is available in **Deutsch** (source), **English**, **Español**, **Français** and **Português (Brasil)**. People choose the language under Settings → Allgemein or in the first setup step; the default is the system language, otherwise English.

## Status of the translations
The English, Spanish, French and Brazilian Portuguese texts were **machine-translated** (with an AI model, following the [glossary](GLOSSARY.md)) and have **not yet been reviewed by native speakers**. Some wording will be stiff or wrong. Corrections are very welcome.

## How to help
- **Report a text:** open an issue with the *Translation* template (language, where you saw it, current text, suggestion).
- **Fix it yourself:** the texts live in `web/src/i18n/locales/<lang>/<area>.ts`, one file per area, same keys as the German source `web/src/strings.ts`. Change the text, keep the keys, the `${…}` placeholders and the plural logic; use the [glossary](GLOSSARY.md) terms. Then run `npm run check:i18n` in `web/` and open a pull request against `develop`.
- **New term?** Add it to the glossary in the same pull request.

## What stays German (known limits)
- Things a person **types** and the app parses: quick capture ("morgen 15 Uhr Zahnarzt"), the AI bar's rules and the calculator's phrases understand German only. The help texts around them are translated.
- **Starter data** (seed entries) and the AI's instructions to the model.
- The typed confirmation word **LÖSCHEN** for deleting files in "Dieser PC".
- **Legal texts** (imprint, privacy notices) exist in German and English; the other languages show English.
- Developer-only screens (Dev-Preview tools).

Dates, numbers and money follow the language by default; Settings → Allgemein → *Formate* can pick another region (for example English UI with Swiss formats).

For developers: recipes in [docs/howto/i18n.md](../howto/i18n.md).
