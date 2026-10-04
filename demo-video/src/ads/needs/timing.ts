import { timeline } from "../shared/timing";
import { BEATS } from "./script";

/** Frames of picture before the first word and after the last one, per scene. */
export const { scenes: SCENES, duration: DURATION } = timeline(BEATS, {
  // After the line: the campus opens up and its student walks to a QR code and scans it (kampus-qr).
  intro: { lead: 10, tail: 165 },
  promise: { lead: 10, tail: 16 },
  city: { lead: 30, tail: 20 },
  campus: { lead: 30, tail: 20 },
  coop: { lead: 30, tail: 24 },
  builder: { lead: 10, tail: 30 },
  outro: { lead: 8, tail: 90 },
});
