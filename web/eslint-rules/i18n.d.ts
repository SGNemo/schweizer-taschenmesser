import type { ESLint } from 'eslint';

declare const plugin: ESLint.Plugin & { rules: NonNullable<ESLint.Plugin['rules']> };
export default plugin;
