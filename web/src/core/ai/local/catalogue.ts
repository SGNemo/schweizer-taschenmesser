/**
 * The models the app can offer for the built-in local model, with source, size, SHA-256 and licence.
 * Only open weights whose licence allows private use and redistribution (Apache-2.0, MIT). The list
 * is data (`catalogue.json`): a model, its chat template or its checksum can be corrected without
 * touching code. Nothing is downloaded before the user confirmed it in the settings.
 */
import { z } from 'zod';
import raw from './catalogue.json';

/** Chat templates by family: `{system}` and `{user}` are filled in, the answer starts after the text. */
export const TEMPLATES = {
  /** Qwen3 / Qwen3.5 / SmolLM3 in ChatML; an empty think block switches reasoning off. */
  'chatml-nothink':
    '<|im_start|>system\n{system}<|im_end|>\n<|im_start|>user\n{user}<|im_end|>\n<|im_start|>assistant\n<think>\n\n</think>\n\n',
  phi: '<|system|>{system}<|end|><|user|>{user}<|end|><|assistant|>',
  mistral: '[SYSTEM_PROMPT]{system}[/SYSTEM_PROMPT][INST]{user}[/INST]',
  gemma: '<start_of_turn>user\n{system}\n\n{user}<end_of_turn>\n<start_of_turn>model\n',
} as const;

export type TemplateId = keyof typeof TEMPLATES;

const modelSchema = z.object({
  id: z.string().regex(/^[a-z0-9.-]+$/),
  label: z.string(),
  /** `standard` = desktop (3–4B class), `light` = weak machines and phones (≤ 2B class). */
  profile: z.enum(['standard', 'light']),
  repo: z.string().regex(/^[\w.-]+\/[\w.-]+$/),
  file: z.string().regex(/^[\w.-]+\.gguf$/),
  /** Commit of the repository; null = not pinned yet (download locked). */
  revision: z
    .string()
    .regex(/^[0-9a-f]{40}$/)
    .nullable(),
  bytes: z.number().int().positive(),
  sha256: z
    .string()
    .regex(/^[0-9a-f]{64}$/)
    .nullable(),
  template: z.enum(Object.keys(TEMPLATES) as [TemplateId, ...TemplateId[]]),
  baseModel: z.string(),
  license: z.object({ id: z.enum(['apache-2.0', 'mit']), name: z.string(), url: z.string().url() }),
  ramGb: z.number().positive(),
});

export type CatalogueModel = z.output<typeof modelSchema>;

export const LOCAL_MODELS: readonly CatalogueModel[] = z
  .object({ version: z.literal(1), models: z.array(modelSchema) })
  .parse(raw).models;

export const findModel = (id: string): CatalogueModel | undefined =>
  LOCAL_MODELS.find((m) => m.id === id);

export const findModelByFile = (file: string): CatalogueModel | undefined =>
  LOCAL_MODELS.find((m) => m.file === file);

/** Where the file comes from (Hugging Face; the shell only accepts these hosts). */
export const downloadUrl = (m: CatalogueModel): string =>
  `https://huggingface.co/${m.repo}/resolve/${m.revision ?? 'main'}/${m.file}`;

/** The download needs a pinned checksum; without it the button stays locked. */
export const isVerifiable = (m: CatalogueModel): m is CatalogueModel & { sha256: string } =>
  m.sha256 !== null;

export function modelCardUrl(m: CatalogueModel): string {
  return `https://huggingface.co/${m.baseModel}`;
}
