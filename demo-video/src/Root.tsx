import type React from "react";
import { Composition } from "remotion";
import { Ad } from "./ad/Ad";
import { DURATION as AD_DURATION, FPS } from "./ad/timing";
import { AppUi } from "./scenes/AppUi";
import { DURATION, Video } from "./Video";

export const Root: React.FC = () => (
  <>
    <Composition
      id="TwojeMiejsceDemo"
      component={Video}
      durationInFrames={DURATION}
      fps={30}
      width={1920}
      height={1080}
    />
    <Composition
      id="Reklama"
      component={Ad}
      durationInFrames={AD_DURATION}
      fps={FPS}
      width={1920}
      height={1080}
      defaultProps={{ captions: true }}
    />
    <Composition id="AppUi" component={AppUi} durationInFrames={90} fps={30} width={1920} height={1080} />
  </>
);
