import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'dist-e2e', 'node_modules', 'playwright-report', 'test-results'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,js,mjs}'],
    languageOptions: { globals: { ...globals.browser, ...globals.node, chrome: 'readonly' } },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      // The extension must never keep secrets in a persistent store, and never use weak randomness.
      'no-restricted-globals': [
        'error',
        { name: 'localStorage', message: 'No persistent storage for anything in the extension.' },
        { name: 'sessionStorage', message: 'No web storage in the extension.' },
        { name: 'indexedDB', message: 'No IndexedDB in the extension.' },
        { name: 'caches', message: 'No Cache Storage in the extension.' },
      ],
      // The same stores reached through any object (window.localStorage, self.indexedDB, ...).
      'no-restricted-syntax': [
        'error',
        {
          selector:
            'MemberExpression[property.name=/^(localStorage|sessionStorage|indexedDB|caches)$/]',
          message: 'No persistent storage in the extension, through any object.',
        },
      ],
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'Use crypto.getRandomValues (vault-core).' },
        {
          object: 'chrome',
          property: 'storage',
          message: 'No chrome.storage: nothing is persisted.',
        },
      ],
    },
  },
  {
    // The E2E spec reads the stores on purpose to assert they are empty; it is not shipped.
    files: ['e2e/**/*.ts'],
    rules: { 'no-restricted-globals': 'off', 'no-restricted-syntax': 'off' },
  },
);
