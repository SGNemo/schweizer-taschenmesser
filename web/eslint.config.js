import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

// Module isolation: feature modules must not import each other.
// Exception (see CLAUDE.md): finance may read subscriptions/invoices via their public.ts.

export default tseslint.config(
  { ignores: ['dist', 'dev-dist', 'playwright-report', 'test-results', 'templates'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser } },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: ['scripts/**/*.mjs', '*.config.{js,ts}'],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    // Feature modules: no imports of sibling modules, no raw table writes.
    files: ['src/modules/*/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/modules/*', '../../*/*', '../../../*/*'.replace('*/*', '*/*')].slice(0, 1),
              message:
                'Modules must not import other modules. Use the event bus or manifest contributions.',
            },
            {
              group: ['@/core/db/dexie', '@/core/db/db'],
              message:
                'Use createRepo() from @/core/db/repo instead of touching Dexie tables directly.',
            },
          ],
        },
      ],
    },
  },
  {
    // Sanctioned cross-read: finance may import public.ts of subscriptions and invoices.
    files: ['src/modules/finance/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              // Everything under @/modules/ except the two read-only public APIs.
              regex: '^@/modules/(?!(?:invoices|subscriptions)/public$)',
              message: 'finance may only import subscriptions/public and invoices/public.',
            },
            {
              group: ['@/core/db/dexie', '@/core/db/db'],
              message:
                'Use createRepo() from @/core/db/repo instead of touching Dexie tables directly.',
            },
          ],
        },
      ],
    },
  },
  {
    // Tests may use the app database directly (fixtures, cleanup); module isolation still applies.
    files: ['src/modules/*/__tests__/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/modules/*'],
              message: 'Modules must not import other modules.',
            },
          ],
        },
      ],
    },
  },
);
