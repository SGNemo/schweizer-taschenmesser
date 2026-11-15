import { describe, expect, it } from 'vitest';
import { unsubscribeUrl } from './unsubscribe';

describe('unsubscribe link', () => {
  it('takes the https address, never mailto', () => {
    expect(unsubscribeUrl('<mailto:leave@example.org>, <https://news.example.org/u?id=1>')).toBe(
      'https://news.example.org/u?id=1',
    );
    expect(unsubscribeUrl('<mailto:leave@example.org>')).toBeUndefined();
  });

  it('drops http, javascript, credentials and junk', () => {
    expect(unsubscribeUrl('<http://news.example.org/u>')).toBeUndefined();
    expect(unsubscribeUrl('<javascript:alert(1)>')).toBeUndefined();
    expect(unsubscribeUrl('<https://user:pw@example.org/u>')).toBeUndefined();
    expect(unsubscribeUrl('https://news.example.org/u')).toBeUndefined(); // not in <…>
    expect(unsubscribeUrl('<not a url>')).toBeUndefined();
    expect(unsubscribeUrl(undefined)).toBeUndefined();
  });
});
