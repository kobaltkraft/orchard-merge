// DEV-only network guard: detects accidental remote requests. No-op in prod.
export function installNetGuard(): void {
  if (!import.meta.env.DEV) return;
  const bad = (url: string) => /^(https?:)?\/\//.test(url) && !url.startsWith('http://localhost') && !url.startsWith('http://127.') && !/localhost:\d+/.test(url);
  const origFetch = window.fetch.bind(window);
  window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url;
    if (bad(url)) console.error('[netGuard] BLOCKED remote fetch:', url);
    return origFetch(input, init);
  }) as typeof fetch;
  const OrigImage = window.Image;
  // @ts-expect-error patch
  window.Image = function (...args: unknown[]) {
    const img = new OrigImage(...(args as []));
    const origSet = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src')?.set;
    Object.defineProperty(img, 'src', { set(v: string) { if (bad(v)) console.error('[netGuard] BLOCKED remote image:', v); origSet?.call(img, v); } });
    return img;
  };
}
