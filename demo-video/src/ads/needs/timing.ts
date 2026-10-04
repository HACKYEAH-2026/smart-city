import { type Take, timeline } from "../shared/timing";
import { BEATS } from "./script";
import take from "./vo.json";

/** The recorded take (public/ad/voice/needs.mp3); its word times time the scenes. */
export const VOICE_FILE = "ad/voice/needs.mp3";

/** Frames of picture before the first word and after the last one, per scene. */
export const { scenes: SCENES, duration: DURATION } = timeline(
  BEATS,
  {
    // After the line: the campus opens up and its student scans a QR code (kampus-qr).
    intro: { lead: 6, tail: 62 },
    promise: { lead: 4, tail: 14 },
    city: { lead: 10, tail: 14 },
    campus: { lead: 10, tail: 16 },
    coop: { lead: 10, tail: 18 },
    builder: { lead: 6, tail: 36 },
    outro: { lead: 6, tail: 45 },
  },
  take as Take,
);
