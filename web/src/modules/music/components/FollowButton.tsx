import { useEffect, useState } from 'react';
import { useUiStore } from '@/stores/ui';
import { tMusicPage } from '@/strings.musicPage';
import { Button, Icon } from '@/ui';

/**
 * "Folgen / Gefolgt" for an artist or a playlist: reads the state once, applies a tap at once and takes it back with one
 * sentence when Spotify refuses. Locked while the answer is on its way. Nothing is stored in Nemo.
 */
export function FollowButton({
  id,
  name,
  read,
  write,
  onChanged,
}: {
  /** What is followed (artist or playlist id): read again only when it changes. */
  id: string;
  name: string;
  read: () => Promise<boolean>;
  write: (on: boolean) => Promise<void>;
  /** After a change was sent (lists that show the followed ones read afresh). */
  onChanged?: () => void;
}) {
  const tm = tMusicPage.use();
  const toast = useUiStore((s) => s.toast);
  const [on, setOn] = useState<boolean>();
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let alive = true;
    read().then(
      (v) => alive && setOn(v),
      () => undefined,
    );
    return () => {
      alive = false;
    };
    // `read` is rebuilt every render; the id says which thing it asks about.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  if (on === undefined) return null;
  const toggle = () => {
    const next = !on;
    setOn(next);
    setBusy(true);
    // Lists that show what you follow read afresh only once Spotify has the change (a read before would keep the old one).
    write(next)
      .then(() => onChanged?.())
      .catch(() => {
        setOn(!next);
        toast(next ? tm.followFailed : tm.unfollowFailed);
      })
      .finally(() => setBusy(false));
  };
  return (
    <Button
      variant="ghost"
      aria-pressed={on}
      aria-label={on ? tm.unfollowFor(name) : tm.followFor(name)}
      disabled={busy}
      onClick={toggle}
      data-testid="music-follow"
    >
      <Icon name={on ? 'check' : 'plus'} size={18} />
      {on ? tm.following : tm.follow}
    </Button>
  );
}
