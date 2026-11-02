import { Node, nodeInputRule } from '@tiptap/core';

export interface WikiLinkOptions {
  /** Called with the target when a link is clicked (or Enter on it). */
  onNavigate: (target: string) => void;
}

/**
 * `[[Page title]]` as an inline atom: stored as exactly that text in the Markdown (the stock
 * serializer would escape the brackets), shown as a link that opens or creates the page.
 */
export const WikiLink = Node.create<WikiLinkOptions>({
  name: 'wikiLink',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addOptions() {
    return { onNavigate: () => undefined };
  },

  addAttributes() {
    return {
      target: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-wikilink') ?? '',
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-wikilink]' }];
  },

  renderHTML({ node }) {
    return [
      'span',
      { 'data-wikilink': node.attrs.target, class: 'wikilink' },
      `${node.attrs.target}`,
    ];
  },

  renderText({ node }) {
    return `[[${node.attrs.target}]]`;
  },

  addNodeView() {
    return ({ node }) => {
      const target = String(node.attrs.target ?? '');
      const dom = document.createElement('span');
      dom.className = 'wikilink';
      dom.setAttribute('data-wikilink', target);
      dom.setAttribute('role', 'link');
      dom.tabIndex = 0;
      dom.textContent = target;
      dom.addEventListener('click', (e) => {
        e.preventDefault();
        this.options.onNavigate(target);
      });
      dom.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        this.options.onNavigate(target);
      });
      return { dom };
    };
  },

  // Typing `[[Title]]` by hand turns into a link as soon as the closing brackets are there.
  addInputRules() {
    return [
      nodeInputRule({
        find: /\[\[([^\]\n|]+)\]\]$/,
        type: this.type,
        getAttributes: (match) => ({ target: String(match[1]).trim() }),
      }),
    ];
  },

  renderMarkdown(node) {
    return `[[${String((node.attrs as { target?: string } | undefined)?.target ?? '')}]]`;
  },

  parseMarkdown(token, helpers) {
    return helpers.createNode('wikiLink', { target: (token as { target?: string }).target ?? '' });
  },

  markdownTokenizer: {
    name: 'wikiLink',
    level: 'inline',
    start: (src: string) => src.indexOf('[['),
    tokenize(src: string) {
      const m = /^\[\[([^\]\n|]+?)\]\]/.exec(src);
      if (!m) return undefined;
      return { type: 'wikiLink', raw: m[0], target: m[1]!.trim() };
    },
  },
});

/** Lets the editor (created once) call the newest click handler of its owner. */
export function createNavRelay() {
  let handler: (target: string) => void = () => undefined;
  return {
    navigate: (target: string) => handler(target),
    set(next: (target: string) => void) {
      handler = next;
    },
  };
}
