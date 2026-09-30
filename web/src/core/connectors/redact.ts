/**
 * Strips secrets from text before it is shown, stored or logged. Connector errors carry response
 * snippets and URLs; these must never leak a token, key or the secret ICS address.
 */

const PATTERNS: [RegExp, string][] = [
  // Google: access tokens, refresh tokens, client secrets.
  [/\bya29\.[\w.-]+/g, '[token]'],
  [/\b1\/\/[\w-]{20,}/g, '[token]'],
  [/\bGOCSPX-[\w-]+/g, '[secret]'],
  // Bearer / Basic authorization values.
  [/\b(Bearer|Basic)\s+[\w.~+/=-]{8,}/gi, '$1 [token]'],
  // JWTs.
  [/\beyJ[\w-]{8,}\.[\w-]{8,}\.[\w-]*/g, '[token]'],
  // Query / form parameters that carry secrets.
  [
    /([?&"']?(?:access_token|refresh_token|id_token|client_secret|code|code_verifier|token|key|api_key|private_token)["']?\s*[=:]\s*["']?)[^&\s"',}]+/gi,
    '$1[redacted]',
  ],
  // Secret iCal addresses of calendar services.
  [/(\/ical\/[^/\s]+\/)[\w-]+(\/basic\.ics)/gi, '$1[redacted]$2'],
  [/(\/private-)[0-9a-f]{16,}/gi, '$1[redacted]'],
];

export function redact(text: string): string {
  let out = text;
  for (const [re, replacement] of PATTERNS) out = out.replace(re, replacement);
  return out;
}

/** Also removes literal values (client id/secret the user typed) that no pattern would catch. */
export function redactWith(text: string, literals: readonly (string | undefined)[]): string {
  let out = redact(text);
  for (const value of literals) {
    if (value && value.length >= 6) out = out.split(value).join('[redacted]');
  }
  return out;
}
