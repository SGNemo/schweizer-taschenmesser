/**
 * "Anleitung für KI kopieren": the ready-made instruction for an AI tool that talks to the local
 * API. Contains the address and the workflow – never the token (the user pastes it separately)
 * and never any data. `docs/AI-IMPORT.md` shows the same text.
 */
export function buildApiPrompt(
  port: number,
  source = '<Quelle, z. B. „meine Excel-Liste im Anhang“>',
): string {
  const base = `http://127.0.0.1:${port}`;
  return [
    'Du hilfst mir, Daten in meine App „Nemo“ zu übertragen. Sie hat eine lokale Schnittstelle:',
    `- Adresse: ${base}`,
    '- Jede Anfrage braucht den Header "Authorization: Bearer <TOKEN>" (den Schlüssel gebe ich dir getrennt).',
    '- Sende keine Header "Origin" (die App lehnt Anfragen aus dem Browser ab).',
    '',
    'So gehst du vor:',
    `1. Lies GET ${base}/v1/modules: welche Module du lesen/schreiben darfst, ihre Felder, Beispiele und Hinweise. Das genaue Schema steht unter GET ${base}/v1/openapi.json.`,
    `2. Sammle meine Daten aus ${source}. Erfinde nichts; was du nicht sicher weißt, lässt du weg oder fragst mich.`,
    `3. Prüfe zuerst mit POST ${base}/v1/<modul>/import?dryRun=true, Body {"items":[…]}, Content-Type application/json.`,
    '4. Lies die Antwort: jeder Eintrag hat "status" (ok, duplicate, invalid, update, unchanged) und bei Fehlern "errors". Korrigiere nur die fehlerhaften Einträge und prüfe erneut.',
    '5. Sende dann ohne dryRun, mit einem Header "Idempotency-Key" (z. B. eine zufällige ID pro Sendung). Bei einem Netzwerkfehler denselben Key wiederverwenden – so entstehen keine Doppelten.',
    '6. Die App zeigt mir eine Vorschau; ich bestätige dort. Den Stand siehst du unter GET /v1/batches/<batchId>.',
    '',
    'Regeln:',
    '- Beträge als Zahl in Euro (12.5), Datum JJJJ-MM-TT, Uhrzeit HH:mm. Keine Zeitstempel senden.',
    '- Neue Einträge ohne "id". Verweise: Titel eines vorhandenen Eintrags oder "@key" auf einen Eintrag derselben Sendung (mit "key").',
    '- Vorhandene Einträge nur ändern, wenn ich es ausdrücklich will: "id" plus die geänderten Felder. Löschen geht nicht.',
    '- Höchstens 500 Einträge pro Sendung; größere Mengen in mehreren Sendungen.',
    '- Texte sind reiner Text. Zeig mir am Ende eine kurze Zusammenfassung (wie viele Einträge, welche Fehler übrig blieben).',
  ].join('\n');
}
