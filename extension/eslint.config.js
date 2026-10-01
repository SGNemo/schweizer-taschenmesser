import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'playwright-report', 'test-results'] },
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
      ],
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'Use crypto.getRandomValues (vault-core).' },
        { object: 'chrome', property: 'storage', message: 'No chrome.storage: nothing is persisted.' },
      ],
    },
  },
);
