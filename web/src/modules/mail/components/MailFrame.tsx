import { useEffect, useMemo, useRef, useState } from 'react';
import {
  fetchRemoteImages,
  mailDocument,
  sanitizeMailHtml,
  textToHtml,
} from '@/core/mail/sanitize';
import { getPlatform } from '@/core/platform';
import { t } from '@/strings';
import { Button } from '@/ui';
import styles from './mail.module.css';

const SAFE_OPEN = /^(https?:|mailto:|tel:)/i;

/**
 * Shows one mail body. The HTML is sanitised (`sanitizeMailHtml`), then rendered in an iframe with
 * `sandbox="allow-same-origin"` only: scripts cannot run in it (no `allow-scripts`), the document carries
 * its own CSP (`default-src 'none'`), and the app reads the frame solely to size it and to open links in the
 * system browser instead of inside the frame. External images stay blocked until the user loads them.
 */
export function MailFrame({
  subject,
  html,
  text,
  cid,
  autoLoadImages,
}: {
  subject: string;
  html?: string;
  text?: string;
  /** Content-ID → data URL of inline images. */
  cid: Record<string, string>;
  autoLoadImages: boolean;
}) {
  const [images, setImages] = useState<Record<string, string>>({});
  const [loadingImages, setLoadingImages] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(120);

  const source = html ?? (text ? textToHtml(text) : '');
  const result = useMemo(() => sanitizeMailHtml(source, { images, cid }), [source, images, cid]);
  const doc = useMemo(
    () => mailDocument(result.html || `<p>${t.mail.view.noBody}</p>`),
    [result.html],
  );

  async function loadImages() {
    setLoadingImages(true);
    try {
      setImages(await fetchRemoteImages(result.remoteImages, getPlatform().fetch));
    } finally {
      setLoadingImages(false);
    }
  }

  const pending = result.remoteImages.length > 0 && Object.keys(images).length === 0;
  const imageKey = result.remoteImages.join('\n');
  useEffect(() => {
    if (!autoLoadImages || !pending) return;
    let alive = true;
    void fetchRemoteImages(imageKey.split('\n'), getPlatform().fetch).then(
      (loaded) => alive && setImages(loaded),
    );
    return () => {
      alive = false;
    };
  }, [autoLoadImages, pending, imageKey]);

  function onLoad() {
    const document_ = frame.current?.contentDocument;
    if (!document_) return;
    setHeight(Math.min(document_.documentElement.scrollHeight + 4, 6000));
    document_.addEventListener('click', (e) => {
      const anchor = (e.target as Element | null)?.closest?.('a');
      if (!anchor) return;
      e.preventDefault();
      const href = anchor.getAttribute('href') ?? '';
      if (SAFE_OPEN.test(href)) void getPlatform().app.openUrl(href);
    });
  }

  return (
    <div className={styles.frameBox}>
      {result.blocked > 0 || result.trackers > 0 ? (
        <div className={styles.imageBar} role="status">
          {result.blocked > 0 ? <span>{t.mail.view.blockedImages(result.blocked)}</span> : null}
          {result.trackers > 0 ? <span>{t.mail.view.trackers(result.trackers)}</span> : null}
          {result.blocked > 0 ? (
            <Button disabled={loadingImages} onClick={() => void loadImages()}>
              {loadingImages ? t.mail.view.loadingImages : t.mail.view.loadImages}
            </Button>
          ) : null}
        </div>
      ) : null}
      <iframe
        ref={frame}
        title={t.mail.view.frameTitle(subject)}
        className={styles.frame}
        style={{ height }}
        sandbox="allow-same-origin"
        referrerPolicy="no-referrer"
        srcDoc={doc}
        onLoad={onLoad}
      />
    </div>
  );
}
