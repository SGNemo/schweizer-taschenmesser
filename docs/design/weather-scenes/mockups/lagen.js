/* The condition list shared by 01-lagen-tag and 02-lagen-nacht (German labels). */
window.LAGEN = [
  ['klar', { cond: 'clear' }],
  ['überwiegend klar', { cond: 'mostlyClear' }],
  ['leicht bewölkt', { cond: 'partly' }],
  ['bedeckt', { cond: 'overcast' }],
  ['Nebel', { cond: 'fog', season: 'autumn' }],
  ['Nieselregen', { cond: 'drizzle', season: 'spring' }],
  ['gefrierender Niesel', { cond: 'freezingDrizzle', season: 'winter' }],
  ['leichter Regen', { cond: 'rain', intensity: 1, season: 'autumn' }],
  ['Regen', { cond: 'rain', intensity: 2, season: 'autumn' }],
  ['starker Regen', { cond: 'rain', intensity: 3, season: 'autumn' }],
  ['gefrierender Regen', { cond: 'freezingRain', season: 'winter' }],
  ['Schauer', { cond: 'showers', body: { t: 0.35 } }],
  ['leichter Schneefall', { cond: 'snow', intensity: 1, season: 'winter' }],
  ['Schneefall', { cond: 'snow', intensity: 2, season: 'winter' }],
  ['starker Schneefall', { cond: 'snow', intensity: 3, season: 'winter' }],
  ['Schneeschauer', { cond: 'snowShowers', season: 'winter', body: { t: 0.35 } }],
  ['Gewitter', { cond: 'thunder', intensity: 2 }],
  ['Gewitter mit Hagel', { cond: 'thunderHail', intensity: 2 }],
  ['leicht bewölkt · windig', { cond: 'partly', wind: 2 }, 'Wind Stufe 2: Bäume geneigt, Windlinien, gestreckte Wolken'],
  ['starker Regen · Sturmböen', { cond: 'rain', intensity: 3, wind: 3, season: 'autumn' }],
  ['klar · Frost', { cond: 'clear', frost: 1, season: 'winter' }, 'Raureif (Frost 1)'],
  ['klar · Frost (streng)', { cond: 'clear', frost: 2, season: 'winter' }, 'Frost 2: Funkeln, gefrorener See'],
  ['klar · Hitze', { cond: 'clear', heat: true }],
  ['klar · Schnee liegt', { cond: 'clear', snowGround: true, season: 'winter' }],
];
window.lagenPage = function (phase, extra) {
  Gallery.tiles('#list', LAGEN.map(function (l) {
    var s = Object.assign({ phase: phase }, l[1], extra && extra(l[1]));
    return { label: l[0], note: l[2], state: s };
  }));
  Gallery.tiles('#phone', LAGEN.filter(function (l, i) { return [0, 2, 3, 4, 8, 11, 13, 16].indexOf(i) >= 0; }).map(function (l) {
    return { label: l[0], state: Object.assign({ phase: phase }, l[1], extra && extra(l[1])) };
  }), { crops: ['phone'], cols: 'four' });
};
