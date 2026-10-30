import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { finishBrowserLogin } from '@/core/connectors/oauthRedirect';
import { settingsPath } from '@/core/settings/registry/paths';
import { tSpotify } from '@/strings.spotify';
import styles from './Page.module.css';

/**
 * Where a provider sends the user back after a browser login (`/oauth/callback?code=…&state=…`). Finishes
 * the login and moves on to the connection card, which shows the result (connected or a calm message).
 */
export function OAuthCallback() {
  const { search } = useLocation();
  const navigate = useNavigate();
  const tx = tSpotify.use();

  useEffect(() => {
    let alive = true;
    // The code and state are used once; the address is replaced so they do not stay in the history.
    void finishBrowserLogin(search).then(() => {
      if (alive) void navigate(settingsPath('verbindungen', 'connectors'), { replace: true });
    });
    return () => {
      alive = false;
    };
  }, [search, navigate]);

  return (
    <p className={styles.lead} role="status">
      {tx.callbackWorking}
    </p>
  );
}
