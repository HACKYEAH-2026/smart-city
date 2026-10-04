import type React from "react";
import { Composition } from "remotion";
import { AdNeeds } from "./ads/needs/Ad";
import { DURATION as NEEDS_DURATION } from "./ads/needs/timing";
import { AdNeeds2 } from "./ads/needs-2/Ad";
import { DURATION as NEEDS2_DURATION } from "./ads/needs-2/timing";
import { AdProblems } from "./ads/problems/Ad";
import { DURATION as PROBLEMS_DURATION } from "./ads/problems/timing";
import { FPS } from "./ads/shared/timing";
import { FPS as LOOP_FPS, SIZE as LOOP_SIZE, LoginLoop, loopFrames, VARIANTS } from "./login/Loop";
import { AppUi } from "./scenes/AppUi";
import { DURATION, Video } from "./Video";

/**
 * The ads are variants developed side by side (src/ads/<variant>); render each and pick the best. An ad with a
 * recorded voice-over plays it without captions; a draft shows its narration as captions.
 */
const AD = { fps: FPS, width: 1920, height: 1080 };

export const Root: React.FC = () => (
  <>
    <Composition
      id="AdProblems"
      component={AdProblems}
      durationInFrames={PROBLEMS_DURATION}
      defaultProps={{ captions: true }}
      {...AD}
    />
    <Composition
      id="AdNeeds"
      component={AdNeeds}
      durationInFrames={NEEDS_DURATION}
      defaultProps={{ captions: false }}
      {...AD}
    />
    <Composition
      id="AdNeeds2"
      component={AdNeeds2}
      durationInFrames={NEEDS2_DURATION}
      defaultProps={{ captions: true }}
      {...AD}
    />
    <Composition
      id="TwojeMiejsceDemo"
      component={Video}
      durationInFrames={DURATION}
      fps={30}
      width={1920}
      height={1080}
    />
    {(Object.keys(VARIANTS) as (keyof typeof VARIANTS)[]).map((variant) => (
      <Composition
        key={variant}
        id={`LoginLoop${variant.toUpperCase()}`}
        component={LoginLoop}
        durationInFrames={loopFrames(variant)}
        fps={LOOP_FPS}
        width={LOOP_SIZE}
        height={LOOP_SIZE}
        defaultProps={{ variant }}
      />
    ))}
    <Composition id="AppUi" component={AppUi} durationInFrames={90} fps={30} width={1920} height={1080} />
  </>
);
