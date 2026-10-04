import { timeline } from "../shared/timing";
import { BEATS } from "./script";

/**
 * Frames of picture before the first word and after the last one, per scene. Not recorded yet: the scenes are timed
 * by an estimate of the read and the draft shows captions (src/ads/README.md).
 */
export const { scenes: SCENES, duration: DURATION } = timeline(BEATS, {
  // After the line: the campus opens up and its student raises her phone to a QR code (kampus-qr).
  intro: { lead: 6, tail: 32 },
  promise: { lead: 4, tail: 14 },
  // The city's clip with its name, then the questions; after the last answer its dashboard holds all three.
  city: { lead: 10, tail: 24 },
  campus: { lead: 10, tail: 16 },
  coop: { lead: 10, tail: 18 },
  // The draft is ready by the end of the scene; „Opublikuj w miejscu” is tapped in the next one.
  builder: { lead: 6, tail: 30 },
  // Before the line: the tap; after it, the new widget on every member's phone takes a booking.
  publish: { lead: 14, tail: 50 },
  outro: { lead: 6, tail: 45 },
});
