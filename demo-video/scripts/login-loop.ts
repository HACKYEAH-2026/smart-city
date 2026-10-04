/**
 * Renders the login screen's looping video (src/login/Loop.tsx), every variant, into public/login: a light 720 px
 * square MP4 without sound and its first frame as a JPEG poster (shown until the video plays).
 *   bun run render:login
 */
import { join } from "node:path";
import { VARIANTS } from "../src/login/Loop";

const OUT = join(import.meta.dir, "../public/login");

const remotion = async (args: string[]) => {
  const proc = Bun.spawn(["bunx", "remotion", ...args], { stdout: "inherit", stderr: "inherit" });
  if ((await proc.exited) !== 0) throw new Error(`remotion ${args.join(" ")} failed`);
};

const render = async (variant: string) => {
  const id = `LoginLoop${variant.toUpperCase()}`;
  const file = join(OUT, `login-loop-${variant}`);
  await remotion([
    "render",
    id,
    `${file}.mp4`,
    "--muted",
    "--crf",
    "32",
    "--x264-preset",
    "slower",
    "--image-format",
    "png",
  ]);
  await remotion(["still", id, `${file}.jpg`, "--frame", "0", "--jpeg-quality", "82"]);
  console.log(
    `login: ${id} → public/login/login-loop-${variant}.mp4 (${(Bun.file(`${file}.mp4`).size / 1024).toFixed(0)} kB)`,
  );
};

// One at a time: each render already uses every core.
await Object.keys(VARIANTS).reduce((done, variant) => done.then(() => render(variant)), Promise.resolve());
