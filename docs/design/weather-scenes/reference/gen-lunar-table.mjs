import * as A from 'astronomy-engine';
import { writeFileSync } from 'node:fs';
let e = A.SearchLunarEclipse(new Date('2026-11-24T00:00:00Z'));
const rows = [];
while (e.peak.date < new Date('2051-01-01T00:00:00Z')) {
  rows.push([e.peak.date.toISOString().slice(0, 16) + 'Z', ({penumbral:'p',partial:'a',total:'t'})[e.kind], Math.round(e.sd_penum), Math.round(e.sd_partial), Math.round(e.sd_total), Math.round(e.obscuration * 100)]);
  e = A.NextLunarEclipse(e.peak);
}
const out = { source: 'astronomy-engine 2.1.19 (MIT), generated 2026-11-24', columns: ['peak UTC (minute)', 'kind p|a|t = penumbral|partial|total', 'semi-duration penumbral min', 'semi-duration partial min', 'semi-duration total min', 'obscuration at peak, percent of the disc in the umbra'], rows };
writeFileSync('/home/user/schweizer-taschenmesser/docs/design/weather-scenes/reference/lunar-eclipses-2026-2050.json', JSON.stringify(out).replace('"rows":[', '"rows":[\n').replace(/\],\[/g, '],\n[') + '\n');
console.log(rows.length, rows.slice(0,6));
