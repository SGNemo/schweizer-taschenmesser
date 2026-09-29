import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { openStore } from '../src/store.js';
import { hlc, op } from './helpers.js';

describe('store persistence', () => {
  it('keeps data, epoch, vault and the sequence across restarts', () => {
    const dir = mkdtempSync(join(tmpdir(), 'tm-sync-'));
    try {
      const path = join(dir, 'sync.db');
      const first = openStore(path);
      const epoch = first.epoch();
      first.setVault({ salt: 'c2FsdHNhbHRz', check: 'checkcheck' });
      first.push([op('title', hlc(1000), 'x'), op('done', hlc(1000), true)]);
      first.close();

      const second = openStore(path);
      expect(second.epoch()).toBe(epoch);
      expect(second.vault()).toEqual({ salt: 'c2FsdHNhbHRz', check: 'checkcheck' });
      expect(second.pull(0, 10).ops).toHaveLength(2);
      // The next accepted op continues the sequence instead of reusing numbers.
      expect(second.push([op('title', hlc(2000), 'y')]).cursor).toBe(3);
      second.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
