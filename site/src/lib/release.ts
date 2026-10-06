import data from '../release/latest.json';
import { ASSETS, downloadUrl } from '../config.js';

export type Platform = 'windows' | 'android';
export interface AssetInfo {
  name: string;
  size: number;
  sha256: string | null;
}
export interface ReleaseInfo {
  version: string;
  tag: string;
  publishedAt: string;
  fetchedAt: string;
  assets: Record<Platform, AssetInfo>;
}

export const release = data as ReleaseInfo;

/** 10331648 → "10,3 MB" (de) / "10.3 MB" (en). */
export function formatSize(bytes: number, locale: 'de' | 'en'): string {
  const mb = bytes / 1_000_000;
  return `${mb.toLocaleString(locale === 'de' ? 'de-DE' : 'en-GB', { maximumFractionDigits: 1, minimumFractionDigits: 1 })} MB`;
}

export function formatDate(iso: string, locale: 'de' | 'en'): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!)).toLocaleDateString(locale === 'de' ? 'de-DE' : 'en-GB', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

export function assetUrl(platform: Platform): string {
  return downloadUrl(ASSETS[platform]);
}
