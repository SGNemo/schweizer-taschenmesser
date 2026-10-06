import { PALETTES, usePaletteStore, type PaletteId } from '@/core/supporter/palette';
import { useSupporter } from '@/core/supporter';
import { t } from '@/strings';
import { Icon, SettingRow, Switch } from '@/ui';
import styles from './PaletteRows.module.css';

/**
 * Supporter colour themes and the themed logo (Einstellungen → Darstellung). Cosmetic and
 * device-local. Without a supporter code a click shows a theme for 30 seconds instead of choosing
 * it – no pop-up, no countdown, nothing is blocked.
 */
export function PaletteRows() {
  const { tier } = useSupporter();
  const isSupporter = tier !== 'none';
  const chosen = usePaletteStore((s) => s.chosen);
  const preview = usePaletteStore((s) => s.preview);
  const logoThemed = usePaletteStore((s) => s.logoThemed);
  const { choose, startPreview, stopPreview, setLogoThemed } = usePaletteStore.getState();
  const s = t.supporter;
  const shown = preview ?? (isSupporter ? chosen : null);

  function pick(id: PaletteId | null) {
    stopPreview();
    if (id === null || isSupporter) choose(id);
    else startPreview(id);
  }

  return (
    <>
      <SettingRow
        id="appearance--palette"
        stacked
        label={s.palette.label}
        description={isSupporter ? s.palette.hintSupporter : s.palette.hintLocked}
      >
        <div className={styles.stack}>
          <div role="radiogroup" aria-label={s.palette.label} className={styles.tiles}>
            <button
              type="button"
              role="radio"
              aria-checked={shown === null}
              className={styles.tile}
              onClick={() => pick(null)}
            >
              <span className={styles.name}>{s.palette.standard}</span>
            </button>
            {PALETTES.map((id) => {
              const name = s.palette.names[id];
              return (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={shown === id}
                  aria-label={isSupporter ? s.palette.choose(name) : s.palette.tryOut(name)}
                  className={styles.tile}
                  data-testid={`palette-${id}`}
                  onClick={() => pick(id)}
                >
                  <span className={styles.swatch} data-palette-preview={id} aria-hidden="true">
                    <span className={styles.chip} />
                    <span className={styles.chip2} />
                  </span>
                  <span className={styles.name}>
                    {name}
                    {isSupporter ? null : (
                      <span title={s.palette.locked}>
                        <Icon name="lock" size={14} />
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
          {preview ? (
            <p className={styles.preview} role="status" data-testid="palette-preview">
              {s.palette.previewing(s.palette.names[preview])}{' '}
              <button type="button" className={styles.link} onClick={stopPreview}>
                {s.palette.previewEnd}
              </button>
            </p>
          ) : null}
        </div>
      </SettingRow>
      <SettingRow
        id="appearance--logo"
        label={s.logo.label}
        description={isSupporter ? s.logo.hint : s.logo.hintLocked}
      >
        <Switch
          label={s.logo.label}
          labelHidden
          checked={isSupporter && logoThemed}
          disabled={!isSupporter}
          onChange={setLogoThemed}
        />
      </SettingRow>
    </>
  );
}
