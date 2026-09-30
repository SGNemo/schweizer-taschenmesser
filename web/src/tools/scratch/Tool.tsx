import { useEffect, useRef, useState } from 'react';
import { z } from 'zod';
import { setSettings, useSettings } from '@/core/settings/settings';
import { t } from '@/strings';
import { Button, TextArea } from '@/ui';
import styles from '../tools.module.css';

const s = t.tools.scratch;
const schema = z.object({ text: z.string() });
const SCOPE = 'tools.scratch';

/** One note that syncs like the other settings. Saved shortly after typing stops. */
export default function ScratchTool() {
  const [stored] = useSettings(SCOPE, schema, { text: '' });
  if (!stored) return <p role="status">…</p>;
  // Mounted once the stored text is known, so the field starts with it (and later remote edits do
  // not overwrite what is being typed).
  return <Editor initial={stored.text} />;
}

function Editor({ initial }: { initial: string }) {
  const [text, setText] = useState(initial);
  const [saved, setSaved] = useState(true);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  function change(next: string) {
    setText(next);
    setSaved(false);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      void setSettings(SCOPE, { text: next }).then(() => setSaved(true));
    }, 600);
  }

  return (
    <div className={styles.stack}>
      <TextArea
        label={s.label}
        value={text}
        rows={10}
        placeholder={s.placeholder}
        onChange={(e) => change(e.target.value)}
        data-autofocus
      />
      <div className={styles.row}>
        <Button
          onClick={() => {
            clearTimeout(timer.current);
            setText('');
            void setSettings(SCOPE, { text: '' }).then(() => setSaved(true));
          }}
          disabled={!text}
        >
          {s.clear}
        </Button>
        <span className={styles.muted} role="status">
          {saved ? s.saved : '…'}
        </span>
      </div>
    </div>
  );
}
