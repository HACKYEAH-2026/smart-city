import { gridRects } from "@app/app/src/lib/grid";
import { countOf, widgetsCount } from "@app/app/src/lib/plural";
import { InSheetContext } from "@app/app/src/plugins/context";
import { isFloating, PluginRenderer } from "@app/app/src/plugins/Renderer";
import { PluginScreenHeader } from "@app/app/src/plugins/ScreenHeader";
import { t } from "@app/app/src/texts";
import { DASHBOARD_COLUMNS, type UINode, ui } from "@app/plugin-sdk";
import {
  ChevronDown,
  ChevronRight,
  CircleCheck,
  Flashlight,
  Link2,
  type LucideIcon,
  Plus,
  Puzzle,
  Settings,
  Sparkles,
  Users,
  X,
} from "lucide-react-native";
import type { ReactNode } from "react";
import { Image, StyleSheet, View } from "react-native";
import Svg, { Circle, Defs, RadialGradient, Stop } from "react-native-svg";
import { continueRender, delayRender, staticFile } from "remotion";
import {
  BackButton,
  Badge,
  Button,
  borders,
  Card,
  Checkbox,
  colors,
  DashboardMap,
  gradients,
  Heading,
  Icon,
  IconBox,
  IconButton,
  layout,
  opacity,
  radii,
  ScannerFrame,
  shadows,
  sizes,
  spacing,
  Text,
  TextField,
  TitleHeader,
} from "../../app-ui";
import { Spinner } from "./kit";
import { MEDIA } from "./media";
import { AppScreen, SCREEN } from "./Phone";

/**
 * The app's screens as the ads show them, built like the app builds them today: plugin views are `ui.*` trees in the
 * shape the plugins return (plugins/issues, plugins/announcements, plugins/discussions), drawn by the app's own
 * renderer under its own header (PluginScreenHeader); the platform screens (dashboard, scanner, place preview,
 * "Zarządzaj miejscem", "Rozszerzenie z AI") are laid out as in apps/app/src/screens from the same components. The
 * civic budget and the room booking are plugins a place could add (written by the AI builder), drawn the same way.
 */

const nothing = () => {};
const noUpload = () => Promise.reject(new Error("The ad uploads nothing"));

/** Photos in the app: the ads' generated stills (src/ads/shared/media.ts). */
const PHOTO = {
  lamp: staticFile(MEDIA.latarnia.file),
  lampOn: staticFile(MEDIA["latarnia-on"].file),
  sidewalk: staticFile(MEDIA.chodnik.file),
  playground: staticFile(MEDIA["plac-zabaw"].file),
  benches: staticFile(MEDIA.lawki.file),
  room: staticFile(MEDIA.sala.file),
  poster: staticFile(MEDIA["kamera-qr"].file),
  cityAtNight: staticFile(MEDIA["miasto-noc"].file),
  mural: staticFile(MEDIA.mural.file),
};
type PhotoId = keyof typeof PHOTO;

// The app's <Image> shows a photo only once it has loaded; loaded before rendering, it shows in the first frame.
const photosReady = delayRender("Loading the app's photos");
void Promise.all(Object.values(PHOTO).map((uri) => Image.prefetch(uri))).then(() => continueRender(photosReady));

/** A photo as a plugin view carries it: the host has signed its `url`. */
const photo = (id: PhotoId, alt: string) => ({ file: id, alt, url: PHOTO[id] });

const DAY = 86_400_000;
/** An ISO time `days` ago; the app shows it relative ("3 dni temu"). */
const ago = (days: number) => new Date(Date.now() - days * DAY).toISOString();

const plural = (n: number, one: string, few: string, many: string) => {
  const tens = n % 100;
  const units = n % 10;
  return n === 1 ? one : units >= 2 && units <= 4 && (tens < 12 || tens > 14) ? few : many;
};
/** "1 głos", "3 głosy", "17 głosów" (the issues plugin's wording). */
export const votesText = (n: number) => `${n} ${plural(n, "głos", "głosy", "głosów")}`;

/** A plugin view rendered by the app's renderer. */
const Plugin = ({ node }: { node: UINode }) => (
  <PluginRenderer node={node} onAction={nothing} busy={false} upload={noUpload} />
);

/* ── Plugin views ─────────────────────────────────────────────────────────────────────────────────────── */

export type Issue = { title: string; description: string; photo: PhotoId; place: string; reporter: string };

/** The report the city's ad follows (a lamp at a bus stop in Kraków). */
export const ISSUE: Issue = {
  title: "Nie świeci latarnia przy przystanku",
  description: "Latarnia przy przystanku nie świeci od tygodnia. Wieczorem jest tu zupełnie ciemno.",
  photo: "lamp",
  place: "ul. Witosa 12, 30-612 Kraków",
  reporter: "Marek Zieliński",
};

/** The housing cooperative's report: the same lamp, between its blocks of flats. */
export const COOP_ISSUE: Issue = {
  title: "Nie świeci latarnia przy bloku 12",
  description: "Latarnia między blokiem 12 a przystankiem nie świeci od tygodnia. Wieczorem jest tu zupełnie ciemno.",
  photo: "lamp",
  place: "ul. Słoneczna 12, Kraków",
  reporter: "Ewa Dąbrowska",
};

/** Votes the report has when the viewer's report joins it (then one more). */
export const REPORTERS = 16;

const OTHER_ISSUES = [
  { title: "Dziura w chodniku przy szkole", votes: 9, photo: "sidewalk" as PhotoId, days: 3 },
  { title: "Przepełniony kosz na skwerze", votes: 4, days: 5 },
  { title: "Zniszczona ławka w parku", votes: 2, days: 8 },
];

const STATUS = ["open", "accepted", "fixed"] as const;
export type Status = (typeof STATUS)[number];

/**
 * Widget of the issues plugin: the reports with the most votes, „Zgłoś problem”, how many are active. With the lamp
 * fixed, it is off the list.
 */
export const issuesWidget = (votes: number, status: Status = "open", issue: Issue = ISSUE) => {
  const rows = [...(status === "fixed" ? [] : [{ title: issue.title, votes }]), ...OTHER_ISSUES].slice(0, 3);
  const active = status === "fixed" ? 9 : 10;
  return ui.widget(
    "Zgłoszenia",
    [
      ui.list(
        "Najpopularniejsze zgłoszenia",
        rows.map((r) =>
          ui.card({
            title: r.title,
            counter: { label: votesText(r.votes), value: r.votes },
            onPress: ui.navigate("detail"),
          }),
        ),
      ),
      ui.button("Zgłoś problem", ui.navigate("new"), "ink", "camera"),
    ],
    {
      icon: "megaphone",
      link: { label: plural(active, "aktywne", "aktywne", "aktywnych"), count: active, action: ui.navigate("list") },
      onPress: ui.navigate("list"),
    },
  );
};

/** Widget of the announcements plugin: the two newest since the last visit. */
export const announcementsWidget = (title: string, next = "Zbiórka elektrośmieci w sobotę 10:00–14:00") =>
  ui.widget(
    "Ogłoszenia",
    [
      ui.card({ title, onPress: ui.navigate("item") }),
      ui.card({ title: next, onPress: ui.navigate("item") }),
      ui.button("Wszystkie ogłoszenia", ui.navigate("list"), "quiet"),
    ],
    { subtitle: "2 nowe ogłoszenia od Twojej ostatniej wizyty", onPress: ui.navigate("list") },
  );

/** Widget of the discussions plugin: the latest activity. */
export const discussionsWidget = () =>
  ui.widget(
    "Dyskusje",
    [
      ui.list("Ostatnia aktywność", [
        ui.activity({
          title: "Sprzątanie skweru w sobotę",
          text: "Ola: Przyniosę rękawice i worki",
          person: "Ola Wiśniewska",
          at: ago(0.02),
          unread: true,
        }),
        ui.activity({
          title: "Gdzie postawić nowe ławki?",
          text: "Marek: Przy placu zabaw brakuje cienia",
          person: "Marek Zieliński",
          at: ago(0.1),
          unread: true,
        }),
        ui.activity({
          title: "Parkowanie przy szkole rano",
          text: "Piotr: Może strefa kiss & ride?",
          person: "Piotr Nowak",
          at: ago(1),
        }),
      ]),
      ui.button("Nowa dyskusja", ui.navigate("new"), "quiet", "plus"),
    ],
    { icon: "chat", subtitle: "2 z nowymi wpisami", link: { label: "Wszystkie", action: ui.navigate("list") } },
  );

/** A report as a card of the plugin's list: photo, when, the vote pill. */
export const issueCard = (issue: Issue, votes: number, pressed = false) =>
  ui.card({
    title: issue.title,
    image: photo(issue.photo, "Zdjęcie zgłoszenia"),
    meta: [{ at: ago(6) }, { text: "4", icon: "chat", label: "Komentarze: 4" }],
    counter: { label: `Podbij zgłoszenie, ${votesText(votes)}`, value: votes, pressed, action: ui.tool("vote") },
    onPress: ui.navigate("detail"),
  });

/** The report as a card on its own (the problems ad's side by side). */
export const IssueCard = ({ support }: { support: number }) => <Plugin node={issueCard(ISSUE, support)} />;

/** Zgłoszenia, the issues plugin's list: most votes first, the viewer's own, and „Zgłoś”. */
export const issuesListView = () =>
  ui.screen(
    "Zgłoszenia",
    [
      ui.tabs({
        label: "Sortowanie",
        variant: "segmented",
        options: ["Popularne", "Najnowsze", "Moje"].map((label, i) => ({
          label,
          selected: i === 0,
          action: ui.navigate("list", { tab: label }, { replace: true }),
        })),
      }),
      ui.list("Lista zgłoszeń", [
        issueCard(ISSUE, REPORTERS),
        ...OTHER_ISSUES.map((o) =>
          ui.card({
            title: o.title,
            ...(o.photo ? { image: photo(o.photo, "Zdjęcie zgłoszenia") } : {}),
            meta: [{ at: ago(o.days) }],
            counter: { label: votesText(o.votes), value: o.votes, action: ui.tool("vote") },
            onPress: ui.navigate("detail"),
          }),
        ),
      ]),
      ui.fab({ label: "Zgłoś", icon: "plus", action: ui.navigate("new") }),
    ],
    { eyebrow: "Kraków" },
  );

/** Step 1 of a report: up to 3 photos, „Dalej” and „Pomiń zdjęcie” at the bottom. */
export const issuePhotoView = (withPhoto: boolean) =>
  ui.screen(
    "Zrób zdjęcie",
    [
      ui.form({
        submitLabel: "Dalej",
        submit: ui.tool("photos"),
        children: [
          ui.imagePicker({
            name: "photos",
            label: "Pokaż problem z bliska — do 3 zdjęć",
            max: 3,
            ...(withPhoto ? { value: [photo("lamp", "Zdjęcie zgłoszenia")] } : {}),
          }),
        ],
      }),
      ui.button("Pomiń zdjęcie", ui.navigate("form"), "quiet"),
    ],
    { eyebrow: "Nowe zgłoszenie", back: ui.navigate("list") },
  );

/** Step 2 of a report: the photo from step 1, the title (as typed so far), the description, the place. */
export const issueFormView = (title: string, issue: Issue = ISSUE) =>
  ui.screen(
    "Nowe zgłoszenie",
    [
      ui.form({
        submitLabel: "Wyślij zgłoszenie",
        submitIcon: "send",
        submit: ui.tool("report"),
        children: [
          ui.imagePicker({
            name: "photos",
            label: "Zdjęcia",
            hideLabel: true,
            max: 3,
            value: [photo(issue.photo, "Zdjęcie zgłoszenia")],
          }),
          ui.textInput({ name: "title", label: "Tytuł", ...(title ? { value: title } : {}) }),
          ui.textInput({
            name: "description",
            label: "Opis",
            multiline: true,
            placeholder: "Opisz, co się dzieje i od kiedy.",
          }),
          // Without a value: a picked place shows a live map preview, which needs the network.
          ui.locationInput({ name: "location", label: "Lokalizacja" }),
        ],
      }),
    ],
    { back: ui.navigate("new") },
  );

/** The report form as the app shows it; a new tree per typed letter (the renderer's form reads it when it mounts). */
export const IssueFormScreen = ({ title, issue = ISSUE }: { title: string; issue?: Issue }) => (
  <PluginScreen key={title} node={issueFormView(title, issue)} />
);

/** „Czy to ten sam problem?”: the AI found the report already in, as a sheet over the form. */
export const mergeView = (issue: Issue = ISSUE, votes = REPORTERS) =>
  ui.screen(
    "Czy to ten sam problem?",
    [
      ui.text("Ktoś zgłosił już coś podobnego w tym miejscu. Dołącz, a Twój głos podbije zgłoszenie.", "soft"),
      ui.card({
        title: issue.title,
        image: photo(issue.photo, "Zdjęcie zgłoszenia"),
        meta: [{ at: ago(6) }, { text: "40 m stąd" }],
        counter: { label: votesText(votes), value: votes },
      }),
      ui.button("Tak, dołącz i podbij", ui.tool("join"), "primary", "arrowUp"),
      ui.button("Nie, to inny problem", ui.tool("report"), "quiet"),
    ],
    { eyebrow: "Wykryliśmy podobne zgłoszenie", back: ui.navigate("list") },
  );

/** After joining, in the same sheet: the report's votes now. */
export const joinedView = (votes: number) =>
  ui.screen(
    "Dołączono i podbito",
    [
      ui.text(`Zgłoszenie ma teraz ${votesText(votes)}. Powiadomimy Cię o zmianach.`),
      ui.button("Zobacz zgłoszenie", ui.navigate("detail")),
      ui.button("Wróć do pulpitu", ui.app("dashboard"), "quiet"),
    ],
    { back: ui.navigate("list") },
  );

/** A report's page: the photo, who and when, the vote, the history; an admin handles it from the header. */
export const detailView = ({
  support,
  status,
  admin,
  issue = ISSUE,
}: {
  support: number;
  status: Status;
  admin: boolean;
  issue?: Issue;
}) =>
  ui.screen(
    issue.title,
    [
      ui.gallery([photo(issue.photo, "Zdjęcie zgłoszenia")]),
      ...(status === "fixed" ? [ui.tags([{ text: "Zamknięte", tone: "neutral", dot: true }])] : []),
      ui.meta([{ text: issue.reporter }, { at: ago(6) }]),
      ui.text(issue.description),
      ui.place(issue.place),
      ...(status === "fixed"
        ? []
        : [
            ui.row(
              [
                ui.button(`${admin ? "Podbij" : "Podbite"} ${support}`, ui.tool("vote"), undefined, "arrowUp", {
                  pressed: !admin,
                }),
                ui.share("Udostępnij", "/app/c/krakow/issues/detail"),
              ],
              { grow: true },
            ),
          ]),
      ui.heading("Historia", 3),
      ui.timeline([
        { title: "Zgłoszone", at: "25 wrz, 08:04", tone: "neutral" },
        ...(status === "open"
          ? []
          : [
              {
                title: "Odpowiedź administratora",
                at: "26 wrz",
                tone: "info" as const,
                text: "Przekazaliśmy zgłoszenie do Zarządu Dróg. Wymiana oprawy w tym tygodniu.",
              },
            ]),
        ...(status === "fixed"
          ? [{ title: "Zamknięte", at: "29 wrz", tone: "success" as const, text: "Latarnia znowu świeci." }]
          : []),
      ]),
    ],
    {
      back: ui.navigate("list"),
      ...(admin ? { actions: [{ label: "Obsłuż", icon: "shield" as const, action: ui.navigate("adminDetail") }] } : {}),
    },
  );

/** Ogłoszenia, the announcements plugin's list. */
export const announcementsListView = () =>
  ui.screen(
    "Ogłoszenia",
    [
      ui.list("Lista ogłoszeń", [
        ui.card({ title: "Remont chodnika przy szkole od poniedziałku", meta: [{ at: ago(0.2) }], unread: true }),
        ui.card({ title: "Wymiana latarni przy przystanku zakończona", meta: [{ at: ago(2) }] }),
        ui.card({ title: "Zbiórka elektrośmieci w sobotę 10:00–14:00", meta: [{ at: ago(4) }] }),
      ]),
    ],
    { eyebrow: "Kraków" },
  );

/** Dyskusje, the discussions plugin's list: threads by their latest message. */
export const discussionsView = () =>
  ui.screen(
    "Dyskusje",
    [
      ui.list("Lista dyskusji", [
        ui.activity({
          title: "Gdzie postawić nowe ławki w parku?",
          text: "Marek: Przy placu zabaw brakuje cienia",
          person: "Marek Zieliński",
          at: ago(0.05),
          unread: true,
          onPress: ui.navigate("thread"),
        }),
        ui.activity({
          title: "Wspólne sprzątanie skweru w maju",
          text: "Ola: Przyniosę rękawice i worki",
          person: "Ola Wiśniewska",
          at: ago(0.3),
          onPress: ui.navigate("thread"),
        }),
        ui.activity({
          title: "Parkowanie przy szkole rano",
          text: "Piotr: Może strefa kiss & ride?",
          person: "Piotr Nowak",
          at: ago(1),
          onPress: ui.navigate("thread"),
        }),
      ]),
      ui.fab({ label: "Nowa", icon: "plus", action: ui.navigate("new") }),
    ],
    { eyebrow: "Kraków" },
  );

/* ── The civic budget (a plugin a city could add) ─────────────────────────────────────────────────────── */

const PROJECTS: { title: string; cost: string; votes: number; photo: PhotoId }[] = [
  { title: "Nowe latarnie przy przystankach", cost: "420 tys. zł", votes: 1248, photo: "lampOn" },
  { title: "Plac zabaw na osiedlu Słonecznym", cost: "680 tys. zł", votes: 1105, photo: "playground" },
  { title: "Równy chodnik na ulicy Długiej", cost: "350 tys. zł", votes: 873, photo: "sidewalk" },
  { title: "Ławki i zieleń przy blokach", cost: "190 tys. zł", votes: 641, photo: "benches" },
];

/** The projects to vote on; with `voted`, the viewer's vote went to the first one. */
export const budgetView = (voted = false) =>
  ui.screen(
    "Budżet obywatelski",
    [
      ui.row([ui.stat("Pula", "2 mln zł"), ui.stat("Do końca", "12 dni")], { grow: true }),
      ui.list(
        "Projekty",
        PROJECTS.map((p, i) => {
          const mine = voted && i === 0;
          const votes = p.votes + (mine ? 1 : 0);
          return ui.card({
            title: p.title,
            variant: "featured",
            image: photo(p.photo, p.title),
            tags: [{ text: p.cost }],
            counter: { label: `Zagłosuj, ${votesText(votes)}`, value: votes, pressed: mine, action: ui.tool("vote") },
            onPress: ui.navigate("project"),
          });
        }),
      ),
    ],
    { eyebrow: "Kraków" },
  );

/** The budget after the resident's vote. */
export const budgetVotedView = () => budgetView(true);

/** Widget of the civic budget: the leading projects and „Zagłosuj”. */
export const budgetWidget = () =>
  ui.widget(
    "Budżet obywatelski",
    [
      ui.list(
        "Najwięcej głosów",
        PROJECTS.slice(0, 3).map((p) =>
          ui.card({
            title: p.title,
            counter: { label: votesText(p.votes), value: p.votes },
            onPress: ui.navigate("list"),
          }),
        ),
      ),
      ui.button("Zagłosuj", ui.navigate("list"), "ink", "check"),
    ],
    {
      icon: "idea",
      link: { label: "dni do końca", count: 12, action: ui.navigate("list") },
      onPress: ui.navigate("list"),
    },
  );

/* ── A calendar and a picture (plugins a place could add) ─────────────────────────────────────────────── */

const WEEK = [
  { day: "pt", date: 17 },
  { day: "sob", date: 18 },
  { day: "pon", date: 20 },
  { day: "wt", date: 21 },
];

/** Widget of a calendar: this week's days with events as date tiles, the chosen day's events under them. */
export const calendarWidget = () =>
  ui.widget(
    "Kalendarz",
    [
      ui.tabs({
        label: "Dni z wydarzeniami",
        variant: "tiles",
        options: WEEK.map((w, i) => ({
          label: w.day,
          count: w.date,
          selected: i === 0,
          action: ui.navigate("day", { date: String(w.date) }),
        })),
      }),
      ui.list("Piątek, 17 października", [
        ui.card({ title: "Dzień otwarty wydziału", meta: [{ text: "10:00" }, { text: "Aula A" }] }),
        ui.card({ title: "Spotkanie koła naukowego robotyki", meta: [{ text: "16:00" }, { text: "Sala 3.05" }] }),
        ui.card({ title: "Juwenalia: koncert na błoniach", meta: [{ text: "18:00" }] }),
      ]),
    ],
    { subtitle: "5 wydarzeń w tym tygodniu", link: { label: "Wszystkie", action: ui.navigate("list") } },
  );

/** A picture widget: only a photo on the dashboard, with the tiles' rounded corners (drawn in DashboardScreen). */
export type PhotoTile = { photo: PhotoId; alt: string };
export const photoWidget = (photo: PhotoId, alt: string): PhotoTile => ({ photo, alt });

/* ── Room booking (a plugin a campus could add) ───────────────────────────────────────────────────────── */

const DAYS = [
  { value: "today", label: "Dziś" },
  { value: "tomorrow", label: "Jutro" },
  { value: "friday", label: "Piątek" },
];
const TIMES = ["8:00", "10:00", "12:00", "14:00", "16:00", "18:00"];

/** Booking a room: its photo, free tomorrow, the day and the hour; „Zarezerwuj” at the bottom. */
export const bookingFormView = (time: string) =>
  ui.screen(
    "Sala 2.14",
    [
      ui.gallery([photo("room", "Sala 2.14")]),
      ui.tags([{ text: "Wolna jutro", tone: "success", dot: true }]),
      ui.meta([{ text: "30 miejsc", icon: "people", label: "30 miejsc" }, { text: "rzutnik · tablica" }]),
      ui.form({
        submitLabel: "Zarezerwuj",
        submitIcon: "check",
        submit: ui.tool("book"),
        children: [
          ui.select({ name: "day", label: "Dzień", variant: "segmented", options: DAYS, value: "tomorrow" }),
          ui.select({
            name: "time",
            label: "Godzina",
            variant: "chips",
            options: TIMES.map((value) => ({ value, label: value })),
            ...(time ? { value: time } : {}),
          }),
        ],
      }),
    ],
    { eyebrow: "Rezerwacja sal" },
  );

/** The booking went in: the room, when, and that the dean's office sees it. */
export const bookingDoneView = () =>
  ui.screen(
    "Zarezerwowano",
    [
      ui.hero({ title: "Sala 2.14 jest Twoja", text: "Jutro, 12:00–14:00. Dziekanat widzi rezerwację w grafiku sal." }),
      ui.card({ title: "Sala 2.14 · jutro 12:00", variant: "compact", image: photo("room", "Sala 2.14") }),
      ui.button("Wróć do pulpitu", ui.app("dashboard"), "quiet"),
    ],
    { chrome: false },
  );

/** The dean's office's view: tomorrow's bookings, the new one on top. */
export const bookingScheduleView = () =>
  ui.screen(
    "Grafik sal",
    [
      ui.tabs({
        label: "Dzień",
        variant: "segmented",
        options: DAYS.map((d) => ({
          label: d.label,
          selected: d.value === "tomorrow",
          action: ui.navigate("schedule"),
        })),
      }),
      ui.list("Rezerwacje", [
        ui.card({
          title: "Sala 2.14",
          meta: [{ text: "12:00–14:00" }, { text: "Anna Nowak" }],
          tags: [{ text: "Nowa", tone: "info", dot: true }],
          unread: true,
        }),
        ui.card({ title: "Aula A", meta: [{ text: "10:00–11:30" }, { text: "Wykład: Systemy rozproszone" }] }),
        ui.card({ title: "Sala 3.05", meta: [{ text: "14:00–15:30" }, { text: "Koło naukowe robotyki" }] }),
        ui.card({ title: "Sala 1.08", meta: [{ text: "16:00–17:30" }, { text: "Konsultacje: dr Kowalska" }] }),
      ]),
    ],
    { eyebrow: "Dziekanat" },
  );

/** Widget of the room booking: tomorrow at a glance. */
export const bookingWidget = () =>
  ui.widget(
    "Rezerwacja sal",
    [
      ui.list("Jutro", [
        ui.card({ title: "Sala 2.14 · 12:00", tags: [{ text: "Twoja", tone: "success", dot: true }] }),
        ui.card({ title: "Aula A · 10:00", meta: [{ text: "Wykład" }] }),
      ]),
      ui.button("Zarezerwuj salę", ui.navigate("list"), "ink", "plus"),
    ],
    { icon: "people", subtitle: "Jutro: 4 rezerwacje", link: { label: "Grafik", action: ui.navigate("schedule") } },
  );

/* ── Plugin screen ────────────────────────────────────────────────────────────────────────────────────── */

type ScreenNode = Extract<UINode, { type: "Screen" }>;
const screenOf = (node: UINode): ScreenNode => {
  if (node.type !== "Screen") throw new Error(`A plugin screen needs a Screen node, got ${node.type}`);
  return node;
};

/** A view's first Gallery across the full width at the top, under a white back chevron (PluginView: LeadGallery). */
const LeadPhoto = ({ node }: { node: Extract<UINode, { type: "Gallery" }> }) => {
  const top = SCREEN.top + layout.screenTopOffset;
  return (
    <View style={[styles.bleed, { marginTop: -top }]}>
      <Image source={{ uri: node.items[0]?.url }} style={styles.leadPhoto} resizeMode="cover" />
      <View style={[styles.floatingBack, { top }]}>
        <BackButton onPress={nothing} color="onPrimary" />
      </View>
    </View>
  );
};

/** A plugin view as a bottom sheet over the screen (PluginSheet): `open` 0 → 1 slides it up over a scrim. */
const Sheet = ({ node, open }: { node: UINode; open: number }) => {
  const sheet = screenOf(node);
  return (
    <View style={StyleSheet.absoluteFill}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.text, opacity: open * opacity.pluginScrim }]} />
      <View style={[styles.sheet, { transform: [{ translateY: (1 - open) * SCREEN.height }] }]}>
        <View style={styles.handle} />
        <View style={styles.sheetContent}>
          <View style={styles.sheetHead}>
            <View style={styles.sheetTitle}>
              {sheet.eyebrow ? (
                <View style={styles.sheetEyebrow}>
                  <Icon icon={Sparkles} size={sizes.iconXs} color="primary" />
                  <Text variant="smallStrong" color="primary">
                    {sheet.eyebrow}
                  </Text>
                </View>
              ) : null}
              <Heading level={2}>{sheet.title}</Heading>
            </View>
            <IconButton icon={X} label={t.close} onPress={nothing} variant="plain" />
          </View>
          <InSheetContext.Provider value={true}>
            <Plugin node={sheet} />
          </InSheetContext.Provider>
        </View>
      </View>
    </View>
  );
};

/**
 * A tool's confirmation as components/Toast draws it: a dark bubble floating over the bottom of the screen, above a
 * floating button; `shown` 0 → 1 slides it up (the app's own component animates on its own clock).
 */
const FloatingToast = ({ text, shown, lift }: { text: string; shown: number; lift: number }) => (
  <View
    pointerEvents="none"
    style={[
      styles.toastLayer,
      {
        bottom: SCREEN.bottom + spacing[12] + lift,
        opacity: Math.min(1, shown * 1.5),
        transform: [{ translateY: (1 - shown) * 90 }],
      },
    ]}
  >
    <View role="status" style={styles.toast}>
      <Icon icon={CircleCheck} size={sizes.iconS} color="onPrimary" strokeWidth={2.2} />
      <Text variant="button" color="onPrimary" style={styles.toastText}>
        {text}
      </Text>
    </View>
  </View>
);

/**
 * A plugin view as the app shows it (screens/PluginView): a lead photo, the plugin's header, the content with its
 * closing actions at the bottom edge, floating buttons, a tool's confirmation floating over the bottom, and a view
 * open as a sheet.
 */
export const PluginScreen = ({
  node,
  scroll = 0,
  toast,
  sheet,
}: {
  node: UINode;
  scroll?: number;
  toast?: { text: string; shown: number };
  sheet?: { node: UINode; open: number };
}) => {
  const screen = screenOf(node);
  const first = screen.children[0];
  const lead = first?.type === "Gallery" ? first : undefined;
  const content = lead ? { ...screen, children: screen.children.slice(1) } : screen;
  const floating = screen.children.filter(isFloating);
  return (
    <AppScreen
      scroll={scroll}
      overlay={
        <>
          {floating.map((button) => (
            <Plugin key={button.type} node={button} />
          ))}
          {toast ? <FloatingToast {...toast} lift={floating.length ? sizes.fab + spacing[6] : 0} /> : null}
          {sheet ? <Sheet {...sheet} /> : null}
        </>
      }
    >
      {lead ? <LeadPhoto node={lead} /> : null}
      {screen.chrome === false ? null : (
        <PluginScreenHeader node={screen} backHref={lead ? null : "/app"} onAction={nothing} />
      )}
      <View style={[styles.content, lead && styles.afterLead]}>
        <Plugin node={content} />
      </View>
    </AppScreen>
  );
};

/* ── Dashboard ────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * The dashboard's backdrop as PlaceBackdrop draws it for a place without a map location: the illustration, with the
 * place's soft red glow right of centre beside its name (the app's own component needs its screen's scroll state).
 */
const DashboardBackdrop = () => {
  const pinTop = SCREEN.top + layout.screenTopOffset + sizes.dashboardPinTop;
  return (
    <View style={styles.backdrop}>
      <DashboardMap />
      <View style={[styles.glowBox, { height: 2 * pinTop }]}>
        <Svg
          style={[styles.glow, { marginTop: pinTop - sizes.dashboardGlow }]}
          width={sizes.dashboardGlow * 2}
          height={sizes.dashboardGlow * 2}
        >
          <Defs>
            <RadialGradient id="glow" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={gradients.accent[0]} stopOpacity={opacity.dashboardGlow / 3} />
              <Stop offset="1" stopColor={gradients.accent[1]} stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Circle cx="50%" cy="50%" r="50%" fill="url(#glow)" />
        </Svg>
      </View>
    </View>
  );
};

/** A dashboard tile: a plugin's widget, or a picture widget's photo. */
type Tile = UINode | PhotoTile;
const isPhoto = (tile: Tile): tile is PhotoTile => "photo" in tile;

/** The plugins' declared widget sizes (plugins/*: `size`); the discussions and calendar widgets are a row taller. */
const sizeOf = (tile: Tile) =>
  !isPhoto(tile) && tile.type === "Widget" && ["Dyskusje", "Kalendarz"].includes(tile.title)
    ? { w: 3, h: 3 }
    : { w: 3, h: 2 };

const GRID_GAP = spacing[6];

/**
 * Pulpit (screens/Dashboard): the place's backdrop, „Twoje miejsce” over its name, how many extensions it has, the
 * widgets in the grid of plugins/Dashboard, the tab bar. `arrive` 0 → 1: the first widget grows in, the others make
 * room.
 */
export const DashboardScreen = ({
  widgets,
  admin = false,
  scroll = 0,
  place = "Kraków",
  arrive = 1,
}: {
  widgets: Tile[];
  admin?: boolean;
  scroll?: number;
  place?: string;
  arrive?: number;
}) => {
  const grid = gridRects(
    widgets.map((tile) => ({ tile, size: sizeOf(tile) })),
    {
      width: SCREEN.width - 2 * layout.screenPaddingX,
      columns: DASHBOARD_COLUMNS,
      rowHeight: sizes.widgetRow,
      gap: GRID_GAP,
    },
  );
  const first = grid.tiles[0]?.rect.height ?? 0;
  const room = (1 - arrive) * (first + GRID_GAP);
  return (
    <AppScreen tabBar backdrop={<DashboardBackdrop />} scroll={scroll}>
      <View style={styles.place}>
        <Text variant="label" color="textSecondary">
          {t.place_current_label}
        </Text>
        <View style={styles.header}>
          <Heading level={1} variant="heading">
            {place}
          </Heading>
          {admin ? <IconButton icon={Settings} label={t.manage_title} variant="round" onPress={nothing} /> : null}
        </View>
      </View>
      <View style={styles.section}>
        <Text variant="small" color="textSecondary">
          {widgetsCount(widgets.length)}
        </Text>
        <View style={{ height: grid.height }}>
          {grid.tiles.map(({ item, rect }, i) => (
            <View
              // biome-ignore lint/suspicious/noArrayIndexKey: a fixed list of tiles.
              key={i}
              style={[
                styles.tile,
                rect,
                i === 0
                  ? { opacity: arrive, transform: [{ scale: 0.92 + arrive * 0.08 }] }
                  : { transform: [{ translateY: -room }] },
              ]}
            >
              {isPhoto(item.tile) ? (
                <View role="img" aria-label={item.tile.alt} style={[styles.photoTile, StyleSheet.absoluteFill]}>
                  <Image source={{ uri: PHOTO[item.tile.photo] }} style={styles.fill} resizeMode="cover" />
                </View>
              ) : (
                <Plugin node={item.tile} />
              )}
            </View>
          ))}
        </View>
      </View>
    </AppScreen>
  );
};

/* ── Joining by QR code ───────────────────────────────────────────────────────────────────────────────── */

/** The poster's QR code in the camera still (MEDIA["kamera-qr"], 1920×1080): its centre and width in pixels. */
const POSTER_QR = { x: 733, y: 385, width: 150 };
/** The camera still scaled so the code fills most of the scanner's frame, centred in it. */
const CAMERA = (() => {
  const scale = (sizes.scannerFrame * 0.62) / POSTER_QR.width;
  return {
    width: 1920 * scale,
    height: 1080 * scale,
    left: SCREEN.width / 2 - POSTER_QR.x * scale,
    top: SCREEN.height / 2 - POSTER_QR.y * scale,
  };
})();

/**
 * The camera scanner (screens/ScanQr): the camera's view (the campus poster from the ad's clip, its QR code in the
 * frame), the dimmed edges, the frame and its scan line; `seen` 0 → 1 brings the picture into focus.
 */
export const ScannerScreen = ({ seen, line }: { seen: number; line: number }) => (
  <View style={styles.scanner}>
    <Image
      source={{ uri: PHOTO.poster }}
      style={[styles.camera, CAMERA, { opacity: 0.55 + seen * 0.45 }]}
      resizeMode="cover"
    />
    <View style={[StyleSheet.absoluteFill, styles.dimmer]} />
    <View style={[StyleSheet.absoluteFill, styles.scanMiddle]}>
      <ScannerFrame>
        <View style={[styles.scanLine, { top: 32 + line * (sizes.scannerFrame - 64) }]} />
      </ScannerFrame>
    </View>
    <View style={[StyleSheet.absoluteFill, styles.scanLayer]}>
      <View style={styles.scanTop}>
        <IconButton variant="roundOnDark" icon={X} label={t.close} onPress={nothing} />
        <Text variant="labelL" color="scannerText">
          {t.scan_title}
        </Text>
        <IconButton variant="roundOnDark" icon={Flashlight} label={t.scan_torch} onPress={nothing} />
      </View>
      <View style={styles.scanBottom}>
        <Text variant="bodyL" color="scannerText" style={styles.hint}>
          {t.scan_hint}
        </Text>
        <Button label={t.scan_enter_code} variant="ghostOnDark" disabled onPress={nothing} />
      </View>
    </View>
  </View>
);

/** Podgląd miejsca after the scan (screens/PlacePreview): the place, its code and „Dołącz do miejsca”. */
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
    <BackButton onPress={nothing} />
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

/* ── The admin's screens ──────────────────────────────────────────────────────────────────────────────── */

const PLUGINS = [
  { icon: "🛠️", name: "Zgłoszenia", subtitle: "1 rozszerzenie · Zgłaszanie usterek ze zdjęciem" },
  { icon: "📢", name: "Ogłoszenia", subtitle: "1 rozszerzenie · Ogłoszenia dla mieszkańców" },
  { icon: "💬", name: "Dyskusje", subtitle: "1 rozszerzenie · Rozmowy społeczności" },
];

/**
 * A section of „Zarządzaj miejscem” as DisclosureCard draws it, open or closed and at rest: the app's component
 * unfolds with a measured, timed animation that a frame-by-frame render cannot follow.
 */
const Section = ({
  icon,
  title,
  summary,
  children,
}: {
  icon: LucideIcon;
  title: string;
  summary: string;
  children?: ReactNode;
}) => {
  const open = children !== undefined;
  return (
    <View style={[styles.card, open && styles.cardOpen]}>
      <View style={styles.cardHead}>
        <IconBox icon={icon} selected={open} neutral={!open} />
        <View style={styles.rowText}>
          <Text variant="cardTitle">{title}</Text>
          <Text variant="small" color="textSecondary">
            {summary}
          </Text>
        </View>
        <View style={[styles.chevron, open && styles.chevronOpen]}>
          <View style={open ? styles.turned : undefined}>
            <Icon icon={ChevronDown} size={sizes.iconS} color={open ? "text" : "textSecondary"} />
          </View>
        </View>
      </View>
      {open ? <View style={styles.cardBody}>{children}</View> : null}
    </View>
  );
};

/** Zarządzaj miejscem (screens/ManagePlace) with „Rozszerzenia” open: the plugins that are on, „Dodaj rozszerzenie”. */
export const ManageScreen = ({ place = "Kraków" }: { place?: string }) => (
  <AppScreen>
    <TitleHeader eyebrow={place} title={t.manage_title} onBack={nothing} />
    <View style={styles.sections}>
      <Section
        icon={Link2}
        title={t.manage_invites_title}
        summary={`${t.manage_invites_code} KRK-MST · ${t.manage_invites_rest}`}
      />
      <Section
        icon={Puzzle}
        title={t.manage_plugins_title}
        summary={`${countOf(PLUGINS.length, t.count_plugins)} · ${PLUGINS.map((p) => p.name).join(", ")}`}
      >
        {PLUGINS.map((p) => (
          <View key={p.name} style={styles.pluginRow}>
            <IconBox icon={p.icon} size="sm" neutral />
            <View style={styles.rowText}>
              <Text variant="rowTitle" numberOfLines={1}>
                {p.name}
              </Text>
              <Text variant="small" color="textSecondary" numberOfLines={1}>
                {p.subtitle}
              </Text>
            </View>
            <Icon icon={ChevronRight} size={sizes.iconS} color="iconMuted" strokeWidth={2} />
          </View>
        ))}
        <View style={styles.pluginAdd}>
          <Button
            label={t.add_plugin_title}
            size="sm"
            leftIcon={<Icon icon={Plus} size={sizes.iconS} color="onPrimary" strokeWidth={2.4} />}
            onPress={nothing}
          />
        </View>
      </Section>
      <Section
        icon={Users}
        title={t.manage_members_title}
        summary={`${countOf(1284, t.count_people)} · ${countOf(3, t.count_admins)}`}
      />
      <Section icon={Settings} title={t.manage_settings_title} summary={t.manage_settings_summary} />
    </View>
  </AppScreen>
);

/** What the AI built, as the builder's outline card shows it. */
export type Built = { icon: string; name: string; holds: string; description: string };

export const BUILT_BUDGET: Built = {
  icon: "🗳️",
  name: "Budżet obywatelski",
  holds: "2 widoki · 2 akcje · 2 tabele · 1 widżet",
  description: "Mieszkańcy głosują na projekty dla okolicy, a wyniki widać na pulpicie miejsca.",
};

export const BUILT_BOOKING: Built = {
  icon: "📅",
  name: "Rezerwacja sal",
  holds: "3 widoki · 2 akcje · 2 tabele · 1 widżet",
  description: "Studenci rezerwują salę na wybrany dzień i godzinę, a dziekanat widzi grafik wszystkich sal.",
};

export type BuildStage = "typing" | "working" | "ready" | "published";

/**
 * Rozszerzenie z AI (screens/BuildPlugin): the request written at the bottom; then the request as a bubble, the AI
 * writing and checking (`attempt`), the plugin it built and „Opublikuj” at the bottom.
 */
export const BuildScreen = ({
  request,
  stage,
  attempt = 0,
  built = BUILT_BUDGET,
  place = "Kraków",
}: {
  request: string;
  stage: BuildStage;
  attempt?: number;
  built?: Built;
  place?: string;
}) => (
  <AppScreen>
    <TitleHeader eyebrow={place} title={t.build_title} onBack={nothing} />
    {stage === "typing" ? (
      <>
        <Text variant="bodyL" color="textSecondary">
          {t.build_lead}
        </Text>
        <View style={styles.grow} />
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
        <View style={styles.version}>
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
                <Text variant="cardTitle">
                  {attempt > 0 ? `${t.build_working_attempt} ${attempt}` : t.build_working}
                </Text>
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
        </View>
        <View style={styles.grow} />
        {stage === "ready" ? (
          <View style={styles.version}>
            <Text variant="bodyL" color="textSecondary">
              {t.build_draft_note}
            </Text>
            <Button label={t.build_publish} onPress={nothing} />
          </View>
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
  content: { flexGrow: 1 },
  afterLead: { paddingTop: spacing[2] },
  bleed: { marginHorizontal: -layout.screenPaddingX },
  leadPhoto: { width: "100%", aspectRatio: 4 / 3, backgroundColor: colors.mapBase },
  floatingBack: { position: "absolute", left: layout.screenPaddingX },
  toastLayer: { position: "absolute", left: layout.screenPaddingX, right: layout.screenPaddingX, alignItems: "center" },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[4],
    minHeight: sizes.fab,
    paddingHorizontal: spacing[9],
    paddingVertical: spacing[5],
    borderRadius: radii.pill,
    backgroundColor: colors.text,
    ...shadows.floating,
  },
  toastText: { flexShrink: 1 },
  photoTile: { borderRadius: radii["3xl"], overflow: "hidden", backgroundColor: colors.mapBase, ...shadows.card },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.background,
    borderTopLeftRadius: radii.sheet,
    borderTopRightRadius: radii.sheet,
    paddingBottom: SCREEN.bottom,
  },
  handle: {
    alignSelf: "center",
    marginTop: spacing[4],
    width: sizes.sheetHandleWidth,
    height: sizes.sheetHandleHeight,
    borderRadius: radii.pill,
    backgroundColor: colors.dashed,
  },
  sheetContent: { paddingTop: spacing[4], paddingHorizontal: spacing[10], paddingBottom: spacing[12], gap: spacing[9] },
  sheetHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing[6] },
  sheetTitle: { flex: 1, gap: spacing[1] },
  sheetEyebrow: { flexDirection: "row", alignItems: "center", gap: spacing[3] },
  place: { gap: spacing[4] },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing[6] },
  section: { gap: spacing[6] },
  tile: { position: "absolute" },
  backdrop: { height: sizes.dashboardMap, overflow: "hidden", top: -sizes.dashboardMapLift },
  glowBox: { position: "absolute", top: 0, left: 0, width: `${200 * sizes.dashboardPinX}%` },
  glow: { alignSelf: "center" },
  scanner: { flex: 1, backgroundColor: colors.scannerBg },
  camera: { position: "absolute" },
  dimmer: { backgroundColor: colors.scannerBg, opacity: opacity.scrim * 0.6 },
  scanMiddle: { alignItems: "center", justifyContent: "center" },
  scanLayer: {
    justifyContent: "space-between",
    paddingTop: SCREEN.top + layout.screenTopOffset,
    paddingBottom: SCREEN.bottom + layout.screenBottomPadding,
    paddingHorizontal: layout.screenPaddingX,
  },
  scanTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  scanBottom: { alignItems: "center", gap: spacing[8] },
  hint: { maxWidth: sizes.scannerHint, textAlign: "center" },
  scanLine: { position: "absolute", left: 32, right: 32, height: 2, backgroundColor: colors.primary },
  map: { height: sizes.dashboardMap, overflow: "hidden", borderRadius: radii["4xl"] },
  details: { gap: spacing[2] },
  codeRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  grow: { flex: 1, gap: spacing[1] },
  fill: { width: "100%", height: "100%" },
  sections: { gap: spacing[7] },
  pluginRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[6],
    paddingVertical: spacing[6],
    paddingHorizontal: spacing[8],
    borderBottomWidth: borders.hairline,
    borderBottomColor: colors.divider,
  },
  rowText: { flex: 1, gap: spacing[1] },
  card: { backgroundColor: colors.surface, borderRadius: radii["3xl"], ...shadows.card },
  cardOpen: shadows.cardRaised,
  cardHead: { flexDirection: "row", alignItems: "center", gap: spacing[7], padding: spacing[8] },
  cardBody: { borderTopWidth: borders.hairline, borderTopColor: colors.borderSubtle },
  chevron: {
    width: sizes.iconButton,
    height: sizes.iconButton,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  chevronOpen: { backgroundColor: colors.surfaceSunken },
  turned: { transform: [{ rotate: "180deg" }] },
  pluginAdd: { paddingTop: spacing[6], paddingHorizontal: spacing[8], paddingBottom: spacing[8] },
  version: { gap: spacing[5] },
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
});
