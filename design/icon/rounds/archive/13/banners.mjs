// Banner round 13. Feedback: fins still not pretty (photo: pale outer edge, dark inner edge, serrated
// front dorsal, rounded rear); plus one variant with a band in every letter.
const A = { parts: [['N', 'otizen'], ['E', 'rinnerungen'], ['M', 'odule'], ['O', 'ffline']] };
const base = { concept: 'clown', school: true, tag: A, wmScale: 0.56 };
const ALL = [116, 300, 524, 746];
export default {
  perSheet: 2,
  variants: [
    { ...base, label: 'H1', title: 'Streifen in jedem Buchstaben, keine Flossen', desc: 'Band in N, e, m und o (nur innerhalb der Buchstaben), Kopf, Schwanzband, runde Schwanzflosse.', wm: { midBand: ALL } },
    { ...base, label: 'H2', title: 'Nur im e, Rückenflosse neu (aus G2)', desc: 'Flossen nach dem Foto: heller Saum aussen, schwarze Kante innen, vorne gezackt, hinten rund; mittig über dem m.', wm: { midBand: 300, dorsalOn: 'm' } },
    { ...base, label: 'H3', title: 'Streifen überall + Rückenflosse (aus H1)', desc: 'H1 mit der neuen Rückenflosse über dem m.', wm: { midBand: ALL, dorsalOn: 'm' } },
    { ...base, label: 'H4', title: 'Streifen überall + drei Flossen (aus H3)', desc: 'Dazu Bauchflosse unter dem e und Afterflosse unter dem o, alle in der neuen Form.', wm: { midBand: ALL, dorsalOn: 'm', ventralOn: ['e', 'o'] } },
  ],
};
