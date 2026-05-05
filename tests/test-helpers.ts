/**
 * Returns an `AsyncIterableIterator` whose `next()` rejects with `err`.
 * Use to mock streaming clients (e.g. `streamChat`) that should fail on first iteration.
 * Equivalent to `async function*() { throw err; }` but without `require-yield` triggering.
 */
export function failingStream<T>(err: Error): AsyncIterableIterator<T> {
  return {
    [Symbol.asyncIterator]() {
      return this;
    },
    next: () => Promise.reject(err),
    return: () => Promise.resolve({ value: undefined as never, done: true as const }),
    throw: (e: unknown) => Promise.reject(e instanceof Error ? e : new Error(String(e))),
  };
}
