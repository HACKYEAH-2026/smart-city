/**
 * Polish count with the noun in its form for `n`: [one, few, many], e.g. ["osoba", "osoby", "osób"] → "1 osoba",
 * "3 osoby", "5 osób" ("few" for 2–4 except 12–14; teens and the rest take "many").
 */
export function countOf(n: number, [one, few, many]: readonly [string, string, string]): string {
  const last = n % 10;
  const teen = Math.floor(n / 10) % 10 === 1;
  if (n === 1) return `${n} ${one}`;
  if (!teen && last >= 2 && last <= 4) return `${n} ${few}`;
  return `${n} ${many}`;
}

/** Polish count of widgets: "1 widżet", "3 widżety", "5 widżetów" (teens and 12–14 take the genitive plural). */
export const widgetsCount = (n: number): string => countOf(n, ["widżet", "widżety", "widżetów"]);
