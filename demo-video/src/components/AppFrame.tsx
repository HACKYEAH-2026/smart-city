import type React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { C, FONT, useIn } from "../theme";

export type NavItem = { id: string; icon: string; label: string };

export const NAV: NavItem[] = [
  { id: "feed", icon: "🏠", label: "Tablica" },
  { id: "issues", icon: "🛠️", label: "Zgłoszenia" },
  { id: "petitions", icon: "✍️", label: "Inicjatywy" },
  { id: "votes", icon: "🗳️", label: "Głosowania" },
  { id: "waste", icon: "♻️", label: "Odpady" },
];

export const FRAME = { top: 40, width: 1640, height: 860 };

// Browser window with the community sidebar. `extra` animates a newly installed plugin into the nav.
export const AppFrame: React.FC<{
  active: string;
  verified?: boolean;
  extra?: { item: NavItem; at: number };
  children: React.ReactNode;
}> = ({ active, verified = true, extra, children }) => {
  const frame = useCurrentFrame();
  const extraIn = useIn(extra?.at ?? 0, 14);
  const glow = extra
    ? interpolate(frame, [extra.at, extra.at + 20, extra.at + 70], [0, 1, 0.25], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    : 0;
  const items = extra && frame >= extra.at ? [...NAV, extra.item] : NAV;

  return (
    <div
      style={{
        position: "absolute",
        top: FRAME.top,
        left: (1920 - FRAME.width) / 2,
        width: FRAME.width,
        height: FRAME.height,
        borderRadius: 22,
        overflow: "hidden",
        background: C.canvas,
        boxShadow: "0 40px 120px rgba(0,0,0,0.55)",
        fontFamily: FONT,
        color: C.text,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          height: 52,
          background: "#E9EDF3",
          display: "flex",
          alignItems: "center",
          padding: "0 20px",
          gap: 9,
          borderBottom: `1px solid ${C.line}`,
        }}
      >
        {["#F87171", "#FBBF24", "#34D399"].map((c) => (
          <div key={c} style={{ width: 14, height: 14, borderRadius: 7, background: c }} />
        ))}
        <div
          style={{
            marginLeft: 24,
            flex: 1,
            maxWidth: 560,
            height: 32,
            borderRadius: 9,
            background: "white",
            display: "flex",
            alignItems: "center",
            padding: "0 14px",
            fontSize: 17,
            color: C.muted,
          }}
        >
          🔒 twojemiejsce.pl/krakow
        </div>
      </div>
      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        <div
          style={{
            width: 300,
            background: "white",
            borderRight: `1px solid ${C.line}`,
            padding: "28px 18px",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "0 8px 26px" }}>
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: 14,
                background: C.accent,
                color: "white",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 26,
                fontWeight: 800,
              }}
            >
              K
            </div>
            <div>
              <div style={{ fontSize: 23, fontWeight: 700 }}>Kraków</div>
              <div style={{ fontSize: 15, color: C.muted }}>12 480 zweryfikowanych</div>
            </div>
          </div>
          {items.map((it) => {
            const isActive = it.id === active;
            const isExtra = extra && it.id === extra.item.id;
            return (
              <div
                key={it.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  padding: "13px 14px",
                  borderRadius: 12,
                  fontSize: 20,
                  fontWeight: isActive ? 700 : 500,
                  background: isActive ? C.accentSoft : "transparent",
                  color: isActive ? C.accent : C.text,
                  marginBottom: 4,
                  opacity: isExtra ? extraIn : 1,
                  transform: isExtra ? `translateX(${(1 - extraIn) * -40}px)` : undefined,
                  boxShadow: isExtra ? `0 0 0 ${3 * glow}px ${C.violet}, 0 0 ${30 * glow}px ${C.violet}` : undefined,
                }}
              >
                <span style={{ fontSize: 22 }}>{it.icon}</span>
                {it.label}
                {isExtra ? (
                  <span
                    style={{
                      marginLeft: "auto",
                      fontSize: 13,
                      fontWeight: 700,
                      color: C.violet,
                      background: C.violetSoft,
                      padding: "3px 8px",
                      borderRadius: 6,
                    }}
                  >
                    NOWA
                  </span>
                ) : null}
              </div>
            );
          })}
          <div
            style={{
              marginTop: "auto",
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: 10,
              borderRadius: 14,
              background: C.canvas,
            }}
          >
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 21,
                background: "#F9A8D4",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 700,
              }}
            >
              A
            </div>
            <div>
              <div style={{ fontSize: 17, fontWeight: 600 }}>Anna</div>
              {verified ? (
                <div style={{ fontSize: 14, color: C.green, fontWeight: 600 }}>✓ Mieszkanka Krakowa</div>
              ) : (
                <div style={{ fontSize: 14, color: C.muted }}>Niezweryfikowana</div>
              )}
            </div>
          </div>
        </div>
        <div style={{ flex: 1, padding: 40, position: "relative", minWidth: 0 }}>{children}</div>
      </div>
    </div>
  );
};

export const Card: React.FC<{ style?: React.CSSProperties; children: React.ReactNode }> = ({ style, children }) => (
  <div
    style={{
      background: "white",
      borderRadius: 18,
      border: `1px solid ${C.line}`,
      padding: 28,
      boxShadow: "0 4px 18px rgba(15,23,42,0.05)",
      ...style,
    }}
  >
    {children}
  </div>
);

export const Button: React.FC<{
  pressAt?: number;
  color?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}> = ({ pressAt, color = C.accent, style, children }) => {
  const frame = useCurrentFrame();
  const scale =
    pressAt === undefined
      ? 1
      : interpolate(frame, [pressAt - 4, pressAt, pressAt + 6], [1, 0.93, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        background: color,
        color: "white",
        fontWeight: 700,
        fontSize: 21,
        padding: "16px 26px",
        borderRadius: 13,
        whiteSpace: "nowrap",
        flexShrink: 0,
        transform: `scale(${scale})`,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

// Animated pointer that glides to (x, y) and clicks at `clickAt`.
export const Cursor: React.FC<{ path: { at: number; x: number; y: number }[]; clickAt?: number }> = ({
  path,
  clickAt,
}) => {
  const frame = useCurrentFrame();
  const ats = path.map((p) => p.at);
  const x = interpolate(
    frame,
    ats,
    path.map((p) => p.x),
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const y = interpolate(
    frame,
    ats,
    path.map((p) => p.y),
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const ring =
    clickAt === undefined
      ? 0
      : interpolate(frame, [clickAt, clickAt + 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div style={{ position: "absolute", left: x, top: y, pointerEvents: "none", zIndex: 50 }}>
      {ring > 0 && ring < 1 ? (
        <div
          style={{
            position: "absolute",
            left: -24 * ring,
            top: -24 * ring,
            width: 48 * ring,
            height: 48 * ring,
            borderRadius: "50%",
            border: `3px solid ${C.accent}`,
            opacity: 1 - ring,
          }}
        />
      ) : null}
      <svg
        aria-hidden="true"
        width="30"
        height="30"
        viewBox="0 0 24 24"
        style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.35))" }}
      >
        <path
          d="M4 2 L4 19 L9 14.5 L12.5 22 L15.5 20.6 L12 13.3 L19 13 Z"
          fill="white"
          stroke="#0F172A"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
};
