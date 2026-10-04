import { type AdProps, AdSequence } from "../shared/Ad";
import {
  BuilderScene,
  CampusScene,
  CityScene,
  CoopScene,
  IntroScene,
  OutroScene,
  PromiseScene,
  PublishScene,
} from "./scenes";
import { SCENES, VOICE_FILE } from "./timing";

/**
 * The "needs" ad, second cut: a city, a campus, a housing cooperative and more need different things; one app fits
 * each, and what is missing the AI plugin builder adds and publishes to everyone.
 */
export const AdNeeds2 = ({ captions }: AdProps) => (
  <AdSequence
    scenes={SCENES}
    captions={captions}
    voice={VOICE_FILE}
    components={{
      intro: IntroScene,
      promise: PromiseScene,
      city: CityScene,
      campus: CampusScene,
      coop: CoopScene,
      builder: BuilderScene,
      publish: PublishScene,
      outro: OutroScene,
    }}
  />
);
