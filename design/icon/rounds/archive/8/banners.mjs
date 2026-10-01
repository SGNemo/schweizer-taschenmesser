// Banner round 8. Feedback: B1 and B2 preferred; the claim becomes a backronym of NEMO (README only).
const A = { parts: [['N', 'otizen'], ['E', 'rinnerungen'], ['M', 'odule'], ['O', 'ffline']] };
const B = { parts: [['N', 'ichts'], ['E', 'ntgeht'], ['M', 'einer'], ['O', 'rganisation']], sep: ' ' };
export default {
  perSheet: 2,
  variants: [
    { label: 'B1a', title: 'W2 mit Schwarm · „Notizen · Erinnerungen · Module · Offline“', desc: 'Backronym 1 unter W2, Anfangsbuchstaben in Logo-Orange.', concept: 'headfin', school: true, tag: A },
    { label: 'B1b', title: 'W2 mit Schwarm · „Nichts entgeht meiner Organisation“', desc: 'Backronym 3 unter W2.', concept: 'headfin', school: true, tag: B },
    { label: 'B2a', title: 'W3 mit Blasen · „Notizen · Erinnerungen · Module · Offline“', desc: 'Backronym 1 unter W3.', concept: 'ofish', bubbles: true, tag: A },
    { label: 'B2b', title: 'W3 mit Blasen · „Nichts entgeht meiner Organisation“', desc: 'Backronym 3 unter W3.', concept: 'ofish', bubbles: true, tag: B },
  ],
};
