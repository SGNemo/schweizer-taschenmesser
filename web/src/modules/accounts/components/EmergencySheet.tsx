import { getPlatform } from '@/core/platform';
import { today } from '@/core/time/dates';
import { useUiStore } from '@/stores/ui';
import { t } from '@/strings';
import { Button, Dialog } from '@/ui';

const esc = (s: string): string => s.replace(/[&<>"']/g, (c) => `&#${c.codePointAt(0)};`);

/** A printable page with the steps for an emergency. No secret goes in: only static text, the date and a number. */
export function emergencyHtml(entryCount: number, day: string): string {
  const e = t.accounts.emergency;
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(e.heading)}</title>
<style>body{font:16px/1.5 system-ui,sans-serif;max-width:40rem;margin:2rem auto;padding:0 1rem}li{margin:.5rem 0}</style></head>
<body><h1>${esc(e.heading)}</h1><p>${esc(e.date(day))} · ${esc(e.entries(entryCount))}</p>
<ol>${e.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol></body></html>`;
}

export function EmergencySheet({
  open,
  onClose,
  entryCount,
  onBackup,
}: {
  open: boolean;
  onClose: () => void;
  entryCount: number;
  onBackup: () => void;
}) {
  const e = t.accounts.emergency;
  const toast = useUiStore((s) => s.toast);
  return (
    <Dialog open={open} onClose={onClose} title={e.title}>
      <p>{e.intro}</p>
      <ol>
        {e.steps.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>
      <p>
        <Button
          variant="primary"
          onClick={() => {
            void getPlatform()
              .saveFile({
                fileName: e.file,
                data: new Blob([emergencyHtml(entryCount, today())], { type: 'text/html' }),
                mime: 'text/html',
              })
              .then(() => toast(e.saved));
          }}
        >
          {e.save}
        </Button>{' '}
        <Button
          onClick={() => {
            onClose();
            onBackup();
          }}
        >
          {e.backup}
        </Button>
      </p>
    </Dialog>
  );
}
