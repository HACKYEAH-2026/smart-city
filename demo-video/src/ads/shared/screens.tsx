import { PluginRenderer } from "@app/app/src/plugins/Renderer";
import { t } from "@app/app/src/texts";
import { type UINode, ui } from "@app/plugin-sdk";
import {
  AlertTriangle,
  Camera,
  ChevronDown,
  ChevronLeft,
  Flashlight,
  Image as GalleryIcon,
  Lightbulb,
  MapPin,
  Puzzle,
  Settings,
  Sparkles,
  X,
} from "lucide-react-native";
import { Image, StyleSheet, View } from "react-native";
import { continueRender, delayRender, staticFile } from "remotion";
import {
  ActionRow,
  Badge,
  Button,
  borders,
  Card,
  Checkbox,
  CheckCard,
  Chip,
  ChoiceButton,
  colors,
  DashboardMap,
  DisclosureCard,
  Heading,
  Icon,
  IconButton,
  QrCode,
  radii,
  ScannerFrame,
  SwitchRow,
  sizes,
  spacing,
  Text,
  TextField,
} from "../../app-ui";
import { Spinner } from "./kit";
import { MEDIA } from "./media";
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

/** The seminar room on the room booking plugin's list (a generated still, src/ads/shared/media.ts). */
const SALA_PHOTO = staticFile(MEDIA.sala.file);

// The app's <Image> shows a photo only once it has loaded; loaded before rendering, it shows in the first frame.
const photoReady = delayRender("Loading the sample photo");
void Promise.all([Image.prefetch(LAMP_PHOTO), Image.prefetch(SALA_PHOTO)]).then(() => continueRender(photoReady));

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
const photo = (alt: string): UINode => ({
  ...ui.image("lamp", alt),
  url: LAMP_PHOTO,
});

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

/**
 * Widget of the issues plugin (plugins/issues): the open issue most residents back, „Zgłoś problem” and
 * „Sugestia”, the counts in the header. With the lamp fixed, the pothole leads.
 */
export const issuesWidget = (support: number, status: Status = "open") =>
  ui.widget(
    "Zgłoszenia i sugestie",
    [
      status === "fixed"
        ? ui.highlight({ eyebrow: "Najczęściej podbijane", title: "Dziura w chodniku przy szkole", votes: 2 })
        : ui.highlight({
            eyebrow: "Najczęściej podbijane",
            title: ISSUE.title,
            votes: support,
            image: { file: "lamp", alt: `Zdjęcie: ${ISSUE.title}`, url: LAMP_PHOTO },
          }),
      ui.row(
        [
          ui.button("Zgłoś problem", ui.navigate("new"), "primary", "camera"),
          ui.button("Sugestia", ui.navigate("new", { kind: "suggestion" }), "quiet", "idea"),
        ],
        { grow: true },
      ),
    ],
    {
      icon: "megaphone",
      subtitle:
        status === "fixed" ? "2 otwarte · 1 w realizacji" : `3 otwarte · ${status === "accepted" ? 2 : 1} w realizacji`,
      link: { label: "Wszystkie", action: ui.navigate("list") },
      onPress: ui.navigate("list"),
    },
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
    { onPress: ui.navigate("list") },
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
    <IconButton icon={ChevronLeft} label={t.back} variant="square" onPress={nothing} />
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
              ? {
                  height: TILE * arrive,
                  opacity: arrive,
                  transform: [{ scale: 0.9 + arrive * 0.1 }],
                }
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
export const PreviewScreen = ({
  place = "Kraków",
  address = "pl. Wszystkich Świętych 3-4, 31-004 Kraków",
  code = "KRK-MST",
}: {
  place?: string;
  address?: string;
  code?: string;
}) => (
  <AppScreen>
    <View style={styles.map}>
      <DashboardMap />
    </View>
    <View style={styles.details}>
      <Heading level={1} variant="heading">
        {place}
      </Heading>
      {address ? (
        <Text variant="body" color="textSecondary">
          {address}
        </Text>
      ) : null}
    </View>
    <Card>
      <View style={styles.codeRow}>
        <Text variant="body" color="textSecondary">
          {t.place_preview_code}
        </Text>
        <Text variant="codeM">{code}</Text>
      </View>
    </Card>
    <Checkbox checked={false} onChange={nothing} label={t.place_preview_default} />
    <View style={styles.grow} />
    <Button label={t.place_preview_join} onPress={nothing} />
  </AppScreen>
);

const CATEGORIES = ["Oświetlenie", "Drogi i chodniki", "Zieleń", "Czystość", "Inne"];
const KINDS = [
  { label: "Problem", icon: AlertTriangle },
  { label: "Sugestia", icon: Lightbulb },
];

/** An empty photo slot of the form's picker (the renderer's AddPhotoTile). */
const AddPhotoTile = ({ icon, label }: { icon: typeof Camera; label: string }) => (
  <View style={styles.addTile}>
    <Icon icon={icon} size={sizes.iconS} color="primary" strokeWidth={2} />
    <Text variant="small" color="textSecondary">
      {label}
    </Text>
  </View>
);

/**
 * „Nowe zgłoszenie”, laid out as the renderer draws the issues plugin's form (Renderer.tsx: PluginForm and its
 * fields): the photo first, kind, category chips, title, description, location, anonymity. Built here so the ad
 * can show a taken photo (the renderer keeps the picker's preview in its own state).
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
    <IconButton icon={ChevronLeft} label={t.back} variant="square" onPress={nothing} />
    <View style={styles.stack}>
      <Heading level={1}>Nowe zgłoszenie</Heading>
      <View style={styles.stack}>
        <View style={styles.stackTight}>
          <Text variant="label" color="textSecondary">
            Zdjęcie (opcjonalnie)
          </Text>
          <View style={styles.photoRow}>
            {withPhoto ? (
              <View style={styles.photoTile}>
                <Image source={{ uri: LAMP_PHOTO }} style={styles.photoImage} resizeMode="cover" />
                <View style={styles.photoRemove}>
                  <Icon icon={X} size={sizes.photoRemoveIcon} color="onPrimary" strokeWidth={2.6} />
                </View>
              </View>
            ) : null}
            <AddPhotoTile icon={Camera} label={t.plugin_photo_camera} />
            <AddPhotoTile icon={GalleryIcon} label={t.plugin_photo_gallery} />
          </View>
        </View>
        <View style={styles.stackTight}>
          <Text variant="label" color="textSecondary">
            Rodzaj
          </Text>
          <View style={styles.cards}>
            {KINDS.map((k) => (
              <ChoiceButton
                key={k.label}
                icon={k.icon}
                label={k.label}
                selected={k.label === "Problem"}
                onPress={nothing}
              />
            ))}
          </View>
        </View>
        <View style={styles.stackTight}>
          <Text variant="label" color="textSecondary">
            Kategoria
          </Text>
          <View style={styles.chips}>
            {CATEGORIES.map((c) => (
              <Chip key={c} label={c} selected={c === category} onPress={nothing} />
            ))}
          </View>
        </View>
        <TextField label="Tytuł" value={title} onChangeText={nothing} />
        <TextField label="Opis" multiline value="" onChangeText={nothing} />
        <View style={styles.stackTight}>
          <Text variant="label" color="textSecondary">
            Lokalizacja (opcjonalnie)
          </Text>
          <Button
            label={t.plugin_location_pick}
            variant="secondary"
            leftIcon={<Icon icon={MapPin} size={sizes.iconS} color="primary" />}
            onPress={nothing}
          />
        </View>
        <SwitchRow
          label="Zgłoś anonimowo"
          hint="Członkowie nie zobaczą Twojego imienia"
          value={false}
          onChange={nothing}
        />
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

/** Zgłoszenia, the issues plugin's list view: what residents report, with status and support. */
export const issuesListView = () =>
  ui.screen("Zgłoszenia", [
    ui.text("Usterki zgłoszone przez użytkowników: Kraków.", "soft"),
    ui.button("Nowe zgłoszenie", ui.navigate("new")),
    ui.list("Lista zgłoszeń", [
      ui.card({
        title: ISSUE.title,
        subtitle: `${ISSUE.category} · ${supporters(4)}`,
        badge: STATUS.fixed,
      }),
      ui.card({
        title: "Dziura w chodniku przy szkole",
        subtitle: `Drogi i chodniki · ${supporters(2)}`,
        badge: STATUS.accepted,
      }),
      ui.card({
        title: "Przepełniony kosz na skwerze",
        subtitle: `Czystość · ${supporters(1)}`,
        badge: STATUS.open,
      }),
    ]),
  ]);

/** Ogłoszenia, the announcements plugin's list view (a resident sees no publishing form). */
export const announcementsListView = () =>
  ui.screen("Ogłoszenia", [
    ui.list("Lista ogłoszeń", [
      ui.card({
        title: "Remont chodnika przy szkole od poniedziałku",
        onPress: ui.navigate("item"),
      }),
      ui.card({
        title: "Wymiana latarni przy przystanku zakończona",
        onPress: ui.navigate("item"),
      }),
      ui.card({
        title: "Zbiórka elektrośmieci w sobotę 10:00–14:00",
        onPress: ui.navigate("item"),
      }),
    ]),
  ]);

/** Dyskusje, the discussions plugin's list view: threads and who started them. */
export const discussionsView = () =>
  ui.screen("Dyskusje", [
    ui.list("Lista dyskusji", [
      ui.card({
        title: "Gdzie postawić nowe ławki w parku?",
        subtitle: "Marek",
        onPress: ui.navigate("thread"),
      }),
      ui.card({
        title: "Wspólne sprzątanie skweru w maju",
        subtitle: "Ola",
        onPress: ui.navigate("thread"),
      }),
      ui.card({
        title: "Parkowanie przy szkole rano",
        subtitle: "Piotr",
        onPress: ui.navigate("thread"),
      }),
    ]),
  ]);

/** The plugin the AI wrote in the ad, open: ideas for the city's budget and the vote. */
export const budgetView = () =>
  ui.screen("Budżet obywatelski", [
    ui.text("Zagłosuj na pomysły dla Twojej okolicy.", "soft"),
    ui.progress({
      label: "Nowe latarnie przy przystankach",
      value: 62,
      max: 100,
    }),
    ui.progress({
      label: "Zieleń na skwerze przy szkole",
      value: 38,
      max: 100,
    }),
    ui.progress({
      label: "Stojaki na rowery przy bibliotece",
      value: 24,
      max: 100,
    }),
    ui.button("Zagłosuj", ui.tool("vote")),
  ]);

/** The civic budget after the resident's vote: one more for the street lamps, and the plugin's thank-you toast. */
export const budgetVotedView = () =>
  ui.screen("Budżet obywatelski", [
    ui.text("Dziękujemy za głos!", "soft"),
    ui.progress({ label: "Nowe latarnie przy przystankach", value: 63, max: 100 }),
    ui.progress({ label: "Zieleń na skwerze przy szkole", value: 38, max: 100 }),
    ui.progress({ label: "Stojaki na rowery przy bibliotece", value: 24, max: 100 }),
    ui.badge("Twój głos: Nowe latarnie przy przystankach", "success"),
  ]);

const ROOMS = [
  { title: "Sala 2.14", subtitle: "30 miejsc · rzutnik · tablica" },
  { title: "Sala 3.05", subtitle: "12 miejsc · ekran do wideorozmów" },
  { title: "Aula A", subtitle: "120 miejsc · nagłośnienie" },
];

/** Rezerwacja sal (a campus's plugin): the rooms, each free or not right now. */
export const bookingListView = () =>
  ui.screen("Rezerwacja sal", [
    { ...ui.image("sala", "Sala 2.14"), url: SALA_PHOTO },
    ui.text("Wybierz salę, dzień i godzinę.", "soft"),
    ui.list(
      "Sale",
      ROOMS.map((r, i) =>
        ui.card({
          ...r,
          badge: i === 2 ? { text: "Zajęta", tone: "neutral" } : { text: "Wolna", tone: "success" },
          onPress: ui.navigate("room"),
        }),
      ),
    ),
  ]);

const TIMES = ["8:00", "10:00", "12:00", "14:00", "16:00"];

/** Booking one room: the day and the hour as chips; `time` is the picked hour (none yet: ""). */
export const bookingFormView = (time: string) =>
  ui.screen("Sala 2.14", [
    ui.text("30 miejsc · rzutnik · tablica", "soft"),
    ui.form({
      submitLabel: "Zarezerwuj",
      submit: ui.tool("book"),
      children: [
        ui.select({
          name: "day",
          label: "Dzień",
          variant: "chips",
          options: [
            { value: "today", label: "Dziś" },
            { value: "tomorrow", label: "Jutro" },
            { value: "friday", label: "Piątek" },
          ],
          value: "tomorrow",
        }),
        ui.select({
          name: "time",
          label: "Godzina",
          variant: "chips",
          options: TIMES.map((t) => ({ value: t, label: t })),
          ...(time ? { value: time } : {}),
        }),
      ],
    }),
  ]);

/** The dean's office's view: tomorrow's bookings, the new one on top. */
export const bookingScheduleView = () =>
  ui.screen("Grafik sal", [
    ui.text("Jutro", "soft"),
    ui.list("Rezerwacje", [
      ui.card({ title: "12:00 · Sala 2.14", subtitle: "Anna Nowak", badge: { text: "Nowa", tone: "info" } }),
      ui.card({ title: "10:00 · Aula A", subtitle: "Wykład: Systemy rozproszone" }),
      ui.card({ title: "14:00 · Sala 3.05", subtitle: "Koło naukowe robotyki" }),
    ]),
  ]);

/** Widget of the room booking plugin: tomorrow at a glance. */
export const bookingWidget = () =>
  ui.widget(
    "Rezerwacja sal",
    [
      ui.list("Jutro", [
        ui.card({
          title: "Sala 2.14 · 12:00",
          subtitle: "Twoja rezerwacja",
          badge: { text: "Potwierdzona", tone: "success" },
        }),
        ui.card({ title: "Aula A · 10:00", subtitle: "Wykład: Systemy rozproszone" }),
      ]),
      ui.button("Zarezerwuj salę", ui.navigate("list")),
    ],
    { onPress: ui.navigate("list") },
  );

/** Widget of a plugin the AI wrote in the ad: residents vote on ideas for the city's budget. */
export const budgetWidget = () =>
  ui.widget(
    "Budżet obywatelski",
    [
      ui.text("Zagłosuj na pomysły dla Twojej okolicy.", "soft"),
      ui.progress({
        label: "Nowe latarnie przy przystankach",
        value: 62,
        max: 100,
      }),
      ui.progress({
        label: "Zieleń na skwerze przy szkole",
        value: 38,
        max: 100,
      }),
      ui.button("Zagłosuj", ui.navigate("vote")),
    ],
    { onPress: ui.navigate("list") },
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
    description: "Ogłoszenia administratorów dla użytkowników, z podglądem nowości na pulpicie.",
  },
  {
    emoji: "💬",
    label: "Dyskusje",
    description: "Forum społeczności: dyskusje, odpowiedzi i moderacja.",
  },
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
export type Built = { icon: string; name: string; holds: string; description: string };

export const BUILT_BUDGET: Built = {
  icon: "🗳️",
  name: "Budżet obywatelski",
  holds: "2 widoki · 2 akcje · 2 tabele · 1 widżet",
  description: "Mieszkańcy głosują na pomysły dla okolicy, a wyniki widać na pulpicie miejsca.",
};

export const BUILT_BOOKING: Built = {
  icon: "📅",
  name: "Rezerwacja sal",
  holds: "3 widoki · 2 akcje · 2 tabele · 1 widżet",
  description: "Studenci rezerwują salę na wybrany dzień i godzinę, a dziekanat widzi grafik wszystkich sal.",
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
  built = BUILT_BUDGET,
}: {
  request: string;
  stage: BuildStage;
  attempt?: number;
  built?: Built;
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
              <Text variant="heading">{built.icon}</Text>
              <View style={styles.grow}>
                <Heading level={3} variant="headingS">
                  {built.name}
                </Heading>
                <Text variant="small" color="textSecondary">
                  {built.holds}
                </Text>
              </View>
              <Badge text={t.build_made_by_ai} tone="accent" />
            </View>
            <Text variant="body">{built.description}</Text>
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
  photoRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing[4] },
  photoTile: { width: sizes.photoTile, height: sizes.photoTile },
  photoImage: { width: "100%", height: "100%", borderRadius: radii.xl, overflow: "hidden" },
  photoRemove: {
    position: "absolute",
    top: -spacing[2],
    right: -spacing[2],
    width: sizes.photoRemove,
    height: sizes.photoRemove,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.text,
    borderWidth: borders.selected,
    borderColor: colors.background,
  },
  addTile: {
    width: sizes.photoTile,
    height: sizes.photoTile,
    borderRadius: radii.xl,
    borderWidth: borders.row,
    borderStyle: "dashed",
    borderColor: colors.dashed,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing[2],
  },
  cards: { flexDirection: "row", gap: spacing[4] },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing[4] },
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
  top: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing[6],
  },
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
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  tile: { height: TILE },
  scanner: {
    flex: 1,
    backgroundColor: colors.scannerBg,
    paddingTop: 62,
    paddingBottom: 60,
    paddingHorizontal: 24,
  },
  scanTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
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
  scanLine: {
    position: "absolute",
    left: 32,
    right: 32,
    height: 2,
    backgroundColor: colors.primary,
  },
  map: {
    height: sizes.dashboardMap,
    overflow: "hidden",
    borderRadius: radii["4xl"],
  },
  details: { gap: spacing[2] },
  codeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  grow: { flex: 1 },
  stack: { gap: spacing[9] },
  stackMid: { gap: spacing[5] },
  stackTight: { gap: spacing[2] },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: spacing[4],
  },
  photo: {
    width: "100%",
    aspectRatio: 4 / 3,
    borderRadius: radii["3xl"],
    backgroundColor: colors.mapBase,
  },
  progress: { flexDirection: "row", gap: spacing[3] },
  segment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
  },
  segmentOn: { backgroundColor: colors.primary },
});
