/**
 * Logs carry no personal data by construction: the only fields that can be logged are listed here
 * (no address, name, code, token or amount). `test/logs.test.ts` checks the output as well.
 */
export interface LogFields {
  /** First 8 hex characters of the transaction key (enough to find it, useless to anyone else). */
  txp?: string;
  tier?: string;
  result?: string;
  status?: number;
  attempt?: number;
  kind?: string;
  reason?: string;
}

const ALLOWED = new Set(['txp', 'tier', 'result', 'status', 'attempt', 'kind', 'reason']);

export function log(event: string, fields: LogFields = {}): void {
  const safe: Record<string, string | number> = { event };
  for (const [key, value] of Object.entries(fields)) {
    if (ALLOWED.has(key) && value !== undefined) safe[key] = value;
  }
  console.log(JSON.stringify(safe));
}
