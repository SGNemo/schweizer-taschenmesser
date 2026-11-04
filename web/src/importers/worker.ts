/// <reference lib="webworker" />
import { JOBS, type JobName } from './jobs';

interface Request {
  id: number;
  name: JobName;
  input: never;
}

self.onmessage = (event: MessageEvent<Request>) => {
  const { id, name, input } = event.data;
  try {
    const out = (JOBS[name] as (i: never, p: (d: number, t: number) => void) => unknown)(
      input,
      (done, total) => self.postMessage({ id, type: 'progress', done, total }),
    );
    self.postMessage({ id, type: 'done', out });
  } catch (e) {
    self.postMessage({ id, type: 'error', message: e instanceof Error ? e.message : String(e) });
  }
};
