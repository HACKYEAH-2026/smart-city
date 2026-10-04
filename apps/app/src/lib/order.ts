/** `items` with `item` moved to `index` (the dashboard order: on the dashboard and in the layout editor). */
export const moveTo = <T>(items: T[], item: T, index: number): T[] => {
  const rest = items.filter((other) => other !== item);
  return [...rest.slice(0, index), item, ...rest.slice(index)];
};
