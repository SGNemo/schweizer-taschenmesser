/**
 * Local ESLint rule `i18n/no-ui-literal`: UI text belongs in src/strings.ts (and every catalog in
 * src/i18n/locales), never in JSX. Flags JSX text with letters and string literals in the props
 * people read or hear (aria-label, title, placeholder, alt, label). Brand names and symbols can be
 * allowed per line with `// eslint-disable-next-line i18n/no-ui-literal -- reason`.
 * `npm run check:i18n` additionally scans every literal in the code for German-looking text.
 */
const TEXT_PROPS = new Set([
  'aria-label',
  'aria-description',
  'title',
  'placeholder',
  'alt',
  'label',
]);
const LETTERS = /\p{L}{2,}/u;
/** Domains and paths ("huggingface.co/") are not text to translate. */
const ADDRESS = /^[\w.-]+\.[a-z]{2,}\/?[\w./-]*$/i;
const isText = (s) => LETTERS.test(s) && !ADDRESS.test(s.trim());

const noUiLiteral = {
  meta: {
    type: 'problem',
    docs: { description: 'UI text must come from the catalog (t), not from JSX literals.' },
    messages: {
      text: 'UI text in JSX: put it in src/strings.ts (and the catalogs) and read it via t.',
      prop: 'UI text in the "{{name}}" prop: put it in src/strings.ts (and the catalogs) and read it via t.',
    },
    schema: [],
  },
  create(context) {
    return {
      JSXText(node) {
        if (isText(node.value)) context.report({ node, messageId: 'text' });
      },
      JSXAttribute(node) {
        const name = typeof node.name.name === 'string' ? node.name.name : '';
        if (!TEXT_PROPS.has(name) || !node.value) return;
        const v = node.value;
        const literal =
          (v.type === 'Literal' && typeof v.value === 'string' && v.value) ||
          (v.type === 'JSXExpressionContainer' &&
            v.expression.type === 'Literal' &&
            typeof v.expression.value === 'string' &&
            v.expression.value) ||
          (v.type === 'JSXExpressionContainer' &&
            v.expression.type === 'TemplateLiteral' &&
            v.expression.quasis.map((q) => q.value.cooked).join(''));
        if (literal && isText(literal)) context.report({ node, messageId: 'prop', data: { name } });
      },
    };
  },
};

export default { rules: { 'no-ui-literal': noUiLiteral } };
