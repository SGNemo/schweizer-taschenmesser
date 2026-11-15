# Planner hub – research synthesis (chat B)

**Method:** secondary synthesis of documents on `develop` – **no interviews with real users** · **Sources:** 7 (below) · **Date:** 2026-11-15 · **Format:** skill `design:research-synthesis`. Siblings: `ANALYSIS-SOURCES.md` (module/link inventory), `ANALYSIS-MEASURE.md` (page measurement) – not repeated here.

## Executive summary

Every source that touches the planner asks for the same two things: things should reach the plan **from where they already are**, and the plan should **lead back** to them. Mail → plan and mail → invoice are built; the rest is one parked finding (S05). The second pattern is deadlines: a missed one has no place and no single meaning (4 of 7 sources). The "empty, small" impression is new evidence from one person (the maintainer), and it collides with three decisions made in the last ten days for calm – the concept must name that trade, not undo it silently. Nobody but the maintainer has used the planner: it is off by default and in no profile.

## Sources

| Id | What | Kind |
| --- | --- | --- |
| M | Maintainer statement + screenshot findings, 2026-11-15 (Windows 1920, dark) | first-hand, 1 person |
| R6 | `docs/qa/round-6/FINDINGS.md` S05, S08, S09, T03 (2026-11-09) | first-hand, same person |
| KL | `docs/design/usecases/kopf-leer/{ANALYSIS,TARGET}.md` U01–U17 | maintainer's scenario, played and measured by an agent |
| WE | `docs/design/usecases/wochenende/{ANALYSIS,REVIEW-FABLE,CHECK-1-3}.md` W01–W22, R1–R14, C1–C10 | same |
| UA | `docs/design/ui-audit-2026-11/{REPORT,PACKAGES,AESTHETICS-ADDENDUM}.md` | agent audit with measurements |
| QA | `docs/qa/CONSOLIDATED.md` (8 simulated personas, planner did not exist yet), `docs/qa/round-5/**` (4 first-contact runs) | simulated |
| PC | `docs/design/plan/CONCEPT.md` §7, `concepts/**`, `docs/decisions/plan*.md` | design record |

M (primary): „Der Planer soll mein Steckenpferd sein, ich will über ihn alles managen. Mahnung aus einer Mail: Planer verlinkt auf die Mail; Mahnung im Planer und in der Rechnung, beides aus der Mail. In der Rechnung auch auf die Mail verlinken usw. Noch mehr: alles Mögliche aus den anderen Modulen in den Planer verlinken lassen (Einkauf, Gym, Rechnungen, alles, was geht). Generell sieht der Planer nicht schön aus – sehr leer, sehr klein, nicht ansprechend für ein Steckenpferd."

## Key themes

Prevalence = sources with evidence, of 7. _Obs_ = observed/quoted, _Int_ = my reading.

**T1 Into the plan from everywhere – 5 of 7** (M, R6, KL, WE, PC). _Obs:_ „ToDos will ich in den Planer packen können über die Oberfläche (generell checken, was man aus welcher UI wo in den Planer packen könnte, Rechnungen z. B.; Planer sehr wichtig)" (R6 S05, parked „später – Planer"). Mail took 9 taps for two mails, 2 after the packages (KL TARGET §4 path B). „Arbeitszeit eintragen" in the plan leads nowhere (WE W14). _Int:_ the entry was solved per use case; a rule for all modules is missing.

**T2 Both directions, one state – 4 of 7** (M, KL, WE, QA). _Obs:_ the plan row has one link (`core/modules/types.ts:608`: note, mail, invoice or event); a reply ToDo never learned the mail was answered (WE W17, since built); after filing an invoice from a mail the person „still checks the planner" (KL TARGET §4 remeasure; „Im Plan · Mi" followed). Priya: „Verknüpfungen zwischen Einträgen verschiedener Module fehlen" (`origin/qa/priya:docs/qa/priya/REPORT.md` V02; QA V14, 2 personas). _Int:_ M's dunning case needs three things knowing each other (mail, invoice, plan row); one link per row cannot say that.

**T3 Deadlines and what is late – 4 of 7** (M, WE, KL, QA). _Obs:_ six „Frist war So/Di/Do" rows stacked on Monday (M). „Rest verteilen" moves a thing past its deadline and only afterwards says „Frist war So" (WE C5). „bis So 18:00" meant three different things by entry point (WE W04, W20; KL U14). A missed cancellation date „wird nirgends als verpasst markiert" (QA B08, 2 personas). „Wartet noch": 2 personas like it, 3 ask „wer wartet worauf?" (QA :143). _Int:_ „nothing is overdue" is right for chores, wrong for money with a date.

**T4 The head answers the wrong question – 3 of 7** (M, KL, WE). _Obs:_ „Heute ist frei." while Monday holds 9 things and 37 min (M); „1 h 36 frei heute" beside „Heute ist frei. Mo: 3 h 12 frei." (WE W13); three evening messages share the head (WE R11); „6 h" tapped, board says „1 h 42 frei von 3 h 12" (WE C7). _Int:_ the head reports today's capacity; the person asks „what is the next tight spot?".

**T5 Too little on the page, rows not alike – 3 of 7** (M, R6, UA). _Obs:_ M's screenshot findings; Kästchen misaligned, read sources without one (R6 S08); planner row median 74 px, lists over 1 600 px single-column (UA REPORT B5). _Int:_ part of the emptiness is decided calm (waiting group folded, board removed, tick hidden for money) – see the table below.

**T6 The field is powerful and invisible – 5 of 7** (M, R6, UA, WE, KL). _Obs:_ it „looks like a form under the week" (M); misaligned (R6 S09, fixed #614); 3–4 entry points per page (UA B3); it understands „Sa 6 Std", „schieb X auf Mo" – „it only is not offered" (WE ANALYSIS §4, W09, W12); the disabled „Eintragen" reads as a colour error (UA AESTHETICS :18).

**T7 Nobody meets the planner – 4 of 7** (QA, KL, WE, UA). _Obs:_ persona A looks for „Planung" and lands in calendar/ToDos; decided 2026-11-08: stays off, in no profile (`round-5/a/FOLLOWUP.md` F3). Three modules plan „den Tag" (UA REPORT :194). First tap could end in the library, 5 of 8 at 1920 px (WE C1, fixed).

## Decided, built or planned – do not duplicate or contradict

State per the commit log of `origin/develop`, 2026-11-15; `STATUS.md` lags for #903–#909.

| Source | What | State |
| --- | --- | --- |
| `decisions/plan-contract.md` | own module; `contributions.plannable`; write-back idempotent, one undo; `dataApi: false`, no `aiSchema` | built |
| `decisions/plan-packages-2-5.md` (3) | invoices and subscriptions are sources **without** tick, „Später" or deadline actions – paying stays a money action | built – M's „inconsistent checkbox" is this decision |
| same (2), UA PACKAGES rule 4 | one field for entering and saying; it is the last row under the week | built – M's „form under the week" |
| same (Kopf leer Q4) | waiting group folded; head names today's first thing or the next free day; no count in the folded head | built |
| `decisions/ui-shell-identity-40-plan.md` 0b-4b part 2 | `layout: 'split'`: seven day rows + picked day in the panel; board removed („two pictures of the same week" rejected) | built 2026-11-12 – M's „thin bars, right half empty" |
| `decisions/features-kopf-leer.md` | mail row „In den Plan", invoice line „Anlegen"/„Mahnung vermerken" (`dunningLevel`), ids `mail-<hash>`, row `detail`, „Im Plan · Mi", link without the address (U17) | built |
| `decisions/features-wochenende.md` | „Tage einteilen", „Rest verteilen", break as blocker, estimates, day parts, reminders once, „Tagesende" head sentence, „Beantwortet? · Erledigt" | built (#870–#909) |
| WE PACKAGES 5b, 8 | deadline time `due.time`; remeasure | planned |
| `design/plan/concepts/` | week review line, habits as blocks, time tracking `ref` on a session, flag „Braucht Kopf" | planned, prompts ready |
| R6 S05; UA REPORT H-b | audit „Planer-Einstiege je Modul"; routines as a source | parked; `routines` and `fitness` carry `plannable` in code |
| `round-5/a/FOLLOWUP.md` F3 | planner off by default, in no profile | decided 2026-11-08 |
| CONCEPT §7, FOCUS-GUIDELINES | no „überfällig" for chores, overload is a neutral number, no counters or streaks | decided |
| WE W15 | Gmail needs an own OAuth client; mail is preview, desktop only | open (own decision) |

**MODULE-IDENTITY:** Identity 4.0 is valid for head and navigation since the acceptance sweep 0b-8 (2026-11-14); v3.1 stays binding for palette, signatures, widgets, sidebar and the stripe rule (`docs/design/MODULE-IDENTITY.md:3,164`). Planner: indigo, `weekBars`.

## Insights → opportunities

| Insight | Opportunity | Impact | Effort |
| --- | --- | --- | --- |
| Entries were built per use case (T1) | one shared row action „In den Plan" over `plan.requested`, in every module with something plannable | High | Med |
| One link per row, no relation (T2) | a small link record both sides can read (origin + siblings), shown as „Aus Mail · Rechnung" on each | High | High |
| Late money has no place (T3) | an own quiet group „Frist vorbei" above the week, never placed on a day | High | Low |
| Head = today only (T4) | head names the tightest day of the horizon | Med | Low |
| Field understands sentences nobody sees (T6) | field as the centre, with 2–3 example chips | Med | Low |
| Calm decisions read as empty at 1920 (T5) | use the width for the week (things visible per day), keep the fold rules | High | Med |

## Segments (personas are simulated; sizes unknown)

| Segment | Evidence | Needs from the planner |
| --- | --- | --- |
| The maintainer: overwhelmed, mail-heavy, desktop first, wants one place | M, R6, KL, WE | everything linked, one glance over the week, honest deadlines |
| Self-employed (Priya) | QA V14, B08; her REPORT V02 | relations between entries, „missed" said plainly |
| ADHD student (Jonas) | QA V24; likes „Wartet noch" | few things, part deadlines, calm words |
| Family, shifts (Mia, Lena) | QA V03, V12 | „Heute · Morgen · diese Woche" first; phone |
| First contact (round 5 A) | F3 | finds calendar/ToDos, never the planner |

## Recommendations

**(a) Linking / hub**

1. **Decide the relation model first** (T2): row link only vs. a shared link record. Everything else depends on it; hotspot `core/modules/types.ts`.
2. **One „In den Plan" for every module** (T1, S05) – start with ToDos, invoices, lists, fitness; `accounts` never (hard rule).
3. **Back links on both sides** (T2): the invoice shows its mail and its plan day, the plan row shows both.
4. Keep paying, cancelling and booking in their modules (decided); the hub links, it does not act on money.

**(b) Redesign**

1. **Late deadlines get their own group**, and money rows a visible action („Zur Rechnung") where ToDos have the tick (T3, T5).
2. **Head about the horizon**, one sentence, one figure (T4; Identity 4.0 title row).
3. **Field as the centre** with visible examples (T6); revisits rule 4 → needs the maintainer's yes.
4. **Wide layout shows things, not only bars** (T5); revisits 0b-4b part 2 → name the reason, keep the phone as is.

## Friction (P70–P89; P87–P89 unused)

Severity 3 = stops · 2 = stumbles · 1 = cosmetic. Paths under `docs/`; `…/` = `design/usecases/`.

| # | Where | Is | Expected | Kind | Sev. | Source | Fix idea | Effort |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P70 | ToDo, invoice, list rows | no „In den Plan" on the row | every row can go to the plan where it is | Fehlt ganz | 3 | `qa/round-6/FINDINGS.md` S05 | shared row action | L |
| P71 | Mail ↔ invoice ↔ plan | a dunning from a mail is not linked on all three | each shows the other two | Fehlt ganz | 3 | M; `…/kopf-leer/ANALYSIS.md` U09 | link record | L |
| P72 | Planner week | late invoices stacked on the next day | own place, not on a day | Unklar | 3 | M; `…/wochenende/CHECK-1-3.md` C5 | group „Frist vorbei" | S |
| P73 | „Rest verteilen" | moves a thing past its deadline silently | the preview says so | Fehler | 2 | `…/wochenende/CHECK-1-3.md` C5 | reason line in the preview | S |
| P74 | Planner head | speaks only of today | names the next tight day | Unklarer Text | 2 | M; `…/wochenende/ANALYSIS.md` W13; `…/kopf-leer/ANALYSIS.md` U13 | horizon sentence | S |
| P75 | Planner head, evening | three messages, one slot | one, by rule | Unklar | 1 | `…/wochenende/REVIEW-FABLE.md` R11 | priority order | S |
| P76 | Plan rows | money rows without tick, ToDos with | rows alike; action visible | Inkonsistent | 2 | M; `qa/round-6/FINDINGS.md` S08 | placeholder + „Zur Rechnung" | S |
| P77 | Field | reads as a form; its sentences are not offered | the centre, with examples | Umweg | 2 | M; `…/wochenende/ANALYSIS.md` W09, W12 | field first, chips | M |
| P78 | Capture vs. field | „bis <Tag>" differs by entry point | one deadline rule | Fehler | 2 | `…/kopf-leer/ANALYSIS.md` U14; `…/wochenende/ANALYSIS.md` W20 | shared parser rule (5b) | M |
| P79 | Plan row „Arbeitszeit eintragen" | no way to time tracking | the row leads there | Umweg | 2 | `…/wochenende/ANALYSIS.md` W14; `…/wochenende/CHECK-1-3.md` C2 | concept time-tracking | M |
| P80 | Day capacity | „6 h" → „1 h 42 frei von 3 h 12"; appointments unnamed | the sum is explained | Unklarer Text | 2 | `…/wochenende/CHECK-1-3.md` C6, C7 | one „Warum?" line | S |
| P81 | Row ⋯ | about ten entries, growing | few, grouped | Zu laut | 2 | `…/wochenende/REVIEW-FABLE.md` R8 | group; links out of ⋯ | M |
| P82 | Wide page (1920) | bars, empty right half, small type | things visible per day | Zu leer | 2 | M; `design/ui-audit-2026-11/REPORT.md` B5 | see MEASURE | L |
| P83 | Disabled „Eintragen" | dull brown, looks broken | reads as inactive | Kosmetik | 1 | `design/ui-audit-2026-11/AESTHETICS-ADDENDUM.md` :18 | fix named there | S |
| P84 | Setup, library | planner off, in no profile | a hub is found | Umweg | 2 | `qa/round-5/a/FOLLOWUP.md` F3; `…/kopf-leer/ANALYSIS.md` U16 | ask the maintainer | S |
| P85 | Phone | mail path missing; the plan on the phone never played | capture and plan on both | Sackgasse | 2 | `…/kopf-leer/ANALYSIS.md` U06; `…/wochenende/REVIEW-FABLE.md` R10 | own play-through | M |
| P86 | Subscriptions, documents | a missed date is shown nowhere | „Frist vorbei am …" in the plan too | Fehlt ganz | 2 | `qa/CONSOLIDATED.md` B08 | same group as P72 | S |

## Questions for further research

1. Does „hub" mean the planner on by default (reverses F3 of 2026-11-08)?
2. Is a late invoice still a plan thing („bezahlen") or only a pointer to the invoice?
3. Which way is followed more: plan → source or source → plan? (No usage data; the app has no telemetry by rule.)
4. Does the „empty" impression hold on a normal week, or only on the Sunday of the screenshot? (MEASURE)
5. Is the hub a desktop page first, or equal on the phone?

## Methodology notes

All "users" except the maintainer are simulated personas or agent play-throughs of his scenarios; prevalence counts documents, not people, and M, R6, KL and WE go back to one person, so 4–5 of 7 can still be n = 1. The eight persona reports predate the planner (2026-10-29) and speak about it only indirectly. Not reached: `docs/product/**` holds no persona round on the planner; no `FEEDBACK*` document exists; of `origin/qa/*` only `priya` is quoted (five more branches were only searched for linking words); screenshots were not viewed. Built state was read from decisions and the commit log, not re-tested.
