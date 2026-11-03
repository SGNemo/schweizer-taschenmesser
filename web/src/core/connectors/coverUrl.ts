/**
 * Covers come from the media service's own image host only (Spotify: `i.scdn.co`); anything else is never fetched. Shared by the
 * connector (which only hands out matching URLs) and the cover loader of the music module (which checks again before fetching).
 */
export const COVER_URL = /^https:\/\/i\.scdn\.co\/image\/[A-Za-z0-9]+$/;
