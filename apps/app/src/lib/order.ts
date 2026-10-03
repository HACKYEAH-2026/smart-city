/** `keys` with `key` moved to `index` (the dashboard order: on the dashboard and in "Zarządzaj miejscem"). */
export const moveTo = (keys: string[], key: string, index: number): string[] => {
  const rest = keys.filter((k) => k !== key);
  return [...rest.slice(0, index), key, ...rest.slice(index)];
};
