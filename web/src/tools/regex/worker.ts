/// <reference lib="webworker" />
import { runRegex, type RegexRequest } from './logic';

/** The pattern runs here, off the page: if it hangs, `run.ts` terminates this worker. */
self.onmessage = (e: MessageEvent<RegexRequest>) => {
  self.postMessage(runRegex(e.data));
};
