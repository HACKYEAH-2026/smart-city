import { getLocales } from "expo-localization";
import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { Platform } from "react-native";
import en from "../../messages/en.json";
import pl from "../../messages/pl.json";
import { storage } from "./storage";

/**
 * i18n: komunikaty wprost z messages/<locale>.json (bez kompilacji). Język jest JAWNY — nie ma globalnego stanu:
 * zapisana preferencja → język urządzenia → angielski.
 * Użycie w komponencie: `const { t } = useI18n(); t.communities_title()`.
 */
const catalogs = { en, pl } satisfies Record<string, Record<keyof typeof en, string>>;
export type Locale = keyof typeof catalogs;
export const baseLocale: Locale = "en";
export const locales = Object.keys(catalogs) as Locale[];
export const isLocale = (v: string): v is Locale => Object.hasOwn(catalogs, v);

export const LOCALE_KEY = "locale";

export type Bound = { [K in keyof typeof en]: () => string };
const cache = new Map<Locale, Bound>();

/** Wszystkie komunikaty związane z danym językiem (bez globalnego stanu — działa też w prerenderze). */
export function messagesFor(locale: Locale): Bound {
  let bound = cache.get(locale);
  if (!bound) {
    const msgs: Record<string, string> = catalogs[locale];
    bound = Object.fromEntries(Object.keys(en).map((k) => [k, () => msgs[k] ?? k])) as Bound;
    cache.set(locale, bound);
  }
  return bound;
}

const deviceLocale = (): Locale => {
  for (const l of getLocales()) if (l.languageCode && isLocale(l.languageCode)) return l.languageCode;
  return baseLocale;
};

type Ctx = { locale: Locale; t: Bound; setLocale: (l: Locale) => void };
const I18nContext = createContext<Ctx | null>(null);

export function I18nProvider(props: { children: ReactNode }) {
  const [preference, setPreference] = useState<Locale | null>(null);
  const locale: Locale = preference ?? baseLocale;

  useEffect(() => {
    storage.get(LOCALE_KEY).then((v) => setPreference(v && isLocale(v) ? v : deviceLocale()));
  }, []);

  useEffect(() => {
    if (Platform.OS === "web") document.documentElement.lang = locale;
  }, [locale]);

  const value = useMemo<Ctx>(
    () => ({
      locale,
      t: messagesFor(locale),
      setLocale: (l) => {
        setPreference(l);
        void storage.set(LOCALE_KEY, l);
      },
    }),
    [locale],
  );
  return <I18nContext.Provider value={value}>{props.children}</I18nContext.Provider>;
}

export function useI18n(): Ctx {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n poza I18nProvider");
  return ctx;
}
