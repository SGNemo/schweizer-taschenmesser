// Seam candidates from the identity mapping: same head variant and close hues (cross-area), same widget variant and same/close hue.
const H = { lime: 67, moss: 93, fern: 119, teal: 176, ocean: 202, sky: 228, cobalt: 254, indigo: 280, violet: 306, orchid: 332, slate: 202 };
const M = [
  ['calendar','plan','sky','zeit','zeitleiste','P+G'],['todos','plan','moss','fokus','fokus','P+G'],['habits','plan','violet','fortschritt','fortschritt','P+G'],
  ['timetrack','plan','teal','zeit','kennzahl','P+G'],['weather','plan','cobalt','himmel','himmel','P+G'],['maps','plan','ocean','regal','kacheln','P+G'],
  ['people','plan','orchid','fokus','faellig','P+G'],['finance','money','teal','kennzahl','kennzahl','P+G'],['invoices','money','ocean','fokus','faellig','P+G'],
  ['subscriptions','money','indigo','fortschritt','faellig','P+G'],['budgets','money','lime','kennzahl','fortschritt','P+G'],
  ['lists','household','orchid','kennzahl','checkliste','HTWMD'],['pantry','household','fern','regal','kacheln','HTWMD'],
  ['bookmarks','knowledge','indigo','regal','kacheln','HTWMD'],['notes','knowledge','violet','schreib','notiz','HTWMD'],['chat','knowledge','sky','fokus','notiz','HTWMD'],
  ['browser','knowledge','cobalt','schreib','kacheln','HTWMD'],['feeds','knowledge','moss','regal','kennzahl','HTWMD'],['mail','knowledge','teal','kennzahl','kennzahl','HTWMD'],
  ['music','knowledge','orchid','cover','cover','HTWMD'],['vault','vault','indigo','regal','faellig','HTWMD'],['accounts','vault','slate','tresor','status','HTWMD'],
  ['disk','system','slate','fortschritt','fortschritt','-'],['downloads','system','cobalt','fokus','fortschritt','HTWMD'],
];
const d = (a, b) => { const x = Math.abs(H[a] - H[b]) % 360; return x > 180 ? 360 - x : x; };
console.log('## heads: same variant, hue ≤ 26° apart (adjacent or equal)');
for (let i = 0; i < M.length; i++) for (let j = i + 1; j < M.length; j++) {
  const a = M[i], b = M[j];
  if (a[3] === b[3] && d(a[2], b[2]) <= 26) console.log(`${a[0]} (${a[1]}, ${a[2]}) ↔ ${b[0]} (${b[1]}, ${b[2]}): head ${a[3]}, Δ${d(a[2], b[2])}°${a[1] === b[1] ? ' SAME AREA' : ''}`);
}
console.log('\n## widgets: same variant, hue ≤ 26° apart');
for (let i = 0; i < M.length; i++) for (let j = i + 1; j < M.length; j++) {
  const a = M[i], b = M[j];
  if (a[4] === b[4] && d(a[2], b[2]) <= 26) console.log(`${a[0]} (${a[2]}) ↔ ${b[0]} (${b[2]}): widget ${a[4]}, Δ${d(a[2], b[2])}°`);
}
console.log('\n## hue usage count');
const c = {}; for (const m of M) (c[m[2]] ??= []).push(m[0]); console.log(c);
console.log('\n## head variant usage'); const hv = {}; for (const m of M) (hv[m[3]] ??= []).push(m[0]); console.log(hv);
console.log('\n## widget variant usage'); const wv = {}; for (const m of M) (wv[m[4]] ??= []).push(m[0]); console.log(wv);
