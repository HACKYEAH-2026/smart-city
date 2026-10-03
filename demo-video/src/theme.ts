import {loadFont} from '@remotion/google-fonts/Inter';
import {loadFont as loadMono} from '@remotion/google-fonts/JetBrainsMono';
import React from 'react';
import {spring, useCurrentFrame, useVideoConfig} from 'remotion';

export const FONT = loadFont('normal', {weights: ['400', '500', '600', '700', '800'], subsets: ['latin', 'latin-ext']}).fontFamily;
export const MONO = loadMono('normal', {weights: ['400', '600'], subsets: ['latin', 'latin-ext']}).fontFamily;

export const C = {
	night: '#0B1020',
	nightSoft: '#151D38',
	nightLine: '#26304F',
	text: '#0F172A',
	muted: '#64748B',
	line: '#E2E8F0',
	surface: '#FFFFFF',
	canvas: '#F4F6FA',
	accent: '#2563EB',
	accentSoft: '#DBEAFE',
	green: '#15803D',
	greenSoft: '#DCFCE7',
	amber: '#B45309',
	amberSoft: '#FEF3C7',
	red: '#DC2626',
	redSoft: '#FEE2E2',
	violet: '#7C3AED',
	violetSoft: '#EDE9FE',
};

// Spring 0 → 1 starting at `delay` frames.
export const useIn = (delay = 0, damping = 200) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();
	return spring({frame: frame - delay, fps, config: {damping}});
};

export const fadeUp = (p: number, dist = 24): React.CSSProperties => ({
	opacity: p,
	transform: `translateY(${(1 - p) * dist}px)`,
});

export const typed = (text: string, frame: number, start: number, charsPerFrame = 1.2) =>
	text.slice(0, Math.max(0, Math.floor((frame - start) * charsPerFrame)));
