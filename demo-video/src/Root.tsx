import type React from "react";
import { Composition } from "remotion";
import { AdNeeds } from "./ads/needs/Ad";
import { DURATION as NEEDS_DURATION } from "./ads/needs/timing";
import { AdProblems } from "./ads/problems/Ad";
import { DURATION as PROBLEMS_DURATION } from "./ads/problems/timing";
import { FPS } from "./ads/shared/timing";
import { AppUi } from "./scenes/AppUi";
import { DURATION, Video } from "./Video";

/** The ads are variants developed side by side (src/ads/<variant>); render each and pick the best. */
const AD = { fps: FPS, width: 1920, height: 1080, defaultProps: { captions: true } };

export const Root: React.FC = () => (
  <>
    <Composition id="AdProblems" component={AdProblems} durationInFrames={PROBLEMS_DURATION} {...AD} />
    <Composition id="AdNeeds" component={AdNeeds} durationInFrames={NEEDS_DURATION} {...AD} />
    <Composition
      id="TwojeMiejsceDemo"
      component={Video}
      durationInFrames={DURATION}
      fps={30}
      width={1920}
      height={1080}
    />
    <Composition id="AppUi" component={AppUi} durationInFrames={90} fps={30} width={1920} height={1080} />
  </>
);
