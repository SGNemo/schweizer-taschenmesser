import assert from 'node:assert/strict';
import { test } from 'node:test';
import { provider } from '../src/legal.js';

const ALL = {
  IMPRESSUM_NAME: 'Erika Beispiel',
  IMPRESSUM_STREET: 'Musterweg 1',
  IMPRESSUM_POSTCODE_CITY: '12345 Beispielstadt',
};

test('reads the three details from the environment', () => {
  const p = provider({ ...ALL });
  assert.equal(p.name, 'Erika Beispiel');
  assert.equal(p.street, 'Musterweg 1');
  assert.equal(p.postcodeCity, '12345 Beispielstadt');
  assert.equal(p.complete, true);
  assert.equal(p.country.de, 'Deutschland');
  assert.equal(p.country.en, 'Germany');
});

test('local and preview builds keep working with a visible note', () => {
  const p = provider({});
  assert.equal(p.complete, false);
  assert.match(p.name, /nicht gesetzt/);
  assert.doesNotThrow(() => provider({ CF_PAGES: '1', CF_PAGES_BRANCH: 'feat/x' }));
});

test('a production build on Cloudflare Pages fails without the details', () => {
  const prod = { CF_PAGES: '1', CF_PAGES_BRANCH: 'main' };
  assert.throws(() => provider(prod), /IMPRESSUM_NAME, IMPRESSUM_STREET, IMPRESSUM_POSTCODE_CITY/);
  assert.throws(() => provider({ CF_PAGES: '1', CF_PAGES_BRANCH: 'develop' }), /IMPRESSUM_NAME/);
  assert.throws(() => provider({ ...prod, IMPRESSUM_NAME: 'X' }), /IMPRESSUM_STREET/);
  assert.doesNotThrow(() => provider({ ...prod, ...ALL }));
});

test('the production branch can be changed', () => {
  assert.doesNotThrow(() => provider({ CF_PAGES: '1', CF_PAGES_BRANCH: 'develop', PRODUCTION_BRANCH: 'live' }));
  assert.throws(() => provider({ CF_PAGES: '1', CF_PAGES_BRANCH: 'live', PRODUCTION_BRANCH: 'live' }));
});
