export type JsonResult =
  { ok: true; pretty: string; minified: string } | { ok: false; message: string };

export function parseJson(text: string): JsonResult {
  try {
    const value: unknown = JSON.parse(text);
    return {
      ok: true,
      pretty: JSON.stringify(value, null, 2),
      minified: JSON.stringify(value),
    };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}
