# Mail – finding and overview: analysis

Goal (Sven): mail is easier to search and calmer to scan; he pulls invoices, deadlines and replies out of it into the planner. Script: [`web/e2e/usecases/mail-find.spec.ts`](../../../web/e2e/usecases/mail-find.spec.ts) (fixture `mail-find.fixture.ts`: 293 invented mails – 46 invoices, 120 newsletters, 14 authority letters, 9 from one kindergarten, 55 work, 45 private; 64 with attachments). The run writes the mailbox as demo rows of the mail cache, so it measures the „offline / on this device“ case; it needs no login.

## What the search does (IST, code)

| Question | Today |
|---|---|
| Where | Only at Gmail: the text goes as `q` to `threads.list` (`useMailbox` → `gmail.ts`); results are never cached. |
| Fields | Whatever Gmail searches (subject, sender, body, attachment names). Nemo itself searches nothing. |
| Offline / demo | Nothing: a search with no network shows an error and an empty list, the demo mailbox shows „Keine Treffer“ for every word. |
| Local data | 200 sealed headers (sender, subject, preview, labels) and 60 opened mails per device – unused by the search. |
| Attachments | `hasAttachment` is always `false` from Gmail's list call (metadata format), so no row can show or filter it locally; attachment names exist only in opened mails. |
| Help | Suggestions: the last five searches and `from:` names of the listed rows; chips (Ungelesen, Mit Anhang, Mit Stern, Älter als ein Jahr) appear only while typing; hint text is Gmail syntax („from:, to:, subject:, has:attachment …“). |
| Order | Day groups (Heute, Gestern, Diese Woche, Älter), threads already one row with a count; filter „Persönlich“; nothing tells newsletters, invoices and people apart. |

## IST (2026-11-23, `develop`)

Same numbers at 1920 and 412 px (the list is the same list; at 412 only three rows fit above the fold). Steps = taps, typed words and Enter.

| Task | Steps | Keys | Rows read | Detours | Path |
|---|---|---|---|---|---|
| A invoice from spring (water, April) | 3 | 15 | 242 | 1 | search finds nothing → end search → read the list |
| B everything from one sender (9 mails) | 3 | 10 | 201 | 1 | same |
| C the mail with `Mietvertrag_Nachtrag_2026.pdf` (subject does not name it) | 3 | 11 | 99 | 1 | same |
| D what waits for my answer (7 mails) | 1 | 0 | 29 | 0 | chip „Persönlich“, read |
| E new and important this week (3 mails) | 0 | 0 | 15 | 0 | read the day groups |

**Target of the round:** every task at most half the rows of IST; A in at most 3 steps.

## Design critique of the list (1920 / 412)

- **First look:** the newest newsletter („Beispiel-Shop“) sits on top, styled like a person's mail; 120 of 293 rows are newsletters. Nothing lifts the few mails that want something from the person.
- **Search (🔴):** offline it fails silently („Keine Treffer“ reads as „there is none“); the placeholder is cut („Suchen, z. B. from:name has“) and the hint is Gmail syntax – jargon for a person who wants „Rechnung Wasser“.
- **412 px (🟡):** settings button, demo notice, folder select, search and a three-line hint take the first half of the screen; three rows remain.
- **Rows (🟢):** sender, time, subject and preview in two lines read well; unread is bold, star and „im Plan“ carry text. No attachment mark.
- **Works:** day groups, thread counts, calm colours, „Persönlich“ as the one standing chip.

## Plan (at most three PRs, biggest gain first)

| # | Package | Answers |
|---|---|---|
| 1 | **Search on this device + at the mailbox:** one field; a local index over the cached headers and opened mails (sender, subject, preview, text, attachment names), typo-tolerant for names, hits highlighted as text (never HTML), shown first as „Auf diesem Gerät“, Gmail's answer below as „Im Postfach“ (without the doubles); offline the local part still works. Chip „Letzte 7 Tage“; plain hint text. Gmail's `hasAttachment` read from the message type; attachment names from opened mails (the newest 60 kept); cache 200 → 1 000 headers. | A, B, C |
| 2 | **Kinds and „Wartet auf mich“:** one chip row „Alle · Braucht Antwort · Rechnungen · Newsletter · Rest“ from local rules (no AI) replaces „Persönlich“; queue „Wartet auf mich“ (default: to me, newest message not mine, no newsletter, last 30 days; or „markiert“) with a calm count and a view that goes mail by mail (Erledigt, Später, In den Plan); a small read contract for the planner (title, count, target). | D, E |
| 3 | Small things from the measurement if 1–2 leave a gap (412 px head). | – |

**Rejected:** a fourth order system (kinds are a filter, not tabs beside folders and day groups); senders folded into one row („12 von Beispiel-Shop“) – the newsletter filter takes the bulk out of the way with one rule instead of a second row type; two densities – rows are two lines already, a switch is one more setting for little gain; time sections and threads – both exist.

## After package 1 (search on this device + mailbox)

| Task | Steps | Keys | Rows read | Detours | vs. IST |
|---|---|---|---|---|---|
| A invoice from spring | 2 | 15 | 7 | 0 | rows 242 → 7, target (≤ 121 rows, ≤ 3 steps) met |
| B everything from one sender | 2 | 10 | 9 | 0 | 201 → 9, met |
| C mail with the attachment | 2 | 11 | 1 | 0 | 99 → 1, met (hit line „Anhang: Mietvertrag_…pdf“) |
| D waits for my answer | 1 | 0 | 29 | 0 | open (package 2, target ≤ 14) |
| E new and important this week | 0 | 0 | 15 | 0 | open (package 2, target ≤ 7) |

Same at 1920 and 412 px; axe (WCAG 2.2 AA) finds nothing on the search with both parts at either width. Index: 5 000 mails (5× the cache) built in ≈ 0,2 s, a warm search ≈ 50 ms (unit test, jsdom). The device part shows 50 hits, more on request. Still open from the critique: the 412 px head (package 3).
