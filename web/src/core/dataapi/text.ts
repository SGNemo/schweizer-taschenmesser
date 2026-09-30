/** "Schema für KI kopieren": a compact German text – format, rules, example, short prompt. */
import type { ModuleManifest } from '@/core/modules/types';
import { buildExample } from './example';
import { describeCollection, hasMoney, type FieldFormat } from './format';
import { MAX_ITEMS } from './parse';
import { apiCollections } from './scope';

type Json = Record<string, unknown>;

function typeText(f: FieldFormat): string {
  const s = f.schema as Json;
  if (f.kind === 'money') return 'Zahl in Euro';
  if (f.kind === 'ref') return `Verweis auf ${f.refCollection}`;
  if (Array.isArray(s.enum)) return (s.enum as unknown[]).join('|');
  const pattern = typeof s.pattern === 'string' ? s.pattern : '';
  if (pattern.includes('\\d{4}-\\d{2}-\\d{2}')) return 'Datum JJJJ-MM-TT';
  if (pattern.includes('2[0-3]')) return 'Uhrzeit HH:mm';
  const range =
    typeof s.minimum === 'number' && typeof s.maximum === 'number'
      ? ` ${s.minimum}–${s.maximum}`
      : '';
  switch (s.type) {
    case 'string':
      return 'Text';
    case 'integer':
      return `ganze Zahl${range}`;
    case 'number':
      return `Zahl${range}`;
    case 'boolean':
      return 'Ja/Nein (true/false)';
    case 'array':
      return 'Liste';
    case 'object':
      return `Objekt {${Object.keys((s.properties ?? {}) as Json).join(', ')}}`;
    default:
      return 'Wert';
  }
}

export function buildAiSchemaText(manifest: ModuleManifest): string {
  const lines: string[] = [
    `Erzeuge Daten für die App „Nemo“, Modul „${manifest.name}“, als JSON.`,
    `Antworte nur mit JSON der Form {"items":[…]} (höchstens ${MAX_ITEMS} Einträge).`,
    '',
    'Regeln:',
    '- Jeder Eintrag hat "collection" und die Felder der Sammlung. Keine Zeitstempel; neue Einträge ohne "id" (die App vergibt sie).',
    '- Einen vorhandenen Eintrag ändern: seine "id" und nur die geänderten Felder senden (null löscht ein Feld). Änderungen bestätigt der Nutzer einzeln.',
    '- Datum als JJJJ-MM-TT, Uhrzeit als HH:mm (24 h). Beträge als Zahl in Euro (z. B. 12.5), höchstens zwei Nachkommastellen.',
    '- Verweise: Titel eines vorhandenen Eintrags, oder "@name" mit "key":"name" beim referenzierten Eintrag derselben Sendung.',
    '- Nichts erfinden, Unbekanntes weglassen. Texte sind reiner Text (kein HTML/Markdown).',
    '- Die App zeigt zuerst eine Vorschau; Fehler werden je Eintrag gemeldet, dann korrigierte Einträge erneut senden.',
    '',
    'Sammlungen (! = Pflicht):',
  ];
  for (const collection of apiCollections(manifest)) {
    const f = describeCollection(manifest, collection);
    const fields = f.fields
      .map((x) => `${x.name}${x.required ? '!' : ''}:${typeText(x)}`)
      .join(', ');
    lines.push(`- ${collection} (${f.label}): ${fields}`);
    for (const x of f.fields) {
      const d = (x.schema as Json).description;
      if (typeof d === 'string' && x.kind === 'plain') lines.push(`  ${x.name}: ${d}`);
    }
    if (hasMoney(f)) lines.push('  Optional "currency":"EUR" (andere Währungen werden abgelehnt).');
  }
  lines.push('', 'Beispiel (erfundene Daten):', JSON.stringify({ items: buildExample(manifest) }));
  return lines.join('\n');
}
