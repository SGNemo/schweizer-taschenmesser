# Nemo supporter webhook

A small Cloudflare Worker: a Ko-fi donation arrives → it signs a Nemo supporter code → mails it to the donor (German and English). **Separate from the app and the sync server**: it has no access to any user data and shares nothing with them except the code format (`packages/supporter-codes`). Background: [docs/architecture/supporter.md](../../docs/architecture/supporter.md), decisions: [docs/decisions/supporter.md](../../docs/decisions/supporter.md), maintainer checklist (tax, privacy notice): [docs/legal/SUPPORTER-NOTES.md](../../docs/legal/SUPPORTER-NOTES.md).

```
Ko-fi ──POST /kofi──▶ Worker ──▶ KV: hashes only (idempotency, resend index, counter)
                        │ sign (Ed25519, secret in the Worker)
                        └▶ Queue supporter-mail ──▶ Resend ──▶ donor mail
                                  │ 5 tries with backoff, then
                                  └▶ owner mail (hash prefix + tier only) + dead-letter queue
Donor ──GET/POST /resend──▶ "send my code again" (only to the address that matches the donation)
```

## What it does (and refuses)

| Route              | Behaviour                                                                                                                                                                                                                           |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /kofi`       | Verifies the Ko-fi `verification_token` first (wrong or missing → **401**, nothing else happens). Only a paid **Donation** (or the first payment of a membership) earns a code; every other event type is acknowledged and ignored. |
| `GET /health`      | `{"ok":true}`, no data.                                                                                                                                                                                                             |
| `GET/POST /resend` | Form to get the code again. The answer is always the same neutral page. Only an address that matches the donation (by keyed hash) gets mail, and only to that address; once per donation and hour.                                  |
| anything else      | 404 / 405. No CORS headers on any response. Body limit 16 KB (form 2 KB). Optional per-IP rate limit (`[[ratelimits]]`).                                                                                                            |

Tier (display only): **kaffee** below 10 € (comparable thresholds for other currencies, see `src/tier.ts`), **kuchen** from 10 €. A display name is only put into the code for a **public** donation, sanitised, at most 20 characters.

## What it stores (privacy)

- **KV, 400 days:** `tx:<HMAC(transaction id)>` → `{code, tier, HMAC(address), mail status}`; `em:<HMAC(address)>` → transaction hash (for "resend by address"); `rs:<hash>` one-hour lock; `stats:issued` counter. **No address, name or transaction id in clear text.** The code itself contains tier, date and (if public) the name – that is what the donor receives anyway.
- **Queue:** the address is in the mail job until the mail is sent (free plan keeps messages at most 24 hours).
- **Logs:** structured JSON with event, 8-character hash prefix, tier, result, status only (`src/log.ts`, `test/logs.test.ts`). Never addresses, names, codes, tokens, amounts.
- **Deletion on request:** the donor sends the Ko-fi transaction id → compute `HMAC-SHA256(HASH_PEPPER, "kofi:<id>")`, delete `tx:<hash>`; the address index `em:<HMAC(address)>` goes the same way (`HMAC(HASH_PEPPER, "mail:<lower-case address>")`). A name inside an issued code cannot be taken back; issue a new code without a name instead.

## Secrets and variables

Set secrets only with `wrangler secret put <NAME>` – never in a file, never in CI, never in the app.

| Name                      | Kind     | What                                                                                                                                       |
| ------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `KOFI_VERIFICATION_TOKEN` | secret   | Token shown on Ko-fi's webhook page                                                                                                        |
| `SUPPORTER_SIGNING_KEY`   | secret   | 64 hex characters, the Ed25519 **private** key                                                                                             |
| `RESEND_API_KEY`          | secret   | Resend API key (sending access only)                                                                                                       |
| `HASH_PEPPER`             | secret   | Long random string for the keyed hashes. **Do not change it later**: old records could no longer be found (duplicates would get new codes) |
| `OWNER_EMAIL`             | secret   | Where failure notices go                                                                                                                   |
| `SIGNING_KEY_ID`          | variable | Key id of the matching public key in the app (`wrangler.toml`)                                                                             |
| `MAIL_FROM`               | variable | e.g. `Nemo <support@your-domain>`; the domain must be verified at Resend                                                                   |

## Run it locally

```bash
cd services/supporter-webhook && npm ci
cd ../../packages/supporter-codes && npm ci && cd ../../services/supporter-webhook   # shared code package
cp .env.example .dev.vars        # git-ignored; fill in INVENTED values and a throw-away key
npm test                         # unit tests with invented Ko-fi payloads
npx wrangler dev                 # http://localhost:8787 with local KV and queue
curl -i localhost:8787/health
curl -i -X POST localhost:8787/kofi --data-urlencode 'data={"verification_token":"<token from .dev.vars>","type":"Donation","is_public":false,"from_name":"","amount":"5.00","currency":"EUR","email":"me@example.invalid","kofi_transaction_id":"local-1"}'
```

Locally the mail step fails (dummy Resend key) – that is the expected "owner is told" path; the log lines show `failed-notify-error`. Use a throw-away signing key here, never the real one.

## Deploy (you do this; nothing below puts a secret into the repository)

1. **Accounts:** a Cloudflare account (free plan is enough), a [Resend](https://resend.com) account, and your Ko-fi page.
2. **Key pair** (once, own machine): `cd tools/supporter-cli && node bin/supporter-cli.mjs keygen`, then `set-public-key`, commit `web/src/core/supporter/publicKeys.ts` and ship an app version that contains it. Back up the key file ([docs/howto/supporter.md](../../docs/howto/supporter.md)).
3. **Login:** `cd services/supporter-webhook && npx wrangler login`.
4. **KV:** `npx wrangler kv namespace create KV` → copy the printed `id` into `wrangler.toml` (`REPLACE_WITH_KV_NAMESPACE_ID`). That id is not a secret.
5. **Queues:** `npx wrangler queues create supporter-mail` and `npx wrangler queues create supporter-mail-dlq`.
6. **Variables:** in `wrangler.toml` set `SIGNING_KEY_ID` (the key id from step 2) and `MAIL_FROM`.
7. **Check the bundle:** `npm run build` (dry run, uploads nothing).
8. **Deploy:** `npx wrangler deploy`. Note the URL (`https://nemo-supporter-webhook.<subdomain>.workers.dev`). Until the secrets exist every request answers 500 `misconfigured` – that is intended. `curl https://…/health` → `{"ok":true}`.
9. **Secrets** (each prompts for the value; the signing key is piped so it never lands in your shell history):
   ```bash
   npx wrangler secret put KOFI_VERIFICATION_TOKEN     # paste the token from Ko-fi (step 12)
   node ../../tools/supporter-cli/bin/supporter-cli.mjs print-worker-secret --yes | npx wrangler secret put SUPPORTER_SIGNING_KEY
   npx wrangler secret put RESEND_API_KEY
   npx wrangler secret put HASH_PEPPER                  # e.g. output of: openssl rand -hex 32
   npx wrangler secret put OWNER_EMAIL
   ```
10. **Domain / route (optional):** in the Cloudflare dashboard add a custom domain to the Worker (Workers & Pages → the Worker → Settings → Domains & Routes), or add a `routes` entry to `wrangler.toml` for a zone you own and set `workers_dev = false`.
11. **Mail provider:** in Resend add your sending domain and put the DNS records it shows (SPF, DKIM, plus a DMARC record) into your DNS; wait until the domain shows _Verified_. Create an API key with _Sending access_ only. `MAIL_FROM` must use that domain – otherwise Resend answers 422 and every mail ends in the owner notice.
12. **Ko-fi webhook:** Ko-fi → Settings → API → Webhooks (`ko-fi.com/manage/webhooks`): enter `https://<your worker>/kofi`, copy the **verification token** from that page into `KOFI_VERIFICATION_TOKEN` (step 9).
13. **App links:** put the Ko-fi page URL and `https://<your worker>/resend` into `web/src/pages/settings/supporterLinks.ts` (`SUPPORT_PAGE_URL`, `RESEND_PAGE_URL`) and ship the app. Until then the buttons stay hidden.
14. **Test:** use Ko-fi's _Send test_ first (it only proves the wiring; check `npx wrangler tail` shows `issued` and `mail … sent`), then make one **real small donation** with your own second address and enter the code in the app (Einstellungen → Über Nemo → Supporter). Send the same webhook again from Ko-fi/`curl` and confirm the **same** code arrives, not a new one. Full list: [docs/MANUAL-TESTS.md](../../docs/MANUAL-TESTS.md) S1–S8.
15. **Before you rely on it:** the field names in `src/kofi.ts` follow Ko-fi's published payload (`verification_token`, `type`, `kofi_transaction_id`, `email`, `amount`, `currency`, `is_public`, `from_name`, `is_first_subscription_payment`). If _Send test_ shows `bad-payload` in `wrangler tail`, compare the real payload with that list and adjust `src/kofi.ts` – the tests use invented payloads.

## When something fails

| Symptom                              | Look here                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ko-fi shows errors / nothing arrives | `npx wrangler tail`: `unauthorised` = token differs between Ko-fi and the secret; `bad-payload` = field names (step 15); `misconfigured` = a secret/variable is missing or the signing key is not 64 hex characters                                                                                                                                            |
| Donation recorded, no mail           | `tail`: `mail … retry` = Resend 429/5xx/network (it retries up to 5 times, 1–16 min apart); `failed-notified` = you got the owner mail; check Resend → Logs, domain verification, `MAIL_FROM`, API key                                                                                                                                                         |
| You got the owner mail               | It names a hash prefix and the tier. Find the record: `npx wrangler kv key list --binding KV --prefix tx:<prefix>`; read it: `npx wrangler kv key get --binding KV "<key>"` (contains the code). The donor's address is in your Ko-fi dashboard – send the code by hand (`supporter-cli` is not needed, the code is already signed), or let them use `/resend` |
| Everything stopped                   | Free-plan quotas: KV 1,000 writes/day (a donation uses 4–5), Queues 10,000 operations/day, Resend 100 mails/day. Retries continue the next day (queue retention 24 h)                                                                                                                                                                                          |
| Duplicate codes for one donation     | `HASH_PEPPER` was changed, or `kofi_transaction_id` differs between deliveries                                                                                                                                                                                                                                                                                 |

## Rotation

- **Ko-fi token:** create a new one at Ko-fi, `wrangler secret put KOFI_VERIFICATION_TOKEN`, done.
- **Signing key:** `keygen --key-id 2`, `set-public-key`, ship the app, then `print-worker-secret` for the new key and change `SIGNING_KEY_ID`. Old codes stay valid.
- **Resend key:** create a new key, `wrangler secret put RESEND_API_KEY`, delete the old one.
