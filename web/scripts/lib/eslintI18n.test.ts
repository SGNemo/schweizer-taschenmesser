import { RuleTester } from 'eslint';
import { afterAll, describe, it } from 'vitest';
import tseslint from 'typescript-eslint';
import plugin from '../../eslint-rules/i18n.js';

RuleTester.afterAll = afterAll;
RuleTester.describe = describe;
RuleTester.it = it;

const tester = new RuleTester({
  languageOptions: {
    parser: tseslint.parser,
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
});

tester.run('i18n/no-ui-literal', plugin.rules['no-ui-literal'], {
  valid: [
    'const a = <p>{t.todos.empty}</p>;',
    'const a = <button aria-label={t.actions.close}>×</button>;',
    'const a = <span className="row" data-id="x1">{n} · {m}</span>;',
    'const a = <dd>huggingface.co/{repo}</dd>;',
  ],
  invalid: [
    { code: 'const a = <p>Noch keine Einträge</p>;', errors: [{ messageId: 'text' }] },
    { code: 'const a = <input placeholder="Suchen" />;', errors: [{ messageId: 'prop' }] },
    { code: 'const a = <img alt={`Logo von Nemo`} />;', errors: [{ messageId: 'prop' }] },
  ],
});
