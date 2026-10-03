/** Web build: no pushes (residents get them on phones; see push.ts). Same API as push.ts. */
export async function setupPush(): Promise<void> {}

export async function pushToken(_opts: { ask: boolean }): Promise<string | null> {
  return null;
}

export function onPushTap(_open: (data: unknown) => void): () => void {
  return () => {};
}
