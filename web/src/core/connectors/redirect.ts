/** The address a provider sends the user back to after a browser (PWA) login: the app's own origin. */
export const REDIRECT_PATH = '/oauth/callback';

/** Without a page (tests, workers) only the path is known. */
export const redirectUri = (): string =>
  typeof location === 'undefined' ? REDIRECT_PATH : `${location.origin}${REDIRECT_PATH}`;
