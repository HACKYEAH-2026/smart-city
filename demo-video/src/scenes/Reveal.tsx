import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {Stage} from '../components/Stage';
import {C, MONO, fadeUp, useIn} from '../theme';

const PLUGINS = [
	{icon: '🪪', name: 'Tożsamość', sub: 'adapter mObywatel', x: 260, y: 300},
	{icon: '🛠️', name: 'Zgłoszenia', sub: 'AI + duplikaty', x: 260, y: 480},
	{icon: '✍️', name: 'Inicjatywy', sub: 'podpisy', x: 260, y: 660},
	{icon: '🗳️', name: 'Głosowania', sub: '1 mieszkaniec = 1 głos', x: 1340, y: 300},
	{icon: '♻️', name: 'Odpady', sub: 'harmonogramy', x: 1340, y: 480},
	{icon: '🤖', name: 'MCP', sub: 'narzędzia dla AI', x: 1340, y: 660},
];
const CORE = {x: 760, y: 420, w: 400, h: 220};
const CODE_AT = 120;

const CODE = `export default definePlugin({
  id: "issues",
  permissions: ["members.read", "storage"],
  tools: {
    report: async (ctx, { photo, text }) => {…},
    upvote: async (ctx, { id }) => {…},
  },
});`;

export const Reveal: React.FC = () => {
	const frame = useCurrentFrame();
	const head = useIn(0);
	const core = useIn(20, 14);
	const code = useIn(CODE_AT);
	const shift = interpolate(code, [0, 1], [0, -150]);
	return (
		<Stage caption="Rdzeń jest mały. Wszystko, co widzieliście, to wtyczki." captionAt={40}>
			<AbsoluteFill>
				<div style={{position: 'absolute', top: 90, width: '100%', textAlign: 'center', fontSize: 64, fontWeight: 800, letterSpacing: -1, ...fadeUp(head), opacity: head * (1 - code)}}>
					A teraz mały sekret…
				</div>
				<div style={{position: 'absolute', inset: 0, transform: `translateY(${shift}px)`}}>
					<svg width="1920" height="1080" style={{position: 'absolute', inset: 0}}>
						{PLUGINS.map((p, i) => {
							const t = interpolate(frame, [30 + i * 8, 55 + i * 8], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
							const fromX = p.x < CORE.x ? p.x + 320 : p.x;
							const toX = p.x < CORE.x ? CORE.x : CORE.x + CORE.w;
							const y1 = p.y + 50;
							const y2 = CORE.y + CORE.h / 2;
							return <line key={p.name} x1={fromX} y1={y1} x2={fromX + (toX - fromX) * t} y2={y1 + (y2 - y1) * t} stroke="#3B82F6" strokeWidth={3} strokeDasharray="8 8" opacity={0.7} />;
						})}
					</svg>
					<div style={{position: 'absolute', left: CORE.x, top: CORE.y, width: CORE.w, height: CORE.h, borderRadius: 26, background: 'linear-gradient(135deg,#1D4ED8,#2563EB)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', transform: `scale(${core})`, boxShadow: '0 0 80px rgba(37,99,235,0.5)'}}>
						<div style={{fontSize: 44, fontWeight: 800}}>Rdzeń</div>
						<div style={{fontSize: 21, color: '#DBEAFE', marginTop: 10, textAlign: 'center', lineHeight: 1.45}}>
							społeczności · członkostwo
							<br />
							uprawnienia · API wtyczek
						</div>
					</div>
					{PLUGINS.map((p, i) => (
						<PluginCard key={p.name} {...p} delay={30 + i * 8} />
					))}
				</div>
				{frame >= CODE_AT ? (
					<div style={{position: 'absolute', left: 460, top: 640, width: 1000, background: '#0F172A', border: `1px solid ${C.nightLine}`, borderRadius: 18, padding: '24px 30px', fontFamily: MONO, fontSize: 20, lineHeight: 1.5, whiteSpace: 'pre', color: '#E2E8F0', boxShadow: '0 30px 80px rgba(0,0,0,0.5)', ...fadeUp(code, 40)}}>
						<div style={{fontFamily: 'inherit', fontSize: 15, color: '#64748B', marginBottom: 8}}>plugins/issues/index.ts</div>
						{highlight(CODE)}
					</div>
				) : null}
			</AbsoluteFill>
		</Stage>
	);
};

const PluginCard: React.FC<{icon: string; name: string; sub: string; x: number; y: number; delay: number}> = ({icon, name, sub, x, y, delay}) => {
	const p = useIn(delay, 14);
	return (
		<div style={{position: 'absolute', left: x, top: y, width: 320, height: 100, borderRadius: 18, background: C.nightSoft, border: `1px solid ${C.nightLine}`, display: 'flex', alignItems: 'center', gap: 18, padding: '0 22px', opacity: p, transform: `scale(${0.7 + 0.3 * p})`}}>
			<span style={{fontSize: 40}}>{icon}</span>
			<div>
				<div style={{fontSize: 26, fontWeight: 700}}>{name}</div>
				<div style={{fontSize: 18, color: '#93A3C4'}}>{sub}</div>
			</div>
		</div>
	);
};

// Minimal TS highlighting: strings, keywords, identifiers before "(".
export const highlight = (code: string) =>
	code.split(/("[^"]*"|\bexport\b|\bdefault\b|\basync\b|\bconst\b|\bawait\b|\breturn\b|\b\w+(?=\())/g).map((part, i) => {
		if (!part) return null;
		const color = part.startsWith('"') ? '#86EFAC' : /^(export|default|async|const|await|return)$/.test(part) ? '#C4B5FD' : /^\w+$/.test(part) ? '#93C5FD' : undefined;
		return (
			<span key={i} style={{color}}>
				{part}
			</span>
		);
	});
