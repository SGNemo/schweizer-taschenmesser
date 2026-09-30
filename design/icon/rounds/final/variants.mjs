// Final preview sheet: renders the files that are actually exported to web/brand (not parameters),
// so the sheet shows exactly what the app uses. Regenerate with: node render-round.mjs rounds/final
export default {
  title: 'final',
  subtitle: 'C12 (App-Icon) + W2 (Wortmarke), gelesen aus web/brand. Orange #E0550F, Kachel + weisser Fisch, 35° nach oben rechts.',
  variants: [
    {
      label: 'Final',
      title: 'C12 – aus web/brand',
      desc: 'app-icon.svg, logo-mark.svg, logo-mono.svg, android-foreground/-monochrome.svg; Android-Hintergrund #E0550F.',
      files: {
        full: 'web/brand/app-icon.svg',
        mark: 'web/brand/logo-mark.svg',
        mono: 'web/brand/logo-mono.svg',
        adFg: 'web/brand/android-foreground.svg',
        adBg: '#E0550F',
        adMono: 'web/brand/android-monochrome.svg',
      },
    },
  ],
  wordmarks: [
    {
      label: 'W2',
      title: 'Wortmarke – aus web/brand',
      desc: 'logo-wordmark.svg (hell) / logo-wordmark-light.svg (dunkel): orange Nunito-Buchstaben zwischen Fischkopf und Flosse.',
      files: { light: 'web/brand/logo-wordmark.svg', dark: 'web/brand/logo-wordmark-light.svg' },
    },
  ],
};
