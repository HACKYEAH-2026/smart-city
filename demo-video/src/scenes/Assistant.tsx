import type React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { Stage } from "../components/Stage";
import { C, fadeUp, MONO, typed, useIn } from "../theme";

const ASK = "Latarnia na Długiej dalej nie świeci. I kiedy jest odbiór gabarytów na Grzegórzkach?";
const TOOLS = [
  {
    at: 95,
    call: "issues.search",
    args: '{ near: "ul. Długa 12", category: "oświetlenie" }',
    result: "→ #1842 · 15 osób · przyjęte",
  },
  { at: 125, call: "issues.upvote", args: "{ id: 1842 }", result: "→ 16 osób" },
  {
    at: 155,
    call: "waste.schedule",
    args: '{ district: "Grzegórzki", type: "gabaryty" }',
    result: "→ czw. 8 października",
  },
];
const ANSWER_AT = 195;
const ANSWER =
  "Dołączyłem Cię do zgłoszenia #1842: „Ciemno na Długiej”. To już 16 osób, sprawa jest w Zarządzie Dróg. Najbliższy odbiór gabarytów na Grzegórzkach: czwartek, 8 października. Wystawić przypomnienie?";

export const Assistant: React.FC = () => {
  const frame = useCurrentFrame();
  const win = useIn(0);
  const badge = useIn(90);
  return (
    <Stage caption="Każda wtyczka jest też narzędziem dla asystentów AI, przez otwarty protokół MCP." captionAt={100}>
      <AbsoluteFill style={{ alignItems: "center", paddingTop: 140 }}>
        <div
          style={{
            width: 1300,
            height: 680,
            borderRadius: 24,
            background: "#FAFAF9",
            color: C.text,
            boxShadow: "0 40px 120px rgba(0,0,0,0.55)",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            ...fadeUp(win, 40),
          }}
        >
          <div
            style={{
              height: 64,
              display: "flex",
              alignItems: "center",
              gap: 14,
              padding: "0 28px",
              borderBottom: `1px solid ${C.line}`,
              fontSize: 22,
              fontWeight: 700,
            }}
          >
            <span style={{ fontSize: 26 }}>💬</span> Twój asystent AI
            <span
              style={{
                marginLeft: "auto",
                fontSize: 16,
                fontWeight: 600,
                color: C.violet,
                background: C.violetSoft,
                padding: "6px 12px",
                borderRadius: 8,
                opacity: badge,
              }}
            >
              🔌 połączono: Twoje Miejsce · Kraków (MCP)
            </span>
          </div>
          <div style={{ flex: 1, padding: "34px 44px", display: "flex", flexDirection: "column", gap: 22 }}>
            <div
              style={{
                alignSelf: "flex-end",
                maxWidth: 760,
                background: C.accent,
                color: "white",
                fontSize: 25,
                lineHeight: 1.4,
                padding: "18px 24px",
                borderRadius: "22px 22px 6px 22px",
              }}
            >
              {typed(ASK, frame, 8, 1.3) || " "}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {TOOLS.map((t) => (
                <ToolCall key={t.call} {...t} />
              ))}
            </div>
            {frame >= ANSWER_AT ? (
              <div style={{ maxWidth: 980, fontSize: 25, lineHeight: 1.5 }}>{typed(ANSWER, frame, ANSWER_AT, 2.2)}</div>
            ) : null}
          </div>
        </div>
      </AbsoluteFill>
    </Stage>
  );
};

const ToolCall: React.FC<{ at: number; call: string; args: string; result: string }> = ({ at, call, args, result }) => {
  const frame = useCurrentFrame();
  const p = useIn(at);
  const resolved = frame >= at + 18;
  if (frame < at) return null;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        fontFamily: MONO,
        fontSize: 19,
        background: "white",
        border: `1px solid ${C.line}`,
        borderRadius: 12,
        padding: "12px 18px",
        ...fadeUp(p, 10),
      }}
    >
      <span style={{ color: C.violet, fontWeight: 600 }}>⚙ {call}</span>
      <span style={{ color: C.muted }}>{args}</span>
      <span style={{ marginLeft: "auto", color: resolved ? C.green : C.muted, fontWeight: 600 }}>
        {resolved ? result : "…"}
      </span>
    </div>
  );
};
