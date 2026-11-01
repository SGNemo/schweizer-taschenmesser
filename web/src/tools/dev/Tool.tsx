import { lazyOnline } from '@/core/net/OnlineChunk';

/**
 * Thin entry of the tool (precached). The tool itself (`View.tsx`) loads on first use and stays in the
 * runtime cache; opened offline before that, a calm note says it continues once online
 * (docs/perf/COLD-START-2026-10.md).
 */
export default lazyOnline(() => import('./View'));
