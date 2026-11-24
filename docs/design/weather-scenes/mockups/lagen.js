/* The condition list shared by 01-lagen-tag and 02-lagen-nacht (German labels). */
window.LAGEN = [
  ['Klar', { cond: 'clear' }],
  ['Überwiegend klar', { cond: 'mostlyClear' }],
  ['Teils bewölkt', { cond: 'partly' }],
  ['Bedeckt', { cond: 'overcast' }],
  ['Nebel', { cond: 'fog', season: 'autumn' }],
  ['Niesel', { cond: 'drizzle', season: 'spring' }],
  ['Gefrierender Niesel', { cond: 'freezingDrizzle', season: 'winter' }],
  ['Regen leicht', { cond: 'rain', intensity: 1, season: 'autumn' }],
  ['Regen mäßig', { cond: 'rain', intensity: 2, season: 'autumn' }],
  ['Regen stark', { cond: 'rain', intensity: 3, season: 'autumn' }],
  ['Gefrierender Regen', { cond: 'freezingRain', season: 'winter' }],
  ['Schauer', { cond: 'showers', body: { t: 0.35 } }],
  ['Schnee leicht', { cond: 'snow', intensity: 1, season: 'winter' }],
  ['Schnee mäßig', { cond: 'snow', intensity: 2, season: 'winter' }],
  ['Schnee stark', { cond: 'snow', intensity: 3, season: 'winter' }],
  ['Schneeschauer', { cond: 'snowShowers', season: 'winter', body: { t: 0.35 } }],
  ['Gewitter', { cond: 'thunder', intensity: 2 }],
  ['Gewitter mit Hagel', { cond: 'thunderHail', intensity: 2 }],
  ['Wind (Stufe 2)', { cond: 'partly', wind: 2 }, 'Bäume geneigt, Windlinien, gestreckte Wolken'],
  ['Sturm mit Regen (Stufe 3)', { cond: 'rain', intensity: 3, wind: 3, season: 'autumn' }],
  ['Raureif (Frost 1)', { cond: 'clear', frost: 1, season: 'winter' }],
  ['Strenger Frost (Frost 2)', { cond: 'clear', frost: 2, season: 'winter' }],
  ['Hitze', { cond: 'clear', heat: true }],
  ['Schnee liegt, klarer Himmel', { cond: 'clear', snowGround: true, season: 'winter' }],
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
