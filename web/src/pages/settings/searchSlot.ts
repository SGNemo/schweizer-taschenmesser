import { createContext, type ReactNode } from 'react';

/**
 * Phone: the settings search is an icon at the end of the title line (0b-E). The settings layout puts the button here;
 * `SettingsTitle` and the status head (`PageHead` `tool`) draw it. Empty on the desktop (the search heads the
 * category column there) and outside the settings.
 */
export const SettingsSearchSlot = createContext<ReactNode>(null);
