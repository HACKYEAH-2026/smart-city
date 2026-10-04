import { gridRects } from "@app/app/src/lib/grid";
import { widgetsCount } from "@app/app/src/lib/plural";
import { PluginRenderer } from "@app/app/src/plugins/Renderer";
import { t } from "@app/app/src/texts";
import { DASHBOARD_COLUMNS, type UINode, ui } from "@app/plugin-sdk";
import { StyleSheet, View } from "react-native";
import Svg, { Circle, Defs, RadialGradient, Stop } from "react-native-svg";
import { colors, DashboardMap, gradients, Heading, layout, opacity, radii, sizes, spacing, Text } from "../../app-ui";
import { AppScreen, SCREEN } from "../shared/Phone";

/**
 * Screens only this cut shows: the room booking's widget with its week of dates (the plugin the AI builds in the
 * builder scene), and a dashboard whose tiles say their own size (shared/screens.tsx sizes tiles by title), so that
 * widget can be three rows tall, arrive on top and light up when a booking comes in.
 */

const nothing = () => {};
const noUpload = () => Promise.reject(new Error("The ad uploads nothing"));

const WEEK = [
  { day: "pon", date: 20 },
  { day: "wt", date: 21 },
  { day: "śr", date: 22 },
  { day: "czw", date: 23 },
];

const NEW_BOOKING = ui.card({
  title: "Sala 3.05 · 14:00",
  meta: [{ text: "Koło naukowe robotyki" }, { text: "przed chwilą" }],
});

const BOOKINGS = [
  ui.card({ title: "Sala 2.14 · 12:00", meta: [{ text: "Anna Nowak" }] }),
  ui.card({ title: "Aula A · 10:00", meta: [{ text: "Wykład: Systemy rozproszone" }] }),
];

/**
 * Widget of the room booking the AI wrote: this week's dates and the chosen day's latest bookings; with `live`, one
 * someone has just made is on top.
 */
export const bookingCalendarWidget = (live: boolean) =>
  ui.widget(
    "Rezerwacja sal",
    [
      ui.tabs({
        label: "Dni",
        variant: "tiles",
        options: WEEK.map((w, i) => ({
          label: w.day,
          count: w.date,
          selected: i === 0,
          action: ui.navigate("day", { date: String(w.date) }),
        })),
      }),
      ui.list("Poniedziałek, 20 października", (live ? [NEW_BOOKING, ...BOOKINGS] : BOOKINGS).slice(0, 2)),
    ],
    {
      icon: "people",
      subtitle: live ? "W poniedziałek 5 rezerwacji" : "W poniedziałek 4 rezerwacje",
      link: { label: "Grafik", action: ui.navigate("schedule") },
    },
  );

/** A dashboard tile: a plugin's widget and its size in the grid's columns and rows (plugins declare it). */
export type Tile = { node: UINode; w: number; h: number };

/** The dashboard's backdrop as shared/screens.tsx draws it: the illustration and the place's glow by its name. */
const Backdrop = () => {
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

const GRID_GAP = spacing[6];
const RING = { position: "absolute", inset: 0, borderRadius: radii["3xl"], pointerEvents: "none" } as const;
/** An opacity as the two hex digits of an #RRGGBBAA colour. */
const alpha = (a: number) =>
  Math.round(a * 255)
    .toString(16)
    .padStart(2, "0");

/**
 * Pulpit (screens/Dashboard) as shared/screens.tsx draws it, with sized tiles. `arrive` 0 → 1: the first tile grows
 * in and the others make room; `pulse` 0 → 1: a ring spreads from the first tile and fades (a live update).
 */
export const SizedDashboard = ({
  tiles,
  place,
  arrive = 1,
  pulse = 0,
}: {
  tiles: Tile[];
  place: string;
  arrive?: number;
  pulse?: number;
}) => {
  const grid = gridRects(
    tiles.map((tile) => ({ tile, size: { w: tile.w, h: tile.h } })),
    {
      width: SCREEN.width - 2 * layout.screenPaddingX,
      columns: DASHBOARD_COLUMNS,
      rowHeight: sizes.widgetRow,
      gap: GRID_GAP,
    },
  );
  const first = grid.tiles[0]?.rect.height ?? 0;
  const room = (1 - arrive) * (first + GRID_GAP);
  const ring = `0 0 0 ${4 + pulse * 18}px ${colors.primary}${alpha(0.45 * (1 - pulse))}`;
  return (
    <AppScreen tabBar backdrop={<Backdrop />}>
      <View style={styles.place}>
        <Text variant="label" color="textSecondary">
          {t.place_current_label}
        </Text>
        <Heading level={1} variant="heading">
          {place}
        </Heading>
      </View>
      <View style={styles.section}>
        <Text variant="small" color="textSecondary">
          {widgetsCount(tiles.length)}
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
              <PluginRenderer node={item.tile.node} onAction={nothing} busy={false} upload={noUpload} />
              {i === 0 && pulse > 0 && pulse < 1 ? <div style={{ ...RING, boxShadow: ring }} /> : null}
            </View>
          ))}
        </View>
      </View>
    </AppScreen>
  );
};

const styles = StyleSheet.create({
  backdrop: { height: sizes.dashboardMap, overflow: "hidden", top: -sizes.dashboardMapLift },
  glowBox: { position: "absolute", top: 0, left: 0, width: `${200 * sizes.dashboardPinX}%` },
  glow: { alignSelf: "center" },
  place: { gap: spacing[4] },
  section: { gap: spacing[6] },
  tile: { position: "absolute" },
});
