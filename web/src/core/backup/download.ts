import { getPlatform } from '@/core/platform';

/** Offers text as a file: browser download, or the native "save as" dialog. */
export async function downloadTextFile(
  fileName: string,
  text: string,
  type = 'application/json',
): Promise<'saved' | 'cancelled'> {
  return getPlatform().saveFile({ fileName, data: text, mime: type });
}
