import styles from './GroupTabs.module.css';

/**
 * Groups of the vault as folder tabs (all, favourites, one per tag): the chosen tab is filled and joins the list below.
 * Each tab is a button with `aria-pressed`. The same shape as the folder tabs of the documents, drawn here on its own
 * because modules do not import each other.
 */
export function GroupTabs({
  label,
  items,
  value,
  onChange,
}: {
  label: string;
  items: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className={styles.tabs} role="group" aria-label={label}>
      {items.map((it) => (
        <button
          key={it.id}
          type="button"
          className={styles.tab}
          aria-pressed={value === it.id}
          onClick={() => onChange(it.id)}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}
