// Banner round 7. Feedback: the banners are not appealing; W2 and W3 were liked. Each variant is one
// composition; the wordmark stays W2 (headfin) or W3 (ofish) in the final logo orange.
export default {
  perSheet: 2,
  variants: [
    { label: 'B1', title: 'W2 mit Schwarm', desc: 'Wortmarke W2 gross und zentriert, im Hintergrund ein loser Schwarm kleiner Fische (der geneigte Fisch aus dem App-Icon, 10–16 % Deckkraft).', concept: 'headfin', school: true },
    { label: 'B2', title: 'W3 (o ist der Fisch) mit Blasen', desc: 'Wortmarke W3: „Nem“ in Schriftfarbe, das o ist der Clownfisch. Dazu dezente Blasen links und rechts.', concept: 'ofish', bubbles: true },
    { label: 'B3', title: 'W2 links, grosser Fisch am Rand', desc: 'Linksbündig mit Claim darunter; rechts ragt der grosse Fisch als blasses Wasserzeichen aus dem Bild.', concept: 'headfin', layout: 'left', bigfish: true },
    { label: 'B4', title: 'W3 links, Wellen', desc: 'Linksbündig mit W3; unten zwei weiche Wellenbänder in Logo-Orange, Ozean-Gefühl ohne Illustration.', concept: 'ofish', layout: 'left', waves: true, wmScale: 0.44 },
  ],
};
