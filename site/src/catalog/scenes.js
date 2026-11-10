// The four scenes of the features section (round 5, docs/design/site/ROUND-5.md): one large picture per scene.
// `areas` = catalogue areas the scene stands for (names and subtitles come from them), `module` = the catalogue
// module whose page is shown (its hue and icon colour the scene), `shot` = file stem in src/assets/screens
// (`<shot>-…` on the desktop, `<shot>-phone-…` under 48rem). scripts/catalog.test.mjs checks all three.
export const scenes = [
  { areas: ['plan'], module: 'calendar', shot: 'calendar' },
  { areas: ['money'], module: 'finance', shot: 'finance' },
  { areas: ['knowledge', 'household'], module: 'notes', shot: 'notes' },
  { areas: ['vault'], module: 'accounts', shot: 'accounts' },
];
