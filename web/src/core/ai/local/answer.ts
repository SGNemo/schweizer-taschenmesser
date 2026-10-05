import { z } from 'zod';
import type { WriteProposal } from '../write/types';

const answerSchema = z.object({
  ops: z
    .array(
      z.object({
        module: z.string().min(1),
        action: z.string().min(1),
        target: z.string().optional(),
        data: z.record(z.string(), z.unknown()).optional(),
      }),
    )
    .max(8),
  confidence: z.number().min(0).max(1),
  question: z.string().default(''),
});

/**
 * Turns the model's text into a proposal of stage 1. Anything that is not valid JSON of that shape,
 * and every answer without an op ("not a request to write"), is `undefined`: the next stage decides.
 */
export function parseAnswer(text: string): WriteProposal | undefined {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return undefined;
  }
  const parsed = answerSchema.safeParse(json);
  if (!parsed.success || parsed.data.ops.length === 0) return undefined;
  const { ops, confidence, question } = parsed.data;
  return {
    ops: ops.map((o) => ({
      module: o.module,
      action: o.action,
      ...(o.data ? { data: o.data } : {}),
      ...(o.target ? { target: { title: o.target } } : {}),
    })),
    stage: 'local',
    confidence,
    ...(question.trim() ? { question: question.trim() } : {}),
  };
}
