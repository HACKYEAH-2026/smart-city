/**
 * Android phone over USB in dev (`just dev`, mprocs proc "usb"): `adb reverse` makes the phone's localhost:4000
 * (API) and localhost:8081 (Metro) reach this machine, so Expo Go (started with --localhost) loads the bundle and
 * the default API URL works without Wi-Fi. Polls, so it covers every attached device and re-plugging the cable.
 * adb: the SDK in ANDROID_HOME / ANDROID_SDK_ROOT, else Android Studio's default location, else PATH (as Expo CLI).
 */
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const ports = [process.env.PORT ?? "4000", process.env.RCT_METRO_PORT ?? "8081"];
const defaultSdk = join(homedir(), process.platform === "darwin" ? "Library/Android/sdk" : "Android/Sdk");

function findAdb(): string | null {
  const sdk = process.env.ANDROID_HOME ?? process.env.ANDROID_SDK_ROOT ?? defaultSdk;
  const inSdk = join(sdk, "platform-tools", "adb");
  return existsSync(inSdk) ? inSdk : Bun.which("adb");
}

const adb = findAdb();
if (!adb) {
  console.log("usb: no adb (install Android Studio or use `nix develop .#android`); USB devices are skipped");
  process.exit(0);
}

const run = (...args: string[]): string => Bun.spawnSync([adb, ...args]).stdout.toString();

/** Serials of attached devices in a state: "device" (authorized) or "unauthorized" (prompt not confirmed yet). */
const devices = (state: string): string[] =>
  run("devices")
    .split("\n")
    .slice(1)
    .map((line) => line.trim().split(/\s+/))
    .filter(([, s]) => s === state)
    .map(([serial]) => serial!);

const missingPorts = (serial: string): string[] => {
  const reversed = run("-s", serial, "reverse", "--list");
  return ports.filter((port) => !reversed.includes(`tcp:${port} tcp:${port}`));
};

function reverse(serial: string): void {
  const missing = missingPorts(serial);
  for (const port of missing) run("-s", serial, "reverse", `tcp:${port}`, `tcp:${port}`);
  if (missing.length > 0) console.log(`usb: ${serial}: localhost:${missing.join(", localhost:")} -> this machine`);
}

const prompted = new Set<string>();
function askToAuthorize(serial: string): void {
  if (prompted.has(serial)) return;
  prompted.add(serial);
  console.log(`usb: ${serial}: confirm "Allow USB debugging" on the phone`);
}

function tick(): void {
  devices("unauthorized").forEach(askToAuthorize);
  devices("device").forEach(reverse);
}

console.log(`usb: waiting for Android devices (USB debugging on), ports ${ports.join(", ")}`);
tick();
setInterval(tick, 2000);
