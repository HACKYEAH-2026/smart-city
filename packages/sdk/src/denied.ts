import type { Permission } from "./plugin";

/**
 * A `ctx` service the plugin's manifest does not declare. Any use, at any depth (`ctx.db.items.findMany()`,
 * `ctx.ai.call()`), rejects with a clear error. Used by the host and the test harness.
 */
export function deniedService<T extends object>(permission: Permission): T {
  const fail = () => Promise.reject(new Error(`Plugin did not declare the "${permission}" permission`));
  const proxy: object = new Proxy(fail, {
    // Not a thenable: `await ctx.db` must not hang.
    get: (_, key) => (key === "then" ? undefined : proxy),
    apply: () => fail(),
  });
  return proxy as T;
}
