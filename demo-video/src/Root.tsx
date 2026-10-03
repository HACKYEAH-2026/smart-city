import React from 'react';
import {Composition} from 'remotion';
import {DURATION, Video} from './Video';

export const Root: React.FC = () => (
	<Composition id="TwojeMiejsceDemo" component={Video} durationInFrames={DURATION} fps={30} width={1920} height={1080} />
);
