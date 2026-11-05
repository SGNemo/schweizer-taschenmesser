import { useRef } from 'react';

/**
 * Wraps a submit handler so that a second submit while the first one still runs is ignored (the
 * second click of a double click, Enter and a click at once): one save, never two records. A
 * submit event is always kept from reloading the page, also when it is ignored.
 */
export function useSubmitOnce<A extends unknown[]>(
  handler: (...args: A) => void | Promise<unknown>,
): (...args: A) => Promise<void> {
  const running = useRef(false);
  return async (...args: A) => {
    if (running.current) {
      (args[0] as { preventDefault?: () => void } | undefined)?.preventDefault?.();
      return;
    }
    running.current = true;
    try {
      await handler(...args);
    } finally {
      running.current = false;
    }
  };
}
