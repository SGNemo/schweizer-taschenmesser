/**
 * Places outside the vault and accounts pages that show one of their titles (a palette hit, a reminder): the reading
 * aid never touches credential screens (DESIGN-SPEC §4c; `NO_READ_AID_MODULES` in the router covers the pages
 * themselves), and the same holds for a row that leads there. Wrap such a row in `NoReadAid`.
 */
export const isCredentialPath = (to: string | undefined): boolean =>
  !!to && /^\/(vault|accounts)(\/|\?|#|$)/.test(to);
