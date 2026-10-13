/** Where bug reports go. Both are only opened in the browser / mail app on a click; the app sends nothing. */
export const REPORT_REPO_URL = 'https://github.com/SGNemo/schweizer-taschenmesser';
/** Placeholder: the maintainer sets the real address here. `.invalid` hides the mail button. */
export const REPORT_MAIL = 'bugs@example.invalid';
export const hasReportMail = (): boolean => !REPORT_MAIL.endsWith('.invalid');
