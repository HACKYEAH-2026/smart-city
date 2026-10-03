import { getLocales } from "expo-localization";
import { usePathname, useRouter } from "expo-router";
import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { Platform } from "react-native";
import type { m } from "../paraglide/messages.js";
import * as messages from "../paraglide/messages.js";
import { baseLocale, isLocale, type Locale, locales } from "../paraglide/runtime.js";
import { storage } from "./storage";

/**
 * i18n (Paraglide JS). Język jest JAWNY — nie ma globalnego getLocale():
 *  - web, strony marketingowe (SEO): język z URL — "/" i "/about" = en, "/pl" i "/pl/about" = pl,
 *  - ekrany aplikacji (web i natywnie): zapisana preferencja → język urządzenia → angielski.
 * Użycie w komponencie: `const { t } = useI18n(); t.notes_title()`.
 */
export const LOCALE_KEY = "locale";
export const MARKETING_PATHS = ["/", "/about"] as const;

export function localeFromPath(pathname: string): Locale | null {
  const first = pathname.split("/")[1] ?? "";
  return first !== baseLocale && isLocale(first) ? first : null;
}

export function stripLocale(pathname: string): string {
  const l = localeFromPath(pathname);
  if (!l) return pathname || "/";
  return pathname.slice(l.length + 1) || "/";
}

export function localizedPath(path: string, locale: Locale): string {
  if (locale === baseLocale) return path;
  return path === "/" ? `/${locale}` : `/${locale}${path}`;
}

export const isMarketing = (pathname: string) => (MARKETING_PATHS as readonly string[]).includes(stripLocale(pathname));

type Messages = typeof m;
export type Bound = { [K in keyof Messages]: (inputs?: Parameters<Messages[K]>[0]) => string };
const cache = new Map<Locale, Bound>();

/** Wszystkie komunikaty związane z danym językiem (bez globalnego stanu — działa też w prerenderze). */
export function messagesFor(locale: Locale): Bound {
  let bound = cache.get(locale);
  if (!bound) {
    const all = messages.m as unknown as Record<string, (i: unknown, o: { locale: Locale }) => string>;
    bound = new Proxy({} as Bound, {
      get: (_, key: string) => (inputs?: unknown) => all[key]?.(inputs ?? {}, { locale }) ?? key,
    });
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
  const pathname = usePathname();
  const router = useRouter();
  const [preference, setPreference] = useState<Locale | null>(null);
  const urlDecides = Platform.OS === "web" && isMarketing(pathname);
  const locale: Locale = urlDecides ? (localeFromPath(pathname) ?? baseLocale) : (preference ?? baseLocale);

  useEffect(() => {
    storage.get(LOCALE_KEY).then((v) => setPreference(v && isLocale(v) ? v : deviceLocale()));
  }, []);

  // Wejście na stronę marketingową w danym języku = wybór języka (zapamiętany dla ekranów aplikacji).
  useEffect(() => {
    if (urlDecides && preference !== locale) {
      setPreference(locale);
      void storage.set(LOCALE_KEY, locale);
    }
    if (Platform.OS === "web") document.documentElement.lang = locale;
  }, [urlDecides, locale, preference]);

  const value = useMemo<Ctx>(
    () => ({
      locale,
      t: messagesFor(locale),
      setLocale: (l) => {
        setPreference(l);
        void storage.set(LOCALE_KEY, l);
        if (urlDecides) router.replace(localizedPath(stripLocale(pathname), l) as never);
      },
    }),
    [locale, urlDecides, pathname, router],
  );
  return <I18nContext.Provider value={value}>{props.children}</I18nContext.Provider>;
}

export function useI18n(): Ctx {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n poza I18nProvider");
  return ctx;
}

export { locales };
