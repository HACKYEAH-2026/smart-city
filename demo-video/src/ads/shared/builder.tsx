import { Check, Sparkles } from "lucide-react-native";
import { useCurrentFrame } from "remotion";
import { colors } from "../../app-ui";
import { MONO } from "../../theme";
import { FONT, ramp, typed } from "./kit";
import { WhiteIcon } from "./stage";

/** The plugin builder on screen: the AI's code as it is written, the checks it passes, the publish burst. */

/** The civic budget plugin the AI writes in the "problems" ad. */
export const CODE = `import type { PluginModule } from "@app/plugin-sdk";

const budzet: PluginModule = ({ definePlugin, ui, z, t }) =>
  definePlugin({
    id: "budzet",
    name: "Budżet obywatelski",
    icon: "🗳️",
    permissions: ["db"],
    tables: {
      ideas: t.table({ title: t.text(), votes: t.integer().default(0) }),
      votes: t.table(
        { idea: t.ref("ideas"), voter: t.ref("user") },
        { unique: [["idea", "voter"]] },
      ),
    },
    views: {
      list: async (ctx) => {
        const ideas = await ctx.db.ideas.findMany({ orderBy: { votes: "desc" } });
        return ui.screen("Budżet obywatelski", ideas.map((i) =>
          ui.progress({ label: i.title, value: i.votes, max: 100 })));
      },
    },
    tools: {
      vote: {
        input: z.object({ idea: z.string() }),
        handler: async (ctx, { idea }) => {
          await ctx.db.votes.insert({ idea, voter: ctx.user.id });
          return { toast: "Dziękujemy za głos!", refresh: true };
        },
      },
    },
  });`;

export const KEYWORD = /^(import|type|from|const|async|await|return|export|default)$/;

/** One line of the plugin's code, lightly coloured: strings warm, keywords red. */
export const CodeLine = ({ text }: { text: string }) => (
  <div style={{ whiteSpace: "pre", minHeight: 30 }}>
    {text.split(/("[^"]*"?|\b\w+\b)/).map((part, i) => (
      <span
        // biome-ignore lint/suspicious/noArrayIndexKey: tokens of a fixed line.
        key={i}
        style={{ color: part.startsWith('"') ? "#F2C46D" : KEYWORD.test(part) ? "#FF7A70" : undefined }}
      >
        {part}
      </span>
    ))}
  </div>
);

export const CodePanel = ({
  at,
  code = CODE,
  file = "budzet/index.ts",
}: {
  at: number;
  code?: string;
  file?: string;
}) => {
  const frame = useCurrentFrame();
  const lines = typed(code, frame, at, 9).split("\n").slice(-15);
  return (
    <div
      style={{
        width: 860,
        borderRadius: 26,
        background: "#17171A",
        boxShadow: "0 40px 90px -20px rgba(27,27,31,0.55)",
        overflow: "hidden",
        transform: "perspective(2400px) rotateY(10deg)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "18px 24px", background: "#222227" }}>
        {["#FF5F57", "#FEBC2E", "#28C840"].map((c) => (
          <div key={c} style={{ width: 13, height: 13, borderRadius: 7, background: c }} />
        ))}
        <span style={{ marginLeft: 14, fontFamily: MONO, fontSize: 19, color: "#8A8A92" }}>{file}</span>
        <span
          style={{
            marginLeft: "auto",
            display: "flex",
            alignItems: "center",
            gap: 8,
            color: "#FFFFFF",
            fontFamily: FONT.semibold,
            fontSize: 19,
          }}
        >
          <WhiteIcon icon={Sparkles} size={18} />
          AI pisze
        </span>
      </div>
      <div
        style={{
          padding: "22px 28px",
          height: 470,
          fontFamily: MONO,
          fontSize: 20,
          lineHeight: "30px",
          color: "#E7E7EA",
        }}
      >
        {lines.map((line, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: lines of a fixed text.
          <CodeLine key={i} text={line} />
        ))}
      </div>
    </div>
  );
};

/** The checks every plugin passes before it can run (docs/plugins.md), ticked off one by one. */
export const CHECKS = ["Składnia", "Importy", "Typy", "Bezpieczeństwo", "Wczytanie", "Tabele"];

export const Checks = ({ from, to }: { from: number; to: number }) => {
  const frame = useCurrentFrame();
  const step = (to - from) / CHECKS.length;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 12, width: 880 }}>
      {CHECKS.map((label, i) => {
        const at = from + step * (i + 1);
        const done = frame >= at;
        const p = ramp(frame, at, at + 6);
        return (
          <div
            key={label}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "12px 20px",
              borderRadius: 999,
              background: done ? "#FFFFFF" : "rgba(255,255,255,0.55)",
              boxShadow: done ? "0 10px 24px rgba(27,27,31,0.10)" : "none",
              fontFamily: FONT.semibold,
              fontSize: 26,
              color: done ? colors.text : colors.textSecondary,
              transform: `scale(${1 + Math.sin(p * Math.PI) * 0.1})`,
            }}
          >
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: 15,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: done ? colors.primary : colors.border,
              }}
            >
              {done ? <WhiteIcon icon={Check} size={18} stroke={3.2} /> : null}
            </div>
            {label}
          </div>
        );
      })}
    </div>
  );
};

/**
 * Residents around the new plugin, each somewhere else in the app (the app covers much more than one feature):
 * discussions, issues, the dashboard the new widget lands on, the new plugin itself, announcements.
 */
/** The burst of the publish tap: a red ring growing from the button. */
export const Ring = ({ at, x, y }: { at: number; x: number; y: number }) => {
  const frame = useCurrentFrame();
  const p = ramp(frame, at, at + 28);
  if (frame < at || p >= 1) return null;
  return (
    <div
      style={{
        position: "absolute",
        left: x - 300,
        top: y - 300,
        width: 600,
        height: 600,
        borderRadius: 300,
        border: `8px solid ${colors.primary}`,
        opacity: 1 - p,
        transform: `scale(${0.2 + p * 2})`,
      }}
    />
  );
};

/** The room booking plugin the AI writes in the "needs" ad. */
export const BOOKING_CODE = `import type { PluginModule } from "@app/plugin-sdk";

const sale: PluginModule = ({ definePlugin, ui, z, t }) =>
  definePlugin({
    id: "sale",
    name: "Rezerwacja sal",
    icon: "📅",
    permissions: ["db"],
    tables: {
      rooms: t.table({ name: t.text(), seats: t.integer() }),
      bookings: t.table(
        { room: t.ref("rooms"), day: t.text(), hour: t.text(), by: t.ref("user") },
        { unique: [["room", "day", "hour"]] },
      ),
    },
    views: {
      list: async (ctx) => {
        const rooms = await ctx.db.rooms.findMany({ orderBy: { name: "asc" } });
        return ui.screen("Rezerwacja sal", rooms.map((r) =>
          ui.card({ title: r.name, subtitle: \`\${r.seats} miejsc\` })));
      },
    },
    tools: {
      book: {
        input: z.object({ room: z.string(), day: z.string(), hour: z.string() }),
        handler: async (ctx, { room, day, hour }) => {
          await ctx.db.bookings.insert({ room, day, hour, by: ctx.user.id });
          return { toast: "Sala zarezerwowana!", refresh: true };
        },
      },
    },
  });`;
