/**
 * UI audit 2026-11: turns the facts files of the tour (`audit-tour.spec.ts`) into the tables of REPORT.md.
 * Usage (web/): node ../docs/design/ui-audit-2026-11/tools/summarize.mjs [.screens/ui-audit] > ../docs/design/ui-audit-2026-11/MEASURES.md
 * Reads <dir>/<viewport>-<scheme>/<seed|empty>/facts-*.json and prints Markdown: stimulus per page, head and type
 * consistency, surfaces (borders / shadows / tints), motion, states, dialogs, layout shift, axe, phone targets.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.argv[2] ?? '.screens/ui-audit';
const runs = [];
for (const vp of readdirSync(root)) {
  if (!/^\d+x\d+-(light|dark)$/.test(vp)) continue;
  for (const part of ['seed', 'empty']) {
    const file = path.join(root, vp, part, `facts-${part}.json`);
    if (existsSync(file)) runs.push({ vp, part, facts: JSON.parse(readFileSync(file, 'utf8')) });
  }
}
const pick = (vp, part) => runs.find((r) => r.vp === vp && r.part === part)?.facts;
const fmt = (n) => (n === null || n === undefined ? '–' : typeof n === 'number' ? (Number.isInteger(n) ? String(n) : n.toFixed(2)) : String(n));
const pages = (facts) => Object.entries(facts).filter(([k, v]) => k.startsWith('page-') && !k.includes('--') && v && v.stimulus);

const out = [];
out.push('Definitionen (aus `audit-tour.spec.ts` `measure()`, je Ansicht im Element `#main`, also ohne Seitenleiste und Topbar): **Aktionen** = sichtbare button/a[href]/input/select/textarea/[role=button|tab|switch|checkbox|menuitem], deren Box im ersten Bildschirm liegt (Oberkante über der Fensterhöhe, Unterkante über 0); **Chrome** = davon ohne Vorfahren li/[data-row]/table/[role=gridcell|grid]/article/Widget/dialog (also Navigation, Toolbars, Kopf) – gezählt über den ganzen Falz, nicht nur oberhalb des Inhalts; **Inhalt ab y** = kleinste Oberkante (> 60 px) eines sichtbaren Listen-/Tabellen-/Raster-/Artikel-/Widget-/Karten-/Canvas-Elements in `#main`, das nicht in nav/[role=tablist]/dialog/aside/Kopfband liegt (fehlt, wenn die Seite keines hat); **Kopf px** = Höhe des ersten `[data-size]`-Elements (Kopfband bzw. Kopfkarte); **Primär** = Knöpfe/Links mit Klasse `primary`; **Farbe Text/Icon/Fläche** = Elemente über dem Falz, deren Text-/Icon-/Hintergrundfarbe nicht eine der neutralen Tinten (--text, --text-muted, --text-3, --text-on-tint bzw. --bg, --surface, --surface-2) ist und Sättigung > 0,25 (Text/Icon) bzw. > 0,12 (Fläche); `color(srgb …)`-Werte aus `color-mix()` werden geparst; **Verläufe** = Elemente mit `background-image: …gradient` (Kopfband, Bank-Karten, Avatar-Ringe); **Wörter/Zeichen** = Textknoten sichtbarer Elemente über dem Falz; **Schriftgrößen/Gewichte** = verschiedene Werte an Textblättern über dem Falz; **Abstandswerte** = verschiedene gap/rowGap/paddingTop/paddingLeft-Werte sichtbarer Elemente (erste 2 500); **Rahmen** = gleiche Breite > 0 und `solid` auf allen vier Seiten mit sichtbarer Farbe (Alpha > 0,05), Element ≥ 40×24 px, keine input/select/textarea/button; **Ring** = `box-shadow`, dessen Segmente alle ohne Versatz und ohne Weichzeichnung sind (0 0 0 n px, inset oder nicht); **Schatten** = jeder andere `box-shadow` (ein inset mit Weichzeichnung zählt als Schatten); **getönt** = Hintergrund weder --bg/--surface/--surface-2 noch transparent, Sättigung > 0,12 (ohne button/input/select/tab); **neutrale Füllungen** = dasselbe ohne Sättigung (Hover, Bahnen, Scrims; nur in den facts); **--surface-2** separat; **Zeilen** = `[data-row]`-Elemente, Höhe des umschließenden `li` (sonst des Elements), Median/min/max; **CLS** = laufende Summe aller `layout-shift`-Einträge ohne kürzliche Eingabe seit `page.goto` der Ansicht (bei Reiter-Ansichten kumuliert seit dem Laden der Seite); Flächen-/Zeilen-/Bewegungs-Zählung über die ganze Seite, nicht nur den Falz, aber höchstens die ersten 6 000 Elemente von `#main` (`all.slice(0, 6000)`); **Inhalt ab y** schließt nur das Modul-Kopfband (`module-frame`) aus – auf Bibliothek, Werkzeugen und Einstellungen (93/169/174) liegen die gemessenen Elemente in der Kopfkarte; **Animationen** = Elemente mit `animationName ≠ none` (auch beendete Einblendungen), auf 10 gekappt; **CLS** bei Dialogen kumuliert seit dem Laden der Seite (ab dem nächsten Lauf: vor Palette und Werkzeug-Panel auf 0 gesetzt). Seed = Testdaten „medium“, alle Module an; Desktop posiert als Windows-App in Linux-Headless-Chromium.');
const h = (s) => out.push(`\n### ${s}\n`);
const table = (head, rows) => { out.push(`| ${head.join(' | ')} |`); out.push(`| ${head.map(() => '---').join(' | ')} |`); for (const r of rows) out.push(`| ${r.map(fmt).join(' | ')} |`); };

for (const [vp, part] of [['1920x1080-dark', 'seed'], ['412x915-dark', 'seed'], ['1920x1080-dark', 'empty']]) {
  const f = pick(vp, part);
  if (!f) continue;
  h(`Reizlast über dem Falz – ${vp}, ${part}`);
  table(
    ['Seite', 'Aktionen', 'davon Chrome', 'Inhalt ab y', 'Kopf px', 'Primär', 'Farbe Text', 'Farbe Fläche', 'Verläufe', 'Farbe Icon', 'Wörter', 'Zeichen', 'Schriftgrößen', 'Gewichte', 'CLS'],
    pages(f).map(([k, v]) => [k.replace('page-', ''), v.stimulus.actionsAboveFold, v.stimulus.chromeActions, v.stimulus.firstContentY, v.head?.height ?? '–', v.stimulus.primaries.length, v.stimulus.colouredText, v.stimulus.colouredSurfaces, v.stimulus.gradients, v.stimulus.colouredIcons, v.stimulus.words, v.stimulus.textChars, Object.keys(v.fontSizes).length, Object.keys(v.fontWeights).length, v.cls]),
  );
}

const d = pick('1920x1080-dark', 'seed');
if (d) {
  h('Köpfe und Typografie – 1920 dunkel, Seed');
  table(
    ['Seite', 'Kopf px', 'Größenklasse', 'h1 Größe/Gewicht/Schrift', 'h2/h3-Varianten', 'Zeilen (n · Median · min–max)', 'Abstandswerte', 'Icons (px/stroke)'],
    pages(d).map(([k, v]) => [k.replace('page-', ''), v.head?.height ?? '–', v.head?.size ?? '–', v.h1 ? `${v.h1.size}/${v.h1.weight}/${v.h1.family}` : '–', Object.keys(v.headings).length, v.rows.n ? `${v.rows.n} · ${v.rows.median} · ${v.rows.min}–${v.rows.max}` : '–', v.spacing.distinct, Object.entries(v.icons).slice(0, 4).map(([a, b]) => `${a}×${b}`).join(', ')]),
  );
  h('Flächen: Rahmen vs. Schatten vs. Tönung – 1920 dunkel, Seed');
  table(
    ['Seite', 'Rahmen (rundum)', 'Ringe', 'Schatten', 'getönt', 'neutrale Füllungen', '--surface-2', 'Verläufe', 'Radien (px×n)', 'Animationen', 'Transitions (Eigenschaft×n)'],
    pages(d).map(([k, v]) => [k.replace('page-', ''), v.surfaces.bordered, v.surfaces.ringed, v.surfaces.shadowed, v.surfaces.tinted, v.surfaces.neutralFills ?? '–', v.surfaces.surface2, v.surfaces.gradients, Object.entries(v.surfaces.radii).map(([a, b]) => `${a}×${b}`).join(', '), v.motion.animated.length, Object.entries(v.motion.transitions).slice(0, 5).map(([a, b]) => `${a}×${b}`).join(', ')]),
  );
  h('Dialoge – 1920 dunkel, Seed');
  table(
    ['Modul', 'Auslöser', 'Titel', 'Felder', 'Knöpfe', 'Breite×Höhe', 'Primär'],
    Object.entries(d).filter(([k]) => k.startsWith('dialog-')).map(([k, v]) => [k.replace('dialog-', ''), v.trigger ?? '–', v.title ?? '–', v.fields ?? '–', v.buttons ?? '–', v.box ? `${Math.round(v.box.width)}×${Math.round(v.box.height)}` : '–', v.stimulus ? v.stimulus.primaries.join(' / ') : '–']),
  );
  if (d.states) {
    h('Zustände (Rechnungen, 1920 dunkel)');
    out.push('```json'); out.push(JSON.stringify(d.states, null, 1)); out.push('```');
  }
  h('axe (serious/critical) – 1920 dunkel, Seed');
  const ax = [];
  for (const [k, v] of Object.entries(d)) if (v && Array.isArray(v.axe)) for (const a of v.axe) if (a.impact === 'serious' || a.impact === 'critical') ax.push([k, a.id, a.impact, a.n, a.targets[0] ?? '']);
  table(['Seite', 'Regel', 'Schwere', 'n', 'Erstes Ziel'], ax.slice(0, 40));
  if (d.widgetSizes) {
    h('Widget-Größen (Übersicht „Ausführlich“, 1920)');
    table(['Widget', 'Breite', 'Höhe'], Object.entries(d.widgetSizes).map(([k, v]) => [k.replace('widget-', ''), v.w, v.h]));
  }
}
const p = pick('412x915-dark', 'seed');
if (p) {
  h('Handy: Köpfe und Zeilenhöhen – 412 dunkel, Seed');
  table(['Seite', 'Kopf px', 'Inhalt ab y', 'Zeilen (n · Median · min–max)'], pages(p).map(([k, v]) => [k.replace('page-', ''), v.head?.height ?? '–', v.stimulus.firstContentY, v.rows.n ? `${v.rows.n} · ${v.rows.median} · ${v.rows.min}–${v.rows.max}` : '–']));
  h('Layout-Sprung (CLS) über alle Läufe – nur Werte, die in mindestens zwei Läufen ≥ 0,05 sind');
  const byPage = new Map();
  for (const r of runs) for (const [k, v] of Object.entries(r.facts)) if (v && typeof v.cls === 'number' && v.cls >= 0.05) (byPage.get(k) ?? byPage.set(k, []).get(k)).push(`${r.vp.replace('1920x1080', 'D').replace('412x915', 'P')}/${r.part} ${v.cls.toFixed(2)}`);
  table(['Seite', 'Läufe mit CLS ≥ 0,05'], Array.from(byPage.entries()).filter(([, l]) => l.length >= 2).map(([k, l]) => [k, l.join(', ')]));
  h('Handy: kleine Ziele (< 40 px) und abgeschnittener Text – 412 dunkel, Seed');
  const rows = [];
  for (const [k, v] of Object.entries(p)) if (v && (v.small?.length || v.clipped?.length)) rows.push([k, v.small?.length ?? 0, (v.small ?? []).slice(0, 2).join('; '), v.clipped?.length ?? 0, (v.clipped ?? []).slice(0, 2).join('; ')]);
  table(['Seite', 'klein n', 'Beispiele', 'abgeschnitten n', 'Beispiele'], rows.slice(0, 40));
}
for (const r of runs) {
  const over = Object.entries(r.facts).filter(([, v]) => v && v.overflow && (v.overflow.doc > 0 || v.overflow.main > 0)).map(([k, v]) => `${k} (${v.overflow.doc}/${v.overflow.main})`);
  out.push(`\nÜberlauf ${r.vp} ${r.part}: ${over.length ? over.join(', ') : 'keiner'}`);
}
console.log(out.join('\n'));
