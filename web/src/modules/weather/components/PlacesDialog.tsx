import { useState } from 'react';
import {
  moveExtraPlace,
  promoteExtraPlace,
  removeExtraPlace,
  renamePlace,
  useWeatherSettings,
} from '@/core/weather/settings';
import { tWeatherPage } from '@/strings.weatherPage';
import { Button, Dialog, Icon, IconButton, TextField } from '@/ui';
import styles from '../routes/weather.module.css';

const short = (name: string) => name.split(',')[0] ?? name;

/** One place with its name field: the name is saved when the field is left (or Enter is pressed). */
function NameField({ slot, name }: { slot: number; name: string }) {
  const tp = tWeatherPage.use();
  const [value, setValue] = useState(name);
  const [seen, setSeen] = useState(name);
  // the stored name changed (another row was promoted): the field follows
  if (seen !== name) {
    setSeen(name);
    setValue(name);
  }
  const commit = () => {
    if (value.trim() && value.trim() !== name) void renamePlace(slot, value);
    else setValue(name);
  };
  return (
    <TextField
      label={`${tp.renameLabel}: ${short(name)}`}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          commit();
        }
      }}
      maxLength={120}
    />
  );
}

/**
 * Places of the weather page as a short task (a dialog): rename, order, make one the main place (the
 * overview widget follows it), remove. The main place stays first; nothing here asks the network.
 */
export function PlacesDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const tp = tWeatherPage.use();
  const [settings] = useWeatherSettings();
  const extra = settings?.extra ?? [];
  return (
    <Dialog open={open} onClose={onClose} title={tp.managePlacesTitle} size="default">
      <ul className={styles.manage} aria-label={tp.placesLabel}>
        {settings?.place ? (
          <li className={styles.manageRow} data-testid="manage-main">
            <NameField slot={0} name={settings.place} />
            <span className={styles.manageTag}>{tp.mainTag}</span>
          </li>
        ) : null}
        {extra.map((p, i) => (
          <li key={`${p.lat},${p.lon}`} className={styles.manageRow} data-testid="manage-extra">
            <NameField slot={i + 1} name={p.label} />
            <span className={styles.manageActions}>
              <IconButton
                label={tp.moveUp(short(p.label))}
                disabled={i === 0}
                onClick={() => void moveExtraPlace(i, -1)}
              >
                <Icon name="chevronUp" size={18} />
              </IconButton>
              <IconButton
                label={tp.moveDown(short(p.label))}
                disabled={i === extra.length - 1}
                onClick={() => void moveExtraPlace(i, 1)}
              >
                <Icon name="chevronDown" size={18} />
              </IconButton>
              <Button variant="ghost" onClick={() => void promoteExtraPlace(i)}>
                {tp.makeMain(short(p.label))}
              </Button>
              <IconButton
                label={tp.removePlace(short(p.label))}
                onClick={() => void removeExtraPlace(i)}
              >
                <Icon name="close" size={18} />
              </IconButton>
            </span>
          </li>
        ))}
      </ul>
    </Dialog>
  );
}
