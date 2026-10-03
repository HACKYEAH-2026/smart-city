import React from 'react';
import {AbsoluteFill} from 'remotion';
import {C, FONT, fadeUp, useIn} from '../theme';

// Dark backdrop with an optional narration caption at the bottom.
export const Stage: React.FC<{caption?: string; captionAt?: number; children: React.ReactNode}> = ({
	caption,
	captionAt = 20,
	children,
}) => {
	const p = useIn(captionAt);
	return (
		<AbsoluteFill
			style={{
				background: `radial-gradient(circle at 20% 0%, #1B2550 0%, ${C.night} 55%)`,
				fontFamily: FONT,
				color: 'white',
			}}
		>
			{children}
			{caption ? (
				<div
					style={{
						position: 'absolute',
						left: 0,
						right: 0,
						bottom: 44,
						textAlign: 'center',
						fontSize: 34,
						fontWeight: 500,
						color: '#E2E8F0',
						...fadeUp(p, 16),
					}}
				>
					{caption}
				</div>
			) : null}
		</AbsoluteFill>
	);
};
