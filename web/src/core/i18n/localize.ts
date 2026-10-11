/**
 * Turns the German source object into a view that answers in the current language. Every read goes
 * through `chain()` (current catalog, English, German) at access time, so a language switch needs no
 * reload: nested objects come back as views of their own, leaves (strings, functions, arrays) as the
 * value of the first catalog that has them. Keys and their order always come from the source, so
 * `Object.keys/entries` work on any part of it.
 */
type Chain = () => readonly unknown[];

const isPlainObject = (v: unknown): v is Record<PropertyKey, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

function at(root: unknown, path: readonly PropertyKey[]): unknown {
  let cur = root;
  for (const k of path) {
    if (!isPlainObject(cur)) return undefined;
    cur = cur[k];
  }
  return cur;
}

export function localize<T extends object>(source: T, chain: Chain): T {
  const views = new Map<string, object>();

  const resolve = (path: readonly PropertyKey[]): unknown => {
    for (const root of chain()) {
      const v = at(root, path);
      if (v !== undefined) return v;
    }
    return at(source, path);
  };

  const view = (path: readonly PropertyKey[]): object => {
    const id = path.map(String).join('\u0000');
    const cached = views.get(id);
    if (cached) return cached;
    const target = (at(source, path) ?? {}) as object;
    const read = (key: PropertyKey): unknown => {
      const sub = [...path, key];
      // Objects in the source become views; everything else is a leaf in the current language.
      return isPlainObject(at(source, sub)) ? view(sub) : resolve(sub);
    };
    const proxy = new Proxy(target, {
      get: (tgt, key) => (typeof key === 'symbol' ? Reflect.get(tgt, key) : read(key)),
      getOwnPropertyDescriptor: (tgt, key) => {
        const d = Reflect.getOwnPropertyDescriptor(tgt, key);
        return d && typeof key !== 'symbol' ? { ...d, value: read(key) } : d;
      },
      set: () => false,
    });
    views.set(id, proxy);
    return proxy;
  };

  return view([]) as T;
}
