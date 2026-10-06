import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

// Module isolation: feature modules must not import each other.
// Exception (see CLAUDE.md): finance may read subscriptions/invoices via their public.ts.

export default tseslint.config(
  {
    ignores: [
      'dist',
      'dist-e2e-seed',
      'dev-dist',
      'playwright-report',
      'test-results',
      'templates',
      'src-tauri/target',
      'src-tauri/crates/*/target',
      'src-tauri/gen',
    ],
  },
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
    // Platform isolation: only `core/platform` may know that a native shell exists, and only
    // `core/platform/tauri` may import Tauri packages. Everything else uses `getPlatform()`.
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/core/platform/**'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'ImportDeclaration[source.value=/^@tauri-apps\\//]',
          message:
            'Use getPlatform() from @/core/platform; Tauri packages belong in core/platform/tauri.',
        },
        {
          selector: 'ImportExpression[source.value=/^@tauri-apps\\//]',
          message:
            'Use getPlatform() from @/core/platform; Tauri packages belong in core/platform/tauri.',
        },
        {
          selector: 'Identifier[name=/^__TAURI/], Literal[value=/^__TAURI/]',
          message: 'Do not detect the native shell yourself; ask getPlatform().',
        },
      ],
    },
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
              group: ['@/connectors', '@/connectors/*', '@/tools', '@/tools/*'],
              message:
                'Modules must not import connectors or tools. They receive data through manifest contributions.',
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
    // Quick capture writes into modules only through manifests + createRepo (targets/*), never by
    // importing module code. The parser is a pure package: relative imports only.
    files: ['src/quickCapture/**/*.{ts,tsx}'],
    ignores: ['**/*.test.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/modules/*', '@/modules'],
              message:
                'Quick capture must not import modules. Write through the manifest and createRepo in targets/.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/quickCapture/parser/**/*.ts'],
    ignores: ['**/*.test.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { regex: '^[^.]', message: 'The parser is pure TypeScript: relative imports only.' },
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
              group: ['@/connectors', '@/connectors/*', '@/tools', '@/tools/*'],
              message:
                'Modules must not import connectors or tools. They receive data through manifest contributions.',
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
    // Sanctioned cross-read: budgets may import public.ts of finance (expenses per category).
    files: ['src/modules/budgets/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '^@/modules/(?!finance/public$)',
              message: 'budgets may only import finance/public.',
            },
            {
              group: ['@/connectors', '@/connectors/*', '@/tools', '@/tools/*'],
              message:
                'Modules must not import connectors or tools. They receive data through manifest contributions.',
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
            {
              group: ['@/connectors', '@/connectors/*', '@/tools', '@/tools/*'],
              message:
                'Modules must not import connectors or tools. They receive data through manifest contributions.',
            },
          ],
        },
      ],
    },
  },
  {
    // Connectors talk to one outside service and return plain data. They never touch the database,
    // never import a module, and never reach the AI code: what they read from a mailbox stays local.
    files: ['src/connectors/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/modules', '@/modules/*'],
              message: 'Connectors must not import modules; data goes out through the framework.',
            },
            {
              group: ['@/core/db', '@/core/db/*'],
              message:
                'Connectors never touch the database; the modules store what they are given.',
            },
            {
              group: ['@/core/ai', '@/core/ai/*'],
              message: 'Connector code handles mail content and must never reach the AI code.',
            },
            {
              group: ['@/core/sync', '@/core/sync/*', '@/core/backup', '@/core/backup/*'],
              message: 'Use the ConnectorContext instead of the sync or backup internals.',
            },
          ],
        },
      ],
    },
  },
  {
    // Tools are self-contained helpers: no modules, no database. (They may use settings and UI.)
    files: ['src/tools/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/modules', '@/modules/*'],
              message: 'Tools must not import modules.',
            },
            {
              group: ['@/core/db', '@/core/db/*'],
              message: 'Tools never touch the database; use core/settings for what must persist.',
            },
            {
              group: ['@/connectors', '@/connectors/*', '@/core/connectors', '@/core/connectors/*'],
              message: 'Tools do not use connectors.',
            },
          ],
        },
      ],
    },
  },
);
