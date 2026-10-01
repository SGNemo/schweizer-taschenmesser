// Banner round 9. Feedback: B1a (W2) and B2a (W3) preferred, the claim is fixed; the W2 head
// should read more like a clownfish. Each variant changes one thing on B1a.
const A = { parts: [['N', 'otizen'], ['E', 'rinnerungen'], ['M', 'odule'], ['O', 'ffline']] };
const base = { concept: 'headfin', school: true, tag: A };
export default {
  perSheet: 3,
  variants: [
    { ...base, label: 'B1a', title: 'Basis aus Runde 8', desc: 'Unverändert zum Vergleich.' },
    { ...base, label: 'B5', title: 'Streifen ausgestanzt (aus B1a)', desc: 'Ein Streifen hinter dem Auge wie im App-Icon, der Hintergrund scheint durch.', wm: { stripe: 34, stripeAt: 104 } },
    { ...base, label: 'B7', title: 'Weisser Streifen mit Rand (aus B1a)', desc: 'Weisses Band mit dunklem Rand wie beim o-Fisch in W3.', wm: { band: 30, stripeAt: 100 } },
    { ...base, label: 'B8', title: 'Breiterer Kopf + Band + Kerbe (aus B7)', desc: 'Kopf 190 statt 150 breit, Band weiter hinten, Schwanzflosse mit Kerbe.', wm: { band: 32, stripeAt: 128, head: 190, tailStyle: 'fork' } },
    { label: 'B2a', title: 'W3 mit Blasen (Vergleich)', desc: 'Unverändert aus Runde 8.', concept: 'ofish', bubbles: true, tag: A },
  ],
};
