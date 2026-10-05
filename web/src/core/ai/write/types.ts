import type { IconName } from '@/ui/icons';
import type { AiActionKind } from '@/core/modules/types';

/** Where a proposal came from: free rules, the built-in local model, the cloud, or the answer cache. */
export type Stage = 'rule' | 'local' | 'cloud' | 'cache';

/** One thing the user may want done; produced by any stage, checked by `prepareOp`. */
export interface ProposedOp {
  module: string;
  /** Key of the module's `aiSchema.actions`. */
  action: string;
  /** Field values in aiSchema field names (money in cents, dates YYYY-MM-DD). */
  data?: Record<string, unknown>;
  /** update / transition / delete: `id` is exact, `title` is matched against the stored entries locally. */
  target?: { id?: string; title?: string };
}

export interface WriteProposal {
  ops: ProposedOp[];
  stage: Stage;
  /** 0..1; stage 0 is only accepted above the threshold. */
  confidence: number;
  /** A short German question when the stage could not decide; shown instead of guessing. */
  question?: string;
}

export interface DiffLine {
  field: string;
  label: string;
  /** Update/delete: the stored value; absent for new entries. */
  from?: string;
  to?: string;
}

export interface TargetCandidate {
  id: string;
  title: string;
}

/** An op after validation: what the preview card shows and what gets written on confirmation. */
export interface PreparedOp {
  index: number;
  module: string;
  moduleName: string;
  moduleIcon: IconName;
  action: string;
  actionLabel: string;
  kind: AiActionKind;
  collection: string;
  collectionLabel: string;
  /** update / transition / delete: the resolved entry. */
  targetId?: string;
  targetTitle?: string;
  /** Entries to choose from when the target was ambiguous (or not found: empty). */
  candidates: TargetCandidate[];
  /** `create`: the full validated record; `update`/`transition`: the patch. */
  data: Record<string, unknown>;
  /** Stored values of the patched fields (update/transition) or of the whole record (delete). */
  before?: Record<string, unknown>;
  lines: DiffLine[];
  /** Required fields that are still empty. */
  missing: string[];
  /** The entry to change could not be found / is not unique yet. */
  needsTarget: boolean;
  /** Set when the op cannot be written as it is. */
  error?: string;
  ready: boolean;
}
