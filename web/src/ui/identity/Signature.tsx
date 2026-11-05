import type { ComponentType, ReactNode } from 'react';
import type { SignatureId, SlotSize } from '@/core/modules/types';
import {
  AddressBar,
  ArrowBand,
  AvatarRing,
  Bill,
  Bubble,
  Envelope,
  FolderTabs,
  Gauges,
  Masthead,
  NotePaper,
  Pinboard,
  Receipt,
  Shelf,
  Stamp,
  WeekBars,
  type BlockSize,
} from './blocks';
import { HourStrip } from './HourStrip';
import { SignatureMark } from './SignatureMark';
import styles from './Signature.module.css';

/** The ids with a block of their own at M/L; every other id draws its mark on a plate. */
export const SIGNATURE_BLOCKS: Partial<
  Record<SignatureId, ComponentType<{ size?: BlockSize; children?: ReactNode }>>
> = {
  receipt: Receipt,
  bill: Bill,
  folderTab: FolderTabs,
  stamp: Stamp,
  pinboard: Pinboard,
  notePaper: NotePaper,
  bubble: Bubble,
  addressBar: AddressBar,
  shelf: Shelf,
  avatarRing: AvatarRing,
  gauges: Gauges,
  arrowProgress: ArrowBand,
  masthead: Masthead,
  weekBars: WeekBars,
  envelope: Envelope,
  // Decoration only: the strip's own role/label ("no appointments") would be a false statement here.
  hourStrip: ({ size }) => (
    <div aria-hidden="true" data-signature="hourStrip" data-size={size}>
      <HourStrip events={[]} />
    </div>
  ),
};

/** The mark on a tinted plate: the `S` size of every signature, and the M/L fallback of ids without a block. */
export function SignaturePlate({ id, size = 'S' }: { id: SignatureId; size?: SlotSize }) {
  if (id === 'none') return null;
  return (
    <span className={styles.plate} data-signature={id} data-size={size} aria-hidden="true">
      <SignatureMark id={id} size={size === 'S' ? 32 : 40} />
    </span>
  );
}

/**
 * A signature at a slot size (identity v3.1): `S` the mark on a 4 rem plate (compact heads, the settings head,
 * tool stages), `M`/`L` the block from the library (`SIGNATURE_BLOCKS`) or, for ids without one, the plate.
 * Decoration only; `children` is passed to a block that takes a line (a count, a title).
 */
export function Signature({
  id,
  size = 'M',
  children,
}: {
  id: SignatureId;
  size?: SlotSize;
  children?: ReactNode;
}) {
  if (id === 'none') return null;
  if (size === 'S') return <SignaturePlate id={id} size="S" />;
  const Block = SIGNATURE_BLOCKS[id];
  return Block ? <Block size={size}>{children}</Block> : <SignaturePlate id={id} size={size} />;
}
