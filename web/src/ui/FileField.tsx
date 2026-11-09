import { useId, useState, type ChangeEvent } from 'react';
import { t } from '@/strings';
import { Button } from './Button';
import { Icon } from './icons';
import buttonStyles from './Button.module.css';
import fieldStyles from './Fields.module.css';
import styles from './FileField.module.css';

/**
 * File picker in the app's own look (U07): label above, a secondary "Datei wählen" button, the chosen name (or
 * "Keine Datei gewählt") beside it, an optional "Entfernen", then hint and error. The real `<input type="file">`
 * lies transparent over the button, the same size: a click, the keyboard focus and a dropped file all land on it,
 * the focus ring shows on the button. Its accessible name is the field label plus the button text. A picker that is
 * cancelled does not call `onFiles`.
 */
export function FileField({
  label,
  labelHidden,
  hint,
  error,
  accept,
  multiple,
  directory,
  buttonLabel,
  fileName,
  onFiles,
  onRemove,
  removeLabel,
  id: idProp,
  disabled,
}: {
  label: string;
  /** Keep the label for screen readers only (a section heading already says it). */
  labelHidden?: boolean;
  hint?: string;
  error?: string;
  accept?: string;
  multiple?: boolean;
  /** Pick a whole folder (non-standard `webkitdirectory`, supported by every browser and the desktop webview). */
  directory?: boolean;
  /** Text of the button; "Datei wählen" / "Dateien wählen" by default. */
  buttonLabel?: string;
  /**
   * What to show as chosen. Left out, the field shows the name(s) picked last; `null` shows "Keine Datei gewählt"
   * (the owner keeps the file elsewhere, or the pick was refused).
   */
  fileName?: string | null;
  /** The picked files. The input is cleared afterwards, so picking the same file again fires again. */
  onFiles: (files: FileList) => void;
  /** Shows "Entfernen" while something is chosen. */
  onRemove?: () => void;
  removeLabel?: string;
  /** A stable id for the input (deep links, e2e); generated otherwise. */
  id?: string;
  disabled?: boolean;
}) {
  const auto = useId();
  const id = idProp ?? auto;
  const [picked, setPicked] = useState<string | null>(null);
  const shown = fileName === undefined ? picked : fileName;
  const describedBy = [`${id}-name`, hint ? `${id}-hint` : '', error ? `${id}-err` : '']
    .filter(Boolean)
    .join(' ');

  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setPicked(files.length === 1 ? (files[0]?.name ?? '') : t.ui.file.count(files.length));
    onFiles(files);
    e.target.value = '';
  };

  return (
    <div className={fieldStyles.field}>
      <span id={`${id}-label`} className={labelHidden ? 'sr-only' : fieldStyles.label}>
        {label}
      </span>
      <div className={styles.row}>
        <span className={styles.pickWrap} data-disabled={disabled ? 'true' : undefined}>
          <span
            id={`${id}-btn`}
            className={[buttonStyles.btn, buttonStyles.secondary, styles.pick].join(' ')}
            aria-hidden="true"
          >
            <Icon name="upload" size={16} />
            {buttonLabel ?? (multiple ? t.ui.file.chooseMany : t.ui.file.choose)}
          </span>
          <input
            id={id}
            type="file"
            className={styles.input}
            accept={accept}
            multiple={multiple}
            disabled={disabled}
            aria-labelledby={`${id}-label ${id}-btn`}
            aria-describedby={describedBy}
            aria-invalid={error ? true : undefined}
            onChange={onChange}
            {...((directory ? { webkitdirectory: '', directory: '' } : {}) as object)}
          />
        </span>
        <span id={`${id}-name`} className={shown ? styles.name : styles.none} aria-live="polite">
          {shown || (directory ? t.ui.file.noneFolder : t.ui.file.none)}
        </span>
        {onRemove && shown ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setPicked(null);
              onRemove();
            }}
          >
            {removeLabel ?? t.ui.file.remove}
          </Button>
        ) : null}
      </div>
      {hint ? (
        <span id={`${id}-hint`} className={fieldStyles.hint}>
          {hint}
        </span>
      ) : null}
      {error ? (
        <span id={`${id}-err`} className={fieldStyles.error} role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}
