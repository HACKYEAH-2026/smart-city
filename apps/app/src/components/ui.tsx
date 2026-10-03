import { Link } from "expo-router";
import type { ReactNode } from "react";
import {
  Pressable,
  type PressableProps,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  type TextProps,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { isMarketing, locales, localizedPath, useI18n } from "../lib/i18n";
import { color, font, maxWidth, radius, space } from "../theme";

/**
 * Prymitywy UI. Na webie dają semantyczny HTML (h1–h3, a, button, label przez aria-label),
 * natywnie — natywne widoki. Ekrany składaj z nich, nie z gołych View/Text ze stylami inline.
 */

export function Heading(props: TextProps & { level: 1 | 2 | 3; size?: "display" | "section" | "item" }) {
  const { level, size, style, ...rest } = props;
  const s = size ?? (level === 1 ? "display" : level === 2 ? "section" : "item");
  return <Text role="heading" aria-level={level} style={[styles.heading, styles[s], style]} {...rest} />;
}

export function Body(props: TextProps & { tone?: "soft" | "ink" | "error"; size?: "lead" | "body" | "small" }) {
  const { tone, size, style, ...rest } = props;
  return (
    <Text
      style={[
        styles.body,
        size === "lead" && styles.lead,
        size === "small" && styles.small,
        tone === "soft" && { color: color.inkSoft },
        tone === "error" && styles.error,
        style,
      ]}
      {...rest}
    />
  );
}

type Variant = "primary" | "quiet" | "seal" | "danger";
export function Button(props: PressableProps & { label: string; variant?: Variant }) {
  const { label, variant = "primary", disabled, style, ...rest } = props;
  return (
    <Pressable
      role="button"
      disabled={disabled}
      style={(state) => [
        styles.btn,
        styles[`btn_${variant}`],
        state.pressed && { opacity: 0.85 },
        disabled && { opacity: 0.55 },
        typeof style === "function" ? style(state) : style,
      ]}
      {...rest}
    >
      <Text style={[styles.btnText, styles[`btnText_${variant}`]]}>{label}</Text>
    </Pressable>
  );
}

export function TextField(props: TextInputProps & { label: string }) {
  const { label, style, multiline, ...rest } = props;
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        aria-label={label}
        placeholderTextColor={color.inkSoft}
        multiline={multiline}
        style={[styles.input, multiline && styles.textarea, style]}
        {...rest}
      />
    </View>
  );
}

/** Link wewnętrzny. Do stron marketingowych na webie dokleja prefiks języka (/pl/...). */
export function AppLink(props: { href: string; children: ReactNode; variant?: "text" | "nav" | "button" | "quiet" }) {
  const { locale } = useI18n();
  const href = isMarketing(props.href) ? localizedPath(props.href, locale) : props.href;
  const v = props.variant ?? "text";
  const box = v === "button" ? [styles.btn, styles.btn_primary] : v === "quiet" ? [styles.btn, styles.btn_quiet] : null;
  const txt =
    v === "button"
      ? [styles.btnText, styles.btnText_primary]
      : v === "quiet"
        ? [styles.btnText, styles.btnText_quiet]
        : v === "nav"
          ? styles.navLink
          : styles.link;
  return (
    <Link href={href as never} style={[txt, box]}>
      {props.children}
    </Link>
  );
}

/** Rama strony: nagłówek, treść (przewijana), stopka z wyborem języka. */
export function Page(props: { children: ReactNode; narrow?: boolean }) {
  const { t, locale, setLocale } = useI18n();
  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.frame}>
          <View style={styles.masthead}>
            <AppLink href="/" variant="nav">
              <Text style={styles.wordmark}>Notebook</Text>
            </AppLink>
            <View role="navigation" aria-label={t.nav_label()} style={styles.nav}>
              <AppLink href="/about" variant="nav">
                {t.nav_about()}
              </AppLink>
              <AppLink href="/login" variant="nav">
                {t.nav_login()}
              </AppLink>
              <AppLink href="/app" variant="nav">
                {t.nav_open_app()}
              </AppLink>
            </View>
          </View>
          <View role="main" style={[styles.main, props.narrow && styles.narrow]}>
            {props.children}
          </View>
          <View style={styles.colophon}>
            <Body size="small" tone="soft">
              Notebook · {t.footer_note()}
            </Body>
            <View role="navigation" aria-label={t.language_label()} style={styles.nav}>
              {locales.map((l) => (
                <Pressable
                  key={l}
                  role="link"
                  aria-current={l === locale ? "true" : undefined}
                  onPress={() => setLocale(l)}
                >
                  <Text style={[styles.navLink, l === locale && styles.navActive]}>{l.toUpperCase()}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.paper },
  scroll: { flexGrow: 1 },
  frame: { width: "100%", maxWidth: maxWidth.frame, alignSelf: "center", paddingHorizontal: space.xl, flexGrow: 1 },
  masthead: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.l,
    paddingVertical: space.xl,
    borderBottomWidth: 1,
    borderBottomColor: color.rule,
  },
  wordmark: { fontFamily: font.display, fontSize: 24, fontWeight: "600", color: color.ink },
  nav: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: space.l },
  navLink: { fontFamily: font.text, fontSize: 15, color: color.inkSoft, textDecorationLine: "none" },
  navActive: { color: color.ink, fontWeight: "700" },
  main: { flexGrow: 1, paddingVertical: space.xxl },
  narrow: { width: "100%", maxWidth: maxWidth.narrow, alignSelf: "center" },
  colophon: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignItems: "center",
    gap: space.m,
    marginTop: space.section,
    paddingVertical: space.xl,
    borderTopWidth: 1,
    borderTopColor: color.rule,
  },
  heading: { fontFamily: font.display, color: color.ink, fontWeight: "500" },
  display: { fontSize: 48, lineHeight: 52, letterSpacing: -0.8 },
  section: { fontSize: 30, lineHeight: 36 },
  item: { fontSize: 20, lineHeight: 26 },
  body: { fontFamily: font.text, fontSize: 17, lineHeight: 26, color: color.ink },
  lead: { fontSize: 20, lineHeight: 30, color: color.inkSoft, maxWidth: 560 },
  small: { fontSize: 14, lineHeight: 20 },
  error: { color: color.seal, fontWeight: "600" },
  link: { color: color.ink, textDecorationLine: "underline", textDecorationColor: color.seal },
  btn: {
    minHeight: 44,
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: radius.control,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-start",
  },
  btn_primary: { backgroundColor: color.ink, borderColor: color.ink },
  btn_quiet: { backgroundColor: "transparent", borderColor: color.ink },
  btn_seal: { backgroundColor: color.seal, borderColor: color.seal },
  btn_danger: { backgroundColor: "transparent", borderColor: color.seal },
  btnText: { fontFamily: font.text, fontSize: 16, fontWeight: "600", textDecorationLine: "none" },
  btnText_primary: { color: color.onInk },
  btnText_quiet: { color: color.ink },
  btnText_seal: { color: color.onSeal },
  btnText_danger: { color: color.seal },
  field: { gap: 6 },
  fieldLabel: { fontFamily: font.text, fontSize: 14, fontWeight: "600", color: color.inkSoft },
  input: {
    fontFamily: font.text,
    fontSize: 17,
    color: color.ink,
    backgroundColor: color.sheet,
    borderWidth: 1,
    borderColor: color.rule,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  textarea: { minHeight: 96, textAlignVertical: "top" },
});
