import { useEffect } from 'react';
import { confirmNotice, registerNoticeHost, useNoticeStore } from '@/core/legal/notices';
import { tLegal } from '@/strings.legal';
import { Button, Dialog } from '@/ui';

/** Shows the first pending one-time notice; only the button closes it (see `core/legal/notices.ts`). */
export function NoticeHost() {
  const l = tLegal.use();
  const id = useNoticeStore((s) => s.queue[0]);
  useEffect(() => registerNoticeHost(), []);
  const n = id ? l.notices[id] : undefined;
  return (
    <Dialog
      open={Boolean(id && n)}
      onClose={() => undefined}
      title={n?.title ?? ''}
      footer={
        <Button variant="primary" data-autofocus onClick={() => id && void confirmNotice(id)}>
          {l.notices.ok}
        </Button>
      }
    >
      <div data-testid="notice-dialog" style={{ display: 'grid', gap: 'var(--space-2)' }}>
        {n?.body.map((p) => (
          <p key={p}>{p}</p>
        ))}
        <p>{l.notices.more}</p>
      </div>
    </Dialog>
  );
}
