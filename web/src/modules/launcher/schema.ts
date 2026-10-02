import { z } from 'zod';

/** Only these schemes are opened: they are what the native shell's opener is allowed to launch. */
const SCHEME = /^(https?:|mailto:|tel:)/i;

/** Adds `https://` to a bare address ("dhl.de"); undefined when the result is not a launchable link. */
export function normalizeLaunchUrl(input: string): string | undefined {
  const text = input.trim();
  if (!text || /\s/.test(text)) return undefined;
  const withScheme = SCHEME.test(text)
    ? text
    : /^[a-z][a-z0-9+.-]*:/i.test(text)
      ? ''
      : `https://${text}`;
  if (!withScheme) return undefined;
  try {
    const url = new URL(withScheme);
    if (
      /^https?:$/.test(url.protocol) &&
      (!url.hostname.includes('.') || url.username || url.password)
    )
      return undefined;
    return url.href;
  } catch {
    return undefined;
  }
}

/** One launcher tile. `url` is normalised on write, so stored links are always launchable. */
export const linkSchema = z.object({
  title: z.string().trim().min(1),
  url: z
    .string()
    .refine((u) => normalizeLaunchUrl(u) !== undefined, { message: 'not a launchable address' })
    .transform((u) => normalizeLaunchUrl(u)!),
  group: z.string().trim().optional(),
});

export type Link = z.output<typeof linkSchema>;
