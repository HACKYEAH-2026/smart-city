import type { Tone } from "@app/plugin-sdk";
import type { BadgeTone } from "../components";

/** Plugin tones → design-system badge tones. The design has no success/warning/info colors, so only danger stands out. */
export const toBadgeTone = (tone: Tone | undefined): BadgeTone => {
  if (tone === "danger") return "accent";
  if (tone === "info" || tone === "warning" || tone === "success") return tone;
  return "neutral";
};
