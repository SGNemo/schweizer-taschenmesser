import type { TaschenmesserDB } from '@/core/db/db';
import type { ModuleManifest } from '@/core/modules/types';
import type { WriteProposal } from './types';

/**
 * Stage 1: the built-in local model. It may see everything on the device (except modules without an
 * aiSchema – never the vault), so it receives the enabled writable modules, the date and the database.
 * Not provided in this build yet; the pipeline already has the slot.
 */
export interface LocalStage {
  /** Model loaded and the device strong enough. */
  available(): boolean;
  propose(
    text: string,
    ctx: {
      manifests: readonly ModuleManifest[];
      today: string;
      database: TaschenmesserDB;
      signal?: AbortSignal;
    },
  ): Promise<WriteProposal | undefined>;
}

/** The user's choices (Settings → KI) that steer the write stages. */
export interface WriteSettings {
  /** Global switch: off = the assistant can only read. */
  enabled: boolean;
  /** Modules the user excluded from AI writes. */
  modulesOff: readonly string[];
  /** Stage 2 may be used for writes. */
  cloud: boolean;
  /** Ask in the preview when a required field is missing; off = such sentences are not proposed. */
  askMissing?: boolean;
  /** Stage 1; absent = no local model. */
  local?: LocalStage;
}

/** A rule proposal below this is passed on to the next stage. */
export const RULE_ACCEPT = 0.7;
/** The local model's answer below this is passed on (or asked about). */
export const LOCAL_ACCEPT = 0.6;
