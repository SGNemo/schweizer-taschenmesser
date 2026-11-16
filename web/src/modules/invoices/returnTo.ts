/**
 * Where the pay step hands the person back after „Bezahlt“ (planner hub M-1): `?from=<key>` on the pay route is
 * untrusted input like `?open` and `?do` (CONCEPT-LINKS §2 L7). It is only a key into this fixed list; its
 * value never becomes a route, so no link can send the person anywhere else. Any other value means „stay“.
 */
const RETURN_ROUTES = {
  plan: '/planner',
} as const;

export type ReturnFrom = keyof typeof RETURN_ROUTES;

/** The in-app route `from` names on the allow-list, else `undefined` (stay on the invoices page). */
export function returnRoute(from: string | null | undefined): string | undefined {
  if (!from || !Object.hasOwn(RETURN_ROUTES, from)) return undefined;
  return RETURN_ROUTES[from as ReturnFrom];
}
