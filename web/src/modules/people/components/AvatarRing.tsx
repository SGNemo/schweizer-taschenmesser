import { HeroSlot } from '@/ui/identity';
import { closeness, monogram } from '../logic';
import styles from './AvatarRing.module.css';

/**
 * Signature "avatar ring": the person's monogram inside a ring that fills as the birthday comes closer
 * (a month ahead is empty, the day itself is full). On the day itself a few small static confetti pieces sit
 * around the ring: very quiet, no motion. Decoration only; the name and the countdown are text beside it.
 */
export function AvatarRing({
  name,
  days,
  size = 2.75,
}: {
  name: string;
  /** Days until the birthday (0 = today); undefined without a birthday. */
  days?: number;
  /** Diameter in rem. */
  size?: number;
}) {
  const fill = days === undefined ? 0 : Math.round(closeness(days) * 100);
  return (
    <span
      className={styles.ring}
      style={{ width: `${size}rem`, ['--fill' as string]: `${fill}%` }}
      data-confetti={days === 0 ? 'true' : undefined}
      aria-hidden="true"
    >
      <span className={styles.face}>{monogram(name)}</span>
    </span>
  );
}

/** The next birthday in the head of the page: ring, name and the countdown as text. */
export function NextBirthdayHead({
  name,
  days,
  label,
}: {
  name: string;
  days: number;
  label: string;
}) {
  return (
    <HeroSlot>
      <div className={styles.head} data-testid="avatar-signature">
        <AvatarRing name={name} days={days} size={4} />
        <span className={styles.text}>
          <span className={styles.name}>{name}</span>
          <span className={styles.sub}>{label}</span>
        </span>
      </div>
    </HeroSlot>
  );
}
