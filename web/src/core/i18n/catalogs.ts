import { FALLBACK_LANG, SOURCE_LANG, getLang, setLangLoader, type Lang } from './lang';

/**
 * Catalogs of the main text object (`t` in `src/strings.ts`). German is the source and always
 * there; every other language is its own chunk, loaded on first use (and English with it, as the
 * fallback for anything a catalog misses). Loaded catalogs stay in memory.
 */
type Catalog = object;
type Loader = () => Promise<Catalog>;

const LOADERS: Record<Exclude<Lang, 'de'>, Loader> = {
  en: () => import('@/i18n/locales/en').then((m) => m.en),
  es: () => import('@/i18n/locales/es').then((m) => m.es),
  fr: () => import('@/i18n/locales/fr').then((m) => m.fr),
  'pt-BR': () => import('@/i18n/locales/pt-BR').then((m) => m.ptBR),
};

const loaded = new Map<Lang, Catalog>();

/**
 * E2E builds only: `localStorage.__tmPseudo = '1'` serves English as pseudo text (longer, accented,
 * bracketed; `src/i18n/pseudo.ts`) for the layout check in `e2e/i18n-layout.spec.ts`. Never part of
 * a release build (the mode check removes it).
 */
function pseudoEnglish(): Loader | undefined {
  if (import.meta.env.MODE !== 'e2e') return undefined;
  try {
    if (localStorage.getItem('__tmPseudo') !== '1') return undefined;
  } catch {
    return undefined;
  }
  return () =>
    Promise.all([import('@/i18n/pseudo'), import('@/strings')]).then(([p, s]) =>
      p.pseudoCatalog(s.de),
    );
}

async function load(lang: Lang): Promise<void> {
  if (lang === 'de' || loaded.has(lang)) return;
  const loader = (lang === 'en' && pseudoEnglish()) || LOADERS[lang];
  loaded.set(lang, await loader());
}

/** Loads a language and the English fallback. */
export async function loadCatalog(lang: Lang): Promise<void> {
  await Promise.all([load(lang), load(FALLBACK_LANG)]);
}

/** Registers a catalog that is already in memory (tests, prerendering). */
export function provideCatalog(lang: Lang, catalog: Catalog): void {
  loaded.set(lang, catalog);
}

export const isCatalogLoaded = (lang: Lang): boolean => lang === SOURCE_LANG || loaded.has(lang);

/** Lookup order for a text: current language, English, German (the source itself is last). */
export function catalogChain(): readonly unknown[] {
  const lang = getLang();
  if (lang === SOURCE_LANG) return [];
  const chain: unknown[] = [];
  const own = loaded.get(lang);
  if (own) chain.push(own);
  const en = loaded.get(FALLBACK_LANG);
  if (en && lang !== FALLBACK_LANG) chain.push(en);
  return chain;
}

setLangLoader(loadCatalog);
