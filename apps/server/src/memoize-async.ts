/** Share identical in-flight work and recent results; failed work is never cached. */
export function memoizeAsync<T>(
  run: (key: string) => Promise<T>,
  maxEntries: number,
  ttlMs: number,
): (key: string) => Promise<T> {
  const cache = new Map<string, { promise: Promise<T>; expires: number }>();
  return (key) => {
    const now = Date.now();
    for (const [oldKey, entry] of cache)
      if (entry.expires <= now) cache.delete(oldKey);
    const cached = cache.get(key);
    if (cached) return cached.promise;
    const promise = Promise.resolve().then(() => run(key));
    cache.set(key, { promise, expires: now + ttlMs });
    while (cache.size > maxEntries) cache.delete(cache.keys().next().value!);
    void promise.catch(() => {
      if (cache.get(key)?.promise === promise) cache.delete(key);
    });
    return promise;
  };
}
