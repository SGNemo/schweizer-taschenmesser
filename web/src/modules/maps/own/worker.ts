/// <reference lib="webworker" />
import { handle, transferables, type BuildRequest } from './work';

/** Parsing, cutting and encoding run here, off the page; the builder keeps the network and the database. */
self.onmessage = (e: MessageEvent<BuildRequest>) => {
  const result = handle(e.data);
  self.postMessage(result, transferables(result));
};
