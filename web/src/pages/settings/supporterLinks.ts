/**
 * Where supporters pay and where a lost code can be re-sent. Empty = not set up yet: the buttons
 * stay hidden instead of pointing at a dead link. Fill these in once the pages exist
 * (docs/howto/supporter.md → "Offen – macht Sven"); only https URLs, never anything with a token.
 */
export const SUPPORT_PAGE_URL = 'https://ko-fi.com/nemojr';
export const RESEND_PAGE_URL = 'https://nemo-supporter-webhook.nemo-adhd-helper.workers.dev/resend';
/** Contact for "nothing received": the issue form of the public repository. */
export const CONTACT_URL = 'https://github.com/SGNemo/schweizer-taschenmesser/issues/new/choose';
