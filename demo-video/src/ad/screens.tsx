import { PluginRenderer } from "@app/app/src/plugins/Renderer";
import { t } from "@app/app/src/texts";
import { type UINode, ui } from "@app/plugin-sdk";
import { ChevronDown, ChevronLeft, Flashlight, Puzzle, Settings, Sparkles, X } from "lucide-react-native";
import { Image, StyleSheet, View } from "react-native";
import { continueRender, delayRender } from "remotion";
import {
  ActionRow,
  Badge,
  Button,
  Card,
  Checkbox,
  CheckCard,
  colors,
  DashboardMap,
  DisclosureCard,
  Heading,
  Icon,
  IconButton,
  QrCode,
  RadioCard,
  radii,
  ScannerFrame,
  sizes,
  spacing,
  Text,
  TextField,
} from "../app-ui";
import { Spinner } from "./kit";
import { AppScreen } from "./Phone";

/**
 * The app's screens as the ad shows them: the real design-system components, and plugin views drawn by the
 * app's own Server-Driven UI renderer from the same `ui.*` trees the plugins build (plugins/issues,
 * plugins/announcements). Content is the demo place „Kraków” (invite code KRK-MST) with sample reports.
 */

const nothing = () => {};
const noUpload = () => Promise.reject(new Error("The ad uploads nothing"));

/** A plugin view rendered by the app's renderer. */
const Plugin = ({ node }: { node: UINode }) => (
  <PluginRenderer node={node} onAction={nothing} busy={false} upload={noUpload} />
);

/** The photo in the sample report: a street at dusk under a lamp that does not shine. */
// Base64: react-native-web puts the URI into an unquoted CSS url(), which the SVG's own "url(#s)" would end.
export const LAMP_PHOTO = `data:image/svg+xml;base64,${btoa(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300">
<defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1D2747"/><stop offset=".62" stop-color="#4B4D78"/><stop offset="1" stop-color="#C98B6A"/></linearGradient></defs>
<rect width="400" height="300" fill="url(#s)"/>
<path fill="#141A2F" d="M0 176h56v-46h48v62h34v-86h74v94h44v-54h58v36h86v118H0z"/>
<g fill="#F2C46D" opacity=".75"><rect x="150" y="122" width="8" height="10"/><rect x="170" y="122" width="8" height="10"/><rect x="150" y="146" width="8" height="10"/><rect x="190" y="146" width="8" height="10"/><rect x="66" y="146" width="7" height="9"/><rect x="268" y="156" width="8" height="10"/><rect x="330" y="176" width="8" height="10"/></g>
<path fill="#1F2539" d="M0 236 400 222v78H0z"/><path stroke="#3A3F57" stroke-width="3" stroke-dasharray="18 14" d="M0 268l400-14"/>
<rect x="296" y="66" width="9" height="206" rx="2" fill="#0D1121"/><path d="M300 76c0-16-12-20-30-20h-18" stroke="#0D1121" stroke-width="7" fill="none"/>
<path d="M232 52h44l-7 13h-30z" fill="#0D1121"/><rect x="240" y="65" width="28" height="4" rx="2" fill="#3C4158"/>
</svg>`)}`;

// The app's <Image> shows a photo only once it has loaded; loaded before rendering, it shows in the first frame.
const photoReady = delayRender("Loading the sample photo");
Image.prefetch(LAMP_PHOTO).then(() => continueRender(photoReady));

const STATUS = {
  open: { text: "Nowe", tone: "info" },
  accepted: { text: "Przyjęte", tone: "warning" },
  fixed: { text: "Naprawione", tone: "success" },
} as const;
export type Status = keyof typeof STATUS;

/** "1 osoba zgłasza", "3 osoby zgłaszają", "5 osób zgłasza" (the issues plugin's wording). */
const supporters = (n: number) => {
  const few = [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100);
  return n === 1 ? "1 osoba zgłasza" : few ? `${n} osoby zgłaszają` : `${n} osób zgłasza`;
};

export const ISSUE = {
  title: "Nie świeci latarnia przy przystanku",
  description: "Latarnia przy przystanku nie świeci od tygodnia. Wieczorem jest tu zupełnie ciemno.",
  category: "Oświetlenie",
};
const photo = (alt: string): UINode => ({ ...ui.image("lamp", alt), url: LAMP_PHOTO });

/** A dashboard tile of a 2×3 widget (plugins/Dashboard.tsx: rows of sizes.widgetRow, gaps between them). */
const TILE = 3 * sizes.widgetRow + 2 * spacing[6];

/** The reported issue as a card of the issues plugin, with how many residents report it. */
export const IssueCard = ({ support }: { support: number }) => (
  <Plugin
    node={ui.card({
      title: ISSUE.title,
      subtitle: `${ISSUE.category} · ${supporters(support)}`,
      badge: STATUS.open,
      children: [photo(`Zdjęcie: ${ISSUE.title}`)],
    })}
  />
);

/** Widget of the issues plugin: the most reported open issues and „Zgłoś problem”. */
export const issuesWidget = (support: number, status: Status = "open") =>
  ui.widget(
    "Zgłoszenia",
    [
      ui.list("Najczęściej zgłaszane", [
        ui.card({ title: ISSUE.title, subtitle: supporters(support), badge: STATUS[status] }),
        ui.card({ title: "Dziura w chodniku przy szkole", subtitle: supporters(2), badge: STATUS.open }),
        ui.card({ title: "Przepełniony kosz na skwerze", subtitle: supporters(1), badge: STATUS.accepted }),
      ]),
      ui.button("Zgłoś problem", ui.navigate("new")),
    ],
    ui.navigate("list"),
  );

/** Widget of the announcements plugin with one announcement since the last visit. */
export const announcementsWidget = (title: string) =>
  ui.widget(
    "Ogłoszenia",
    [
      ui.text("1 nowe ogłoszenie od Twojej ostatniej wizyty", "soft"),
      ui.card({ title, onPress: ui.navigate("item") }),
      ui.button("Wszystkie ogłoszenia", ui.navigate("list"), "quiet"),
    ],
    ui.navigate("list"),
  );

/** „Czy to ten sam problem?” — the issues plugin's question before merging two reports. */
export const mergeView = () =>
  ui.screen("Czy to ten sam problem?", [
    ui.text("Znaleźliśmy podobne zgłoszenie w okolicy.", "soft"),
    ui.card({
      title: ISSUE.title,
      subtitle: ISSUE.category,
      badge: STATUS.open,
      children: [ui.text(ISSUE.description), photo(`Zdjęcie: ${ISSUE.title}`)],
    }),
    ui.button("Tak, dołącz moje zgłoszenie", ui.tool("merge")),
    ui.button("Nie, to inny problem", ui.tool("report"), "quiet"),
  ]);

/** The issue's page: status, support and, for the city's admin, the status buttons. */
export const detailView = ({ support, status, admin }: { support: number; status: Status; admin: boolean }) =>
  ui.screen(ISSUE.title, [
    ui.row([ui.badge(STATUS[status].text, STATUS[status].tone), ui.badge(ISSUE.category)]),
    ui.stat("Poparcie", supporters(support)),
    admin
      ? ui.row([
          ui.button("Przyjmij", ui.tool("setStatus"), "quiet"),
          ui.button("Oznacz jako naprawione", ui.tool("setStatus"), "quiet"),
        ])
      : ui.badge("Zgłaszasz ten problem", "success"),
    ui.text(ISSUE.description),
    photo(`Zdjęcie: ${ISSUE.title}`),
  ]);

/** Plugin view as the app shows it: „Wróć” over the plugin's screen. */
export const PluginScreen = ({ node, scroll = 0 }: { node: UINode; scroll?: number }) => (
  <AppScreen scroll={scroll}>
    <Text variant="link" color="primary">
      {t.back}
    </Text>
    <Plugin node={node} />
  </AppScreen>
);

/** Pulpit: greeting, the place, its widgets as tiles of the plugins' declared size, the tab bar. */
export const DashboardScreen = ({
  widgets,
  admin = false,
  scroll = 0,
  place = "Kraków",
  name = "Anna",
  arrive = 1,
}: {
  widgets: UINode[];
  admin?: boolean;
  scroll?: number;
  place?: string;
  name?: string;
  /** 0 → 1: the first widget arrives (grows into the grid, pushing the others down). */
  arrive?: number;
}) => (
  <AppScreen tabBar backdrop={<DashboardMap />} scroll={scroll}>
    <View style={styles.top}>
      <Text variant="body" color="textSecondary">
        {`${t.dashboard_greeting}, ${admin ? "Urząd Miasta" : name}`}
      </Text>
      {admin ? <IconButton icon={Settings} label={t.manage_title} variant="round" onPress={nothing} /> : null}
    </View>
    <View style={styles.place}>
      <Text variant="label" color="textSecondary">
        {t.place_current_label}
      </Text>
      <View style={styles.nameRow}>
        <Heading level={1} variant="heading">
          {place}
        </Heading>
        <View style={styles.chevron}>
          <Icon icon={ChevronDown} size={spacing[8]} color="primary" strokeWidth={2.6} />
        </View>
      </View>
    </View>
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Text variant="label" color="textSecondary">
          {t.community_dashboard_label}
        </Text>
        <Text variant="small" color="textSecondary">
          {widgets.length === 1 ? "1 widżet" : `${widgets.length} widżety`}
        </Text>
      </View>
      {widgets.map((node, i) => (
        <View
          // biome-ignore lint/suspicious/noArrayIndexKey: a fixed list of tiles.
          key={i}
          style={[
            styles.tile,
            i === 0 && arrive < 1
              ? { height: TILE * arrive, opacity: arrive, transform: [{ scale: 0.9 + arrive * 0.1 }] }
              : null,
          ]}
        >
          <Plugin node={node} />
        </View>
      ))}
    </View>
  </AppScreen>
);

/** The camera scanner with the place's QR code in front of it; `seen` 0 → 1 brings the code into the frame. */
export const ScannerScreen = ({ seen, line }: { seen: number; line: number }) => (
  <View style={styles.scanner}>
    <View style={styles.scanTop}>
      <IconButton variant="roundOnDark" icon={X} label={t.back} onPress={nothing} />
      <Text variant="labelL" color="scannerText">
        {t.scan_title}
      </Text>
      <IconButton variant="roundOnDark" icon={Flashlight} label={t.scan_torch} onPress={nothing} />
    </View>
    <View style={styles.scanMiddle}>
      <ScannerFrame>
        <View style={[styles.paper, { opacity: seen, transform: [{ scale: 0.82 + seen * 0.12 }] }]}>
          <QrCode value="twojemiejsce://app/preview?code=KRKMST" size={168} label="Kod QR miejsca Kraków" />
        </View>
        <View style={[styles.scanLine, { top: 32 + line * (sizes.scannerFrame - 64) }]} />
      </ScannerFrame>
    </View>
    <View style={styles.scanBottom}>
      <Text variant="bodyL" color="scannerText" style={styles.hint}>
        {t.scan_hint}
      </Text>
    </View>
  </View>
);

/** Podgląd miejsca after the scan: the place, its code and „Dołącz do miejsca”. */
export const PreviewScreen = () => (
  <AppScreen>
    <View style={styles.map}>
      <DashboardMap />
    </View>
    <View style={styles.details}>
      <Heading level={1} variant="heading">
        Kraków
      </Heading>
      <Text variant="body" color="textSecondary">
        pl. Wszystkich Świętych 3-4, 31-004 Kraków
      </Text>
    </View>
    <Card>
      <View style={styles.codeRow}>
        <Text variant="body" color="textSecondary">
          {t.place_preview_code}
        </Text>
        <Text variant="codeM">KRK-MST</Text>
      </View>
    </Card>
    <Checkbox checked={false} onChange={nothing} label={t.place_preview_default} />
    <View style={styles.grow} />
    <Button label={t.place_preview_join} onPress={nothing} />
  </AppScreen>
);

const CATEGORIES = ["Oświetlenie", "Drogi i chodniki", "Zieleń", "Czystość", "Inne"];

/**
 * „Nowe zgłoszenie”, laid out exactly as the renderer draws the issues plugin's form (Renderer.tsx: PluginForm),
 * so the ad can show a picked photo (the renderer keeps the picker's preview in its own state).
 */
export const IssueFormScreen = ({
  title,
  category,
  withPhoto,
  scroll,
}: {
  title: string;
  category: string;
  withPhoto: boolean;
  scroll: number;
}) => (
  <AppScreen scroll={scroll}>
    <Text variant="link" color="primary">
      {t.back}
    </Text>
    <View style={styles.stack}>
      <Heading level={1}>Nowe zgłoszenie</Heading>
      <View style={styles.stack}>
        <TextField label="Co się stało?" value={title} onChangeText={nothing} />
        <View style={styles.stackTight}>
          <Text variant="label" color="textSecondary">
            Kategoria
          </Text>
          <View style={styles.stackTight}>
            {CATEGORIES.map((c) => (
              <RadioCard key={c} label={c} selected={c === category} onPress={nothing} />
            ))}
          </View>
        </View>
        <TextField label="Szczegóły i miejsce" multiline value="" onChangeText={nothing} />
        <View style={styles.stackTight}>
          <Text variant="label" color="textSecondary">
            Zdjęcie (opcjonalnie)
          </Text>
          {withPhoto ? <Image source={{ uri: LAMP_PHOTO }} style={styles.photo} resizeMode="cover" /> : null}
          <View style={styles.row}>
            <Button
              label={withPhoto ? t.plugin_photo_remove : t.plugin_photo_gallery}
              variant="secondary"
              size="sm"
              fullWidth={false}
              onPress={nothing}
            />
          </View>
        </View>
        <Button label="Wyślij zgłoszenie" onPress={nothing} />
      </View>
    </View>
  </AppScreen>
);

/** Nowe miejsce, step 3 of 4: which plugins the place turns on. `on` = how many are ticked so far. */
export const FeaturesScreen = ({ on }: { on: number }) => (
  <AppScreen>
    <View style={styles.stack}>
      <Text variant="stepNumber" color="textSecondary">
        Krok 3 z 4
      </Text>
      <View style={styles.progress}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={[styles.segment, i < 3 && styles.segmentOn]} />
        ))}
      </View>
    </View>
    <View style={styles.stackTight}>
      <Heading level={1}>{t.create_features_title}</Heading>
      <Text variant="bodyL" color="textSecondary">
        {t.create_features_lead}
      </Text>
    </View>
    <View style={styles.stackMid}>
      {PLUGINS.map((p, i) => (
        <CheckCard key={p.label} {...p} checked={i < on} onChange={nothing} />
      ))}
    </View>
  </AppScreen>
);

/** Widget of a plugin the AI wrote in the ad: residents vote on ideas for the city's budget. */
export const budgetWidget = () =>
  ui.widget(
    "Budżet obywatelski",
    [
      ui.text("Zagłosuj na pomysły dla Twojej okolicy.", "soft"),
      ui.progress({ label: "Nowe latarnie przy przystankach", value: 62, max: 100 }),
      ui.progress({ label: "Zieleń na skwerze przy szkole", value: 38, max: 100 }),
      ui.button("Zagłosuj", ui.navigate("vote")),
    ],
    ui.navigate("list"),
  );

const PLUGINS = [
  {
    emoji: "🛠️",
    label: "Zgłoszenia",
    description: "Zgłaszanie usterek ze zdjęciem; AI łączy zgłoszenia tego samego problemu.",
  },
  {
    emoji: "📢",
    label: "Ogłoszenia",
    description: "Ogłoszenia administratorów dla mieszkańców, z podglądem nowości na pulpicie.",
  },
  { emoji: "💬", label: "Dyskusje", description: "Forum społeczności: dyskusje, odpowiedzi i moderacja." },
];

/** Back button with the place's name over a title (the header of the admin's screens). */
const AdminHeader = ({ title }: { title: string }) => (
  <View style={styles.adminHeader}>
    <IconButton icon={ChevronLeft} label={t.back} onPress={nothing} />
    <View style={styles.adminHeaderText}>
      <Text variant="label" color="textSecondary">
        Kraków
      </Text>
      <Heading level={1} variant="headingS">
        {title}
      </Heading>
    </View>
  </View>
);

/** Zarządzaj miejscem with „Rozszerzenia” open: the place's plugins and „Stwórz rozszerzenie z AI”. */
export const ManageScreen = () => (
  <AppScreen>
    <AdminHeader title={t.manage_title} />
    <DisclosureCard icon={Puzzle} title={t.manage_plugins_title} summary="3 rozszerzenia" open onToggle={nothing}>
      <Text variant="bodyL" color="textSecondary">
        {t.manage_plugins_lead}
      </Text>
      <View style={styles.stackMid}>
        {PLUGINS.map((p) => (
          <CheckCard key={p.label} {...p} checked onChange={nothing} />
        ))}
      </View>
      <ActionRow
        icon={Sparkles}
        title={t.build_entry_title}
        subtitle={t.build_entry_subtitle}
        href="/app/c/krakow/build"
      />
    </DisclosureCard>
  </AppScreen>
);

/** What the AI built, as the builder's outline card shows it. */
export const BUILT = {
  icon: "🗳️",
  name: "Budżet obywatelski",
  holds: "2 widoki · 2 akcje · 2 tabele · 1 widżet",
  description: "Mieszkańcy głosują na pomysły dla okolicy, a wyniki widać na pulpicie miejsca.",
};

export type BuildStage = "typing" | "working" | "ready" | "published";

/**
 * Rozszerzenie z AI (screens/BuildPlugin.tsx): the admin's request, the AI writing and checking (`attempt`), the plugin it
 * built, publishing.
 */
export const BuildScreen = ({
  request,
  stage,
  attempt = 0,
}: {
  request: string;
  stage: BuildStage;
  attempt?: number;
}) => (
  <AppScreen>
    <AdminHeader title={t.build_title} />
    {stage === "typing" ? (
      <>
        <Text variant="bodyL" color="textSecondary">
          {t.build_lead}
        </Text>
        <TextField
          label={t.build_request_label}
          value={request}
          placeholder={t.build_request_placeholder}
          multiline
          onChangeText={nothing}
        />
        <Button
          label={t.build_create}
          leftIcon={<Icon icon={Sparkles} size={sizes.iconS} color="onPrimary" strokeWidth={2} />}
          disabled={request.length < 10}
          onPress={nothing}
        />
      </>
    ) : (
      <>
        <View style={styles.request}>
          <Text variant="label" color="textSecondary">
            {`${t.build_you} · ${t.build_version} 1`}
          </Text>
          <Text variant="body">{request}</Text>
        </View>
        {stage === "working" ? (
          <Card style={styles.buildCard}>
            <View style={styles.buildRow}>
              <Spinner />
              <Text variant="cardTitle">{attempt > 0 ? `${t.build_working_attempt} ${attempt}` : t.build_working}</Text>
            </View>
            <Text variant="caption" color="textSecondary">
              {t.build_working_hint}
            </Text>
          </Card>
        ) : (
          <Card style={styles.buildCard}>
            <View style={styles.buildRow}>
              <Text variant="heading">{BUILT.icon}</Text>
              <View style={styles.grow}>
                <Heading level={3} variant="headingS">
                  {BUILT.name}
                </Heading>
                <Text variant="small" color="textSecondary">
                  {BUILT.holds}
                </Text>
              </View>
              <Badge text={t.build_made_by_ai} tone="accent" />
            </View>
            <Text variant="body">{BUILT.description}</Text>
          </Card>
        )}
        {stage === "ready" ? (
          <>
            <Text variant="bodyL" color="textSecondary">
              {t.build_draft_note}
            </Text>
            <Button label={t.build_publish} onPress={nothing} />
          </>
        ) : null}
        {stage === "published" ? (
          <View style={styles.buildRow}>
            <Text variant="bodyL" style={styles.grow}>{`${t.build_published} 1`}</Text>
            <Text variant="link" color="primary">
              {t.build_open}
            </Text>
          </View>
        ) : null}
      </>
    )}
  </AppScreen>
);

const styles = StyleSheet.create({
  adminHeader: { flexDirection: "row", alignItems: "center", gap: spacing[7] },
  adminHeaderText: { flex: 1, gap: spacing[1] },
  request: {
    alignSelf: "flex-end",
    maxWidth: "90%",
    gap: spacing[2],
    padding: spacing[7],
    borderRadius: radii.xl,
    backgroundColor: colors.surfaceSunken,
  },
  buildCard: { gap: spacing[5] },
  buildRow: { flexDirection: "row", alignItems: "center", gap: spacing[6] },
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing[6] },
  place: { gap: spacing[2] },
  nameRow: { flexDirection: "row", alignItems: "center", gap: spacing[6] },
  chevron: {
    width: spacing[8] * 2,
    height: spacing[8] * 2,
    borderRadius: radii.xl,
    backgroundColor: colors.primaryTint,
    alignItems: "center",
    justifyContent: "center",
  },
  section: { gap: spacing[6] },
  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  tile: { height: TILE },
  scanner: { flex: 1, backgroundColor: colors.scannerBg, paddingTop: 62, paddingBottom: 60, paddingHorizontal: 24 },
  scanTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  scanMiddle: { flex: 1, alignItems: "center", justifyContent: "center" },
  scanBottom: { alignItems: "center" },
  hint: { maxWidth: sizes.scannerHint, textAlign: "center" },
  paper: {
    position: "absolute",
    top: 34,
    left: 34,
    width: 200,
    height: 200,
    borderRadius: 18,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  scanLine: { position: "absolute", left: 32, right: 32, height: 2, backgroundColor: colors.primary },
  map: { height: sizes.dashboardMap, overflow: "hidden", borderRadius: radii["4xl"] },
  details: { gap: spacing[2] },
  codeRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  grow: { flex: 1 },
  stack: { gap: spacing[9] },
  stackMid: { gap: spacing[5] },
  stackTight: { gap: spacing[2] },
  row: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing[4] },
  photo: { width: "100%", aspectRatio: 4 / 3, borderRadius: radii["3xl"], backgroundColor: colors.mapBase },
  progress: { flexDirection: "row", gap: spacing[3] },
  segment: { flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.border },
  segmentOn: { backgroundColor: colors.primary },
});
