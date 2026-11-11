// The picture slots of the site (docs/design/site/SLOTS.md is the hand-over spec for the screenshot chat).
// A slot is a named place with a fixed aspect ratio: `ratio` from 48rem, `ratioPhone` below. Today a drawn
// placeholder fills it; when src/assets/slots/<name>-{desk,phone}-{light,dark}.png exist (written by
// `npm run app:screenshots`), components/Slot.astro shows them instead and nothing around the slot moves.
// `app` tells scripts/app-screenshots.mjs what to capture: `path` in the app (verified routes only), `clip` an
// optional CSS selector the picture is cut to, and `todo` what the screenshot chat still has to add once the app's
// UI is final (the script prints it and shoots the whole viewport until then). `desk` / `phone` are the capture
// sizes in CSS px (the phone at 2x); they have the slot's ratio.
export const slots = {
  now: { page: 'home', ratio: '4x3', ratioPhone: '4x5', desk: [1280, 960], phone: [412, 515], app: { path: '/', clip: null, todo: 'cut to the card "Jetzt dran" (selector)' } },
  plan: { page: 'home', ratio: '4x3', ratioPhone: '4x3', desk: [1280, 960], phone: [412, 309], app: { path: '/', clip: null, todo: 'cut to the plan for today (selector)' } },
  focus: { page: 'home', ratio: '4x3', ratioPhone: '4x3', desk: [1280, 960], phone: [412, 309], app: { path: '/', clip: null, todo: 'open the focus mode on the suggested task first' } },
  capture: { page: 'home', ratio: '4x3', ratioPhone: '4x3', desk: [1280, 960], phone: [412, 309], app: { path: '/', clip: null, todo: 'open quick capture and type "morgen 15 Uhr Zahnarzt"' } },
  money: { page: 'home', ratio: '4x3', ratioPhone: '4x3', desk: [1280, 960], phone: [412, 309], app: { path: '/budgets', clip: null } },
  library: { page: 'modules', ratio: '4x3', ratioPhone: '4x3', desk: [1280, 960], phone: [412, 309], app: { path: '/library', clip: null } },
};
