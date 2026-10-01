# Icon rounds – decisions so far

Folders: `rounds/6` (last icon round), `rounds/21` (last banner round), `rounds/final` (icon sheet from the real `web/brand` files), `rounds/archive/` (older rounds, kept for the record). Master parameters: `final.params.mjs`; export: `npm run export`.

- Round 1: direction C (orange emblem, white fish, stripes and eye cut out) chosen for the app icon.
- Round 2: C4 (rounded tile instead of circle) is "more modern"; fish should lean more towards the top-right corner.
- Round 3: tilted variants C5 (25°), C6 (35°), C7 (45°) – C6 chosen.
- Round 4: C6 refined one change at a time (C8 eye, C9 stripes, C10 deeper orange, C11 own small-size artwork) – C8 chosen.
- Round 5: C8 refined (C12 deeper orange, C13 wider stripes, C14 eye r 20, C15 small-size artwork) – C12 chosen.
- Round 6: C12 refined (C16 wider stripes, C17 small-size artwork, C18 fish 88 %).
- **Final (2026-10-01): C12** – `rounds/6/variants.mjs` label C12 (= `rounds/archive/5` C12): tile #E0550F, white fish 96 %, 35°, two cut stripes (40), eye r 23. Wordmark: W2.
- Wordmark: W2 (orange Nunito letters between a fish head and a tail fin, `wordmark.mjs` concept `headfin`) is taken for now; bones (G1–G3) and script (S1–S3) stay in round 3 for a later, targeted pass.

## Banner rounds (README header + social preview; `banners.mjs`, `node banners.mjs rounds/<n>`)
- Round 7: W2/W3 compositions (school of marks, bubbles, big fish, waves) – B1 (W2 + school) and B2 (W3 + bubbles) liked.
- Round 8: claim as a backronym of NEMO – "Notizen · Erinnerungen · Module · Offline" fixed by the maintainer.
- Rounds 9–10: W2 head as a clownfish (cut stripe, white band, wider head, forked tail) – B7/B8 liked, fins still not right.
- Rounds 11–13: new wordmark concept `clown` (letters are the body, head band, tail band, round caudal fin, optional fins per letter and bands inside letters). Fins rejected in every form.
- Round 14: readability – letters in text colour (J1/J4) or diagonal candy stripes (J2/J3); maintainer kept orange letters.
- Rounds 15–20: head and caudal fin after the maintainer's reference picture (pointed nose, nearly straight head band, eye with highlight; many fin shapes: flat fan, concave D, narrow-base fan with rounded tips). Bands 24 wide (M2) chosen.
- Round 21: earlier fin shapes side by side – **Final (2026-10-01): Q2** – concept `clown`, `headStyle: 'flat'` (head 170, band 24 at 112, eye 18 with highlight), bands 24 in every letter (`midBand: [116, 300, 524, 746]`), tapering tail base with band + round caudal fin with dark edge (tail 140), no other fins; banner B1 composition (school of marks, backronym claim with orange initials). The app shows the same wordmark top left (`ui/Wordmark.tsx`).
