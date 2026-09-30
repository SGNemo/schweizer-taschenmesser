#!/usr/bin/env node
/**
 * Prints the release asset names (one per line) for the release workflow, so the list lives in
 * `lib/releaseAssets.ts` only. Usage: `node scripts/release-assets.mjs`
 */
import { RELEASE_ASSETS } from './lib/releaseAssets.ts';

process.stdout.write(`${RELEASE_ASSETS.join('\n')}\n`);
