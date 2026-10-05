import { t } from '@/strings';
import { Button } from './Button';
import { Dialog } from './Dialog';
import { Prose } from './Prose';
import { ReadableText } from './ReadableText';

/**
 * Fokus-Lesen: a calm reading view for longer text (a note, an answer): wide column without chrome, limited line
 * length, paragraphs with spacing, reading aid on. Opened by the user, closed with Esc or the button; nothing is stored.
 */
export function ReaderView({
  open,
  onClose,
  title,
  text,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  text: string;
}) {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      size="wide"
      footer={<Button onClick={onClose}>{t.settings.reading.focusReadExit}</Button>}
    >
      <Prose>
        {paragraphs.map((p, i) => (
          <p key={i} style={{ whiteSpace: 'pre-line' }}>
            <ReadableText text={p} force />
          </p>
        ))}
      </Prose>
    </Dialog>
  );
}
