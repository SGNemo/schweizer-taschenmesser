import type { ConnectorDef } from '@/core/connectors/types';
import { t } from '@/strings';
import { tSpotify } from '@/strings.spotify';
import { readCurrentlyPlaying, sendCommand } from './api';

const s = () => tSpotify.get();

/**
 * Spotify: what plays now (read) and pause / resume / next (control). The user brings their own app
 * ("Client ID" from the Developer Dashboard, PKCE, no secret). Spotify compares the redirect URI
 * exactly, so the login uses the fixed loopback port below – the user registers
 * `http://127.0.0.1:38417/callback`. Desktop only for now: the login needs a loopback redirect.
 */
export const SPOTIFY_REDIRECT_PORT = 38417;

const connector: ConnectorDef = {
  id: 'spotify',
  get name() {
    return s().name;
  },
  get description() {
    return s().description;
  },
  icon: 'play',
  authType: 'oauth-pkce',
  platforms: ['desktop'],
  get unavailableHint() {
    return t.connectors.desktopOnly;
  },
  oauth: {
    authUrl: 'https://accounts.spotify.com/authorize',
    tokenUrl: 'https://accounts.spotify.com/api/token',
    preferredPort: SPOTIFY_REDIRECT_PORT,
  },
  get client() {
    return { title: s().clientTitle, intro: s().clientIntro, secret: false, note: s().privacy };
  },
  features: [
    {
      id: 'show',
      get label() {
        return s().showFeature;
      },
      get description() {
        return s().showHint;
      },
      scopes: ['user-read-currently-playing', 'user-read-playback-state'],
    },
    {
      id: 'control',
      get label() {
        return s().controlFeature;
      },
      get description() {
        return s().controlHint;
      },
      scopes: ['user-modify-playback-state'],
    },
  ],
  nowPlaying: {
    read: readCurrentlyPlaying,
    control: sendCommand,
  },
};

export default connector;
