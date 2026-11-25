/**
 * Nothing of the vault under a plan row or at the planner's foot (planner hub 2, package 4a; hard rule „AI privacy“:
 * `accounts` never gets a planner surface). `PlanPanelHost` refuses `accounts` on its own (`PlanPanelHost.test.tsx`);
 * this pins that the vault's manifest never offers either contribution, and that no module offers one for it.
 */
import { describe, expect, it } from 'vitest';
import { getManifest } from './registry';

describe('plan panels and the vault', () => {
  it('`accounts` has no `planPanel` and no `planPageFoot`', () => {
    const c = getManifest('accounts')?.contributions ?? {};
    expect(c).not.toHaveProperty('planPanel');
    expect(c).not.toHaveProperty('planPageFoot');
  });
});
