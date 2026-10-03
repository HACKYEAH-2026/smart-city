import Head from "expo-router/head";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { AppLink, Body, Heading, Page } from "../components/ui";
import { useI18n } from "../lib/i18n";
import { color, font, radius, shadow, space } from "../theme";

/**
 * Landing (statyczny HTML na web, natywny ekran na mobile). Teksty: messages/<locale>.json.
 * Układ responsywny przez flexWrap (bez useWindowDimensions — prerender nie zna szerokości ekranu).
 * Każdy element z flexBasis ma flexShrink: 1 i minWidth: 0 (RN domyślnie NIE zwęża elementów flex).
 */
export default function Landing() {
  const { t } = useI18n();
  const [before, after] = t.hero_title().split(t.hero_highlight());
  const features = [
    [t.feature_1_title(), t.feature_1_body()],
    [t.feature_2_title(), t.feature_2_body()],
    [t.feature_3_title(), t.feature_3_body()],
  ] as const;
  const steps = [
    [t.step_1_title(), t.step_1_body()],
    [t.step_2_title(), t.step_2_body()],
    [t.step_3_title(), t.step_3_body()],
  ] as const;
  const faq = [
    [t.faq_1_q(), t.faq_1_a()],
    [t.faq_2_q(), t.faq_2_a()],
    [t.faq_3_q(), t.faq_3_a()],
  ] as const;

  return (
    <Page>
      <Head>
        <title>{t.meta_home_title()}</title>
        <meta name="description" content={t.meta_home_description()} />
      </Head>

      <View style={styles.hero}>
        <View style={styles.heroCopy}>
          <Heading level={1}>
            {before}
            <Text style={styles.ink}>{t.hero_highlight()}</Text>
            {after}
          </Heading>
          <Body size="lead">{t.hero_lead()}</Body>
          <View style={styles.actions}>
            <AppLink href="/register" variant="button">
              {t.hero_primary()}
            </AppLink>
            <AppLink href="/login" variant="quiet">
              {t.hero_secondary()}
            </AppLink>
          </View>
        </View>
        <View style={styles.sheet} aria-label={t.hero_sample_label()}>
          {[
            [t.hero_sample_1_title(), t.hero_sample_1_body()],
            [t.hero_sample_2_title(), t.hero_sample_2_body()],
          ].map(([title, body]) => (
            <View key={title} style={styles.sheetNote}>
              <Text style={styles.sheetTitle}>{title}</Text>
              <Text style={styles.sheetBody}>{body}</Text>
            </View>
          ))}
          <Text style={styles.sheetCaption}>+ {t.hero_new_note()}</Text>
        </View>
      </View>

      <Section title={t.features_title()}>
        {features.map(([title, body]) => (
          <View key={title} style={styles.feature}>
            <Text style={styles.featureTitle}>{title}</Text>
            <Body tone="soft" style={styles.featureBody}>
              {body}
            </Body>
          </View>
        ))}
      </Section>

      <Section title={t.steps_title()}>
        <View role="list" style={styles.steps}>
          {steps.map(([title, body], i) => (
            <View role="listitem" key={title} style={styles.step}>
              <Text style={styles.stepNo}>{i + 1}</Text>
              <Heading level={3}>{title}</Heading>
              <Body tone="soft">{body}</Body>
            </View>
          ))}
        </View>
      </Section>

      <Section title={t.faq_title()}>
        {faq.map(([q, a]) => (
          <Faq key={q} q={q} a={a} />
        ))}
      </Section>

      <View style={styles.cta}>
        <Heading level={2} style={{ color: color.onInk }}>
          {t.cta_title()}
        </Heading>
        <Body style={{ color: color.onInkSoft }}>{t.cta_body()}</Body>
        <AppLink href="/register" variant="button">
          {t.cta_action()}
        </AppLink>
      </View>
    </Page>
  );
}

function Section(props: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Heading level={2}>{props.title}</Heading>
      </View>
      <View style={styles.sectionBody}>{props.children}</View>
    </View>
  );
}

function Faq(props: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.faq}>
      <Pressable role="button" aria-expanded={open} onPress={() => setOpen(!open)} style={styles.faqQ}>
        <Text style={styles.featureTitle}>{props.q}</Text>
        <Text style={styles.faqMark}>{open ? "−" : "+"}</Text>
      </Pressable>
      {open ? <Body tone="soft">{props.a}</Body> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: space.section,
    paddingVertical: space.xxl,
  },
  heroCopy: { flexGrow: 1.4, flexBasis: 420, flexShrink: 1, minWidth: 0, gap: space.xl },
  ink: {
    fontStyle: "italic",
    textDecorationLine: "underline",
    textDecorationColor: color.seal,
    textDecorationStyle: "solid",
  },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: space.m },
  sheet: {
    flexGrow: 1,
    flexBasis: 320,
    flexShrink: 1,
    minWidth: 0,
    maxWidth: 460,
    backgroundColor: color.sheet,
    borderRadius: radius.card,
    padding: space.xl,
    paddingLeft: 44,
    borderLeftWidth: 1,
    borderLeftColor: "rgba(163,52,43,0.35)",
    gap: space.xl,
    transform: [{ rotate: "1.2deg" }],
    ...shadow.sheet,
  },
  sheetNote: { gap: space.xs },
  sheetTitle: { fontFamily: font.display, fontSize: 19, fontWeight: "600", color: color.ink },
  sheetBody: { fontFamily: font.text, fontSize: 16, color: color.inkSoft },
  sheetCaption: { fontFamily: font.text, fontSize: 15, fontWeight: "600", color: color.seal },
  section: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.xl,
    paddingVertical: space.section,
    borderTopWidth: 1,
    borderTopColor: color.rule,
  },
  sectionHead: { flexGrow: 1, flexBasis: 260, flexShrink: 1, minWidth: 0 },
  sectionBody: { flexGrow: 2, flexBasis: 420, flexShrink: 1, minWidth: 0, gap: space.xs },
  feature: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.s,
    paddingVertical: space.l,
    borderBottomWidth: 1,
    borderBottomColor: color.rule,
  },
  featureTitle: {
    flexGrow: 1,
    flexBasis: 200,
    flexShrink: 1,
    minWidth: 0,
    fontFamily: font.text,
    fontSize: 17,
    fontWeight: "600",
    color: color.ink,
  },
  featureBody: { flexGrow: 1.3, flexBasis: 240, flexShrink: 1, minWidth: 0 },
  steps: { flexDirection: "row", flexWrap: "wrap", gap: space.xxl },
  step: { flexGrow: 1, flexBasis: 180, flexShrink: 1, minWidth: 0, gap: space.s },
  stepNo: { fontFamily: font.display, fontSize: 44, lineHeight: 48, color: color.seal },
  faq: { borderBottomWidth: 1, borderBottomColor: color.rule, paddingBottom: space.m },
  faqQ: { flexDirection: "row", justifyContent: "space-between", gap: space.l, paddingVertical: space.l },
  faqMark: { fontFamily: font.text, fontSize: 20, color: color.seal },
  cta: {
    marginTop: space.xxl,
    padding: space.section,
    borderRadius: radius.card,
    backgroundColor: color.ink,
    gap: space.l,
    alignItems: "flex-start",
  },
});
