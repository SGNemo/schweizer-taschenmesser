// Banner round 12. Feedback: F4 liked, the striped e of F3 liked, the long fins not at all; fins
// may only sit centred above or below a single letter.
const A = { parts: [['N', 'otizen'], ['E', 'rinnerungen'], ['M', 'odule'], ['O', 'ffline']] };
const base = { concept: 'clown', school: true, tag: A, wmScale: 0.56 };
export default {
  perSheet: 2,
  variants: [
    { ...base, label: 'G1', title: 'F4 + gestreiftes e', desc: 'Nur Kopf, Bänder und runde Schwanzflosse; das mittlere Band läuft durch das e.', wm: { midBand: 300 } },
    { ...base, label: 'G2', title: 'Rückenflosse über dem m (aus G1)', desc: 'Eine kleine Rückenflosse, mittig über dem m.', wm: { midBand: 300, dorsalOn: 'm' } },
    { ...base, label: 'G3', title: 'Rücken über m, Bauch unter e (aus G2)', desc: 'Dazu eine kleine Bauchflosse mittig unter dem e.', wm: { midBand: 300, dorsalOn: 'm', ventralOn: 'e' } },
    { ...base, label: 'G4', title: 'Rücken über e, Afterflosse unter o (aus G1)', desc: 'Flossen weiter vorne bzw. hinten: Rückenflosse über dem e, Afterflosse unter dem o.', wm: { midBand: 300, dorsalOn: 'e', ventralOn: 'o' } },
  ],
};
