import { create } from 'zustand';
import { getPlatform } from '@/core/platform';
import type { DownloadJob } from '@/core/platform/downloads';

interface JobsState {
  /** `undefined` until the first list arrived. */
  jobs: DownloadJob[] | undefined;
}

export const useJobs = create<JobsState>(() => ({ jobs: undefined }));

let watching = false;

/** Starts watching the native list once; every later call is a no-op. */
export function ensureWatching(): void {
  const service = getPlatform().downloads;
  if (watching || !service.supported) return;
  watching = true;
  service
    .watch((jobs) => useJobs.setState({ jobs }))
    .catch(() => {
      watching = false;
    });
}
