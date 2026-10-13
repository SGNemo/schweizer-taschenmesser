import { Icon } from './icons';
import { IconLink } from './Button';

/**
 * The gear that leads from where a setting matters (widget, module header, dialog) straight to
 * that setting: the section opens and is highlighted. `to` comes from `settingsPath(...)`.
 */
export function SettingsLink({ to, label }: { to: string; label: string }) {
  return (
    <IconLink to={to} label={label} data-testid="settings-link">
      <Icon name="settings" size={18} />
    </IconLink>
  );
}
