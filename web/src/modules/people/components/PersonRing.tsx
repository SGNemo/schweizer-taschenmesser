import { HeroFigure, HeroSlot } from '@/ui/identity';
import { closeness, monogram } from '../logic';
import styles from './PersonRing.module.css';

/**
 * A person's monogram in the list rows (content, not the module signature – that is the library's `avatarRing`, drawn
 * by the frame): the monogram inside a ring that fills as the birthday comes closer
 * (a month ahead is empty, the day itself is full). On the day itself a few small static confetti pieces sit
 * around the ring: very quiet, no motion. Decoration only; the name and the countdown are text beside it.
 */
export function PersonRing({
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

/**
 * The `fokus` head of the people page: the next birthday is the one thing – the name large, when and the age as its
 * context line. The frame draws the `avatarRing` mark beside it (slot S).
 */
export function NextBirthdayHead({ name, label }: { name: string; label: string }) {
  return (
    <HeroSlot area="figure">
      <div data-testid="avatar-signature">
        <HeroFigure value={name} detail={label} />
      </div>
    </HeroSlot>
  );
}
