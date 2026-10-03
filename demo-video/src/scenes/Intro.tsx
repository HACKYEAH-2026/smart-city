import type React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { Stage } from "../components/Stage";
import { C, fadeUp, typed, useIn } from "../theme";

export const Logo: React.FC<{ size?: number }> = ({ size = 120 }) => (
  <svg aria-hidden="true" width={size} height={size} viewBox="0 0 100 100">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#60A5FA" />
        <stop offset="1" stopColor="#2563EB" />
      </linearGradient>
    </defs>
    <path d="M50 6 C28 6 14 22 14 41 C14 66 50 94 50 94 C50 94 86 66 86 41 C86 22 72 6 50 6 Z" fill="url(#g)" />
    <circle cx="38" cy="40" r="7" fill="white" />
    <circle cx="62" cy="40" r="7" fill="white" />
    <circle cx="50" cy="58" r="7" fill="white" />
    <path d="M38 40 L62 40 L50 58 Z" fill="none" stroke="white" strokeWidth="3" opacity="0.7" />
  </svg>
);

export const Intro: React.FC = () => {
  const frame = useCurrentFrame();
  const logo = useIn(0, 12);
  const title = useIn(10);
  const tag = "Cyfrowe społeczności dla prawdziwych miejsc.";
  return (
    <Stage>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 28 }}>
        <div style={{ transform: `scale(${logo})` }}>
          <Logo size={150} />
        </div>
        <div style={{ fontSize: 120, fontWeight: 800, letterSpacing: -3, ...fadeUp(title, 30) }}>Twoje Miejsce</div>
        <div style={{ fontSize: 42, color: "#CBD5E1", height: 52 }}>{typed(tag, frame, 35, 1.4)}</div>
        <div
          style={{
            marginTop: 30,
            fontSize: 24,
            color: "#93A3C4",
            letterSpacing: 4,
            textTransform: "uppercase",
            opacity: useIn(80),
          }}
        >
          HackYeah 2026 · Smart City
        </div>
      </AbsoluteFill>
    </Stage>
  );
};

export const Outro: React.FC = () => {
  const stats = [
    { big: "~2 500", small: "linii kodu rdzenia" },
    { big: "1 fakt", small: "który platforma zna o Tobie" },
    { big: "5 min", small: "na nową funkcję dla miasta" },
  ];
  return (
    <Stage>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 60 }}>
        <div style={{ display: "flex", gap: 50 }}>
          {stats.map((s, i) => (
            <Stat key={s.big} {...s} delay={i * 12} />
          ))}
        </div>
        <div style={{ fontSize: 28, color: "#93A3C4", ...fadeUp(useIn(50)) }}>
          Dalej: integracja z mObywatelem · sandbox WebAssembly dla wtyczek zewnętrznych · marketplace
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 22, marginTop: 30, ...fadeUp(useIn(75)) }}>
          <Logo size={84} />
          <div style={{ fontSize: 70, fontWeight: 800, letterSpacing: -2 }}>Twoje Miejsce</div>
        </div>
      </AbsoluteFill>
    </Stage>
  );
};

const Stat: React.FC<{ big: string; small: string; delay: number }> = ({ big, small, delay }) => {
  const p = useIn(delay);
  return (
    <div
      style={{
        width: 420,
        padding: "40px 30px",
        borderRadius: 24,
        background: C.nightSoft,
        border: `1px solid ${C.nightLine}`,
        textAlign: "center",
        ...fadeUp(p, 40),
      }}
    >
      <div style={{ fontSize: 84, fontWeight: 800, color: "#93C5FD" }}>{big}</div>
      <div style={{ fontSize: 27, color: "#CBD5E1", marginTop: 8 }}>{small}</div>
    </div>
  );
};
