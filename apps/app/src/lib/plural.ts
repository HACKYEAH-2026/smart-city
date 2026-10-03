/** Polish count of widgets: "1 widżet", "3 widżety", "5 widżetów" (teens and 12–14 take the genitive plural). */
export function widgetsCount(n: number): string {
  const last = n % 10;
  const teen = Math.floor(n / 10) % 10 === 1;
  if (n === 1) return `${n} widżet`;
  if (!teen && last >= 2 && last <= 4) return `${n} widżety`;
  return `${n} widżetów`;
}
