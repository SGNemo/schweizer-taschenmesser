import type { ConnectorDef } from '@/core/connectors/types';
import { redirectUri } from '@/core/connectors/redirect';
import { getPlatform } from '@/core/platform';
import { tSpotify } from '@/strings.spotify';
import {
  likedSongs,
  listPlaylists,
  play,
  readCurrentlyPlaying,
  readPlayerState,
  search,
  seek,
  sendCommand,
  setRepeat,
  setShuffle,
  setVolume,
  startPlaylist,
} from './api';

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
  platforms: ['desktop', 'web'],
  get unavailableHint() {
    return s().browserHint;
  },
  oauth: {
    authUrl: 'https://accounts.spotify.com/authorize',
    tokenUrl: 'https://accounts.spotify.com/api/token',
    preferredPort: SPOTIFY_REDIRECT_PORT,
    browserLogin: true,
  },
  get client() {
    // In the browser the redirect address is the app's own; on the PC it is the fixed loopback port.
    const web = getPlatform().kind === 'web';
    return {
      title: s().clientTitle,
      intro: web ? s().clientIntroWeb(redirectUri()) : s().clientIntro,
      secret: false,
      note: s().privacy,
    };
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
    {
      id: 'playlists',
      get label() {
        return s().playlistsFeature;
      },
      get description() {
        return s().playlistsHint;
      },
      scopes: ['playlist-read-private'],
      defaultOn: false,
    },
    {
      id: 'library',
      get label() {
        return s().libraryFeature;
      },
      get description() {
        return s().libraryHint;
      },
      scopes: ['user-library-read'],
      defaultOn: false,
    },
  ],
  nowPlaying: {
    read: readCurrentlyPlaying,
    control: sendCommand,
    playlists: listPlaylists,
    startPlaylist,
    state: readPlayerState,
    seek,
    setVolume,
    setShuffle,
    setRepeat,
    search,
    likedSongs,
    play,
  },
};

export default connector;
