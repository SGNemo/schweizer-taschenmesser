/**
 * Convention: a module route `/<module>/focus/...` is a focus screen. The shell renders it without
 * sidebar, top bar, bottom navigation and quick-add button (one thing, nothing else).
 */
export const isFocusPath = (pathname: string): boolean => /^\/[a-z0-9-]+\/focus\//.test(pathname);
