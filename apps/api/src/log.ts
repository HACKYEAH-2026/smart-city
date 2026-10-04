import { AsyncLocalStorage } from "node:async_hooks";

/**
 * The API's log, the only one (Biome's noConsole holds in apps/api/src). One line per event, on stdout (debug, info)
 * or stderr (warn, error): JSON in production (NODE_ENV=production, for a log collector), readable text elsewhere
 * (dev, E2E). LOG_LEVEL is the least important level written: debug | info (default) | warn | error | silent;
 * scripts/bun-test.ts makes tests silent unless it is set. Fields of the surrounding request or background job
 * (`withLogFields`: the request id, a plugin version being written) join every line logged inside it.
 *
 *   const log = logger("builder");
 *   log.warn("version failed", { reason: "timeout", err });
 */
const LEVELS = { debug: 10, info: 20, warn: 30, error: 40, silent: 99 } as const;
export type LogLevel = keyof typeof LEVELS;
export const LOG_LEVELS = Object.keys(LEVELS) as [LogLevel, ...LogLevel[]];
type Level = Exclude<LogLevel, "silent">;
type LineFormat = { json: boolean; color: boolean };
export type LogFields = Record<string, unknown>;
export type Logger = Record<Level, (message: string, fields?: LogFields) => void>;

/** Longer strings are cut (a whole plugin source, a model's essay): one event stays one readable line. */
const STRING_MAX = 4000;
/** Nesting kept in fields (a library's object may point back at itself). */
const DEPTH_MAX = 8;
/** Own fields of an error worth keeping (an OpenAI APIError's status, code, type, requestID…); objects are skipped. */
const PRIMITIVE = new Set(["string", "number", "boolean"]);

const isLevel = (value: string | undefined): value is LogLevel => value !== undefined && value in LEVELS;
// From process.env, not Env: modules log before createApp gets one (env.ts validates the value at startup).
const threshold = LEVELS[isLevel(process.env.LOG_LEVEL) ? process.env.LOG_LEVEL : "info"];
const format: LineFormat = {
  json: process.env.NODE_ENV === "production",
  color: process.env.NODE_ENV !== "production" && Boolean(process.stdout.isTTY) && !process.env.NO_COLOR,
};
const context = new AsyncLocalStorage<LogFields>();

/** Runs `fn` with `fields` on every line logged inside it, including work it starts and does not await. */
export const withLogFields = <T>(fields: LogFields, fn: () => T): T =>
  context.run({ ...context.getStore(), ...fields }, fn);

export function logger(scope: string): Logger {
  const at =
    (level: Level) =>
    (message: string, fields: LogFields = {}) =>
      write(level, scope, message, fields);
  return { debug: at("debug"), info: at("info"), warn: at("warn"), error: at("error") };
}

/**
 * A console-shaped logger for libraries that take one (Strands Agents, Better Auth): string arguments make the
 * message, an Error becomes `err`, anything else `args`.
 */
export function libraryLogger(scope: string): Record<Level, (...args: unknown[]) => void> {
  const log = logger(scope);
  const at =
    (level: Level) =>
    (...args: unknown[]) => {
      const err = args.find((a) => a instanceof Error);
      const rest = args.filter((a) => typeof a !== "string" && a !== err);
      const message = args.filter((a) => typeof a === "string").join(" ");
      log[level](message, { ...(err ? { err } : {}), ...(rest.length ? { args: rest } : {}) });
    };
  return { debug: at("debug"), info: at("info"), warn: at("warn"), error: at("error") };
}

function write(level: Level, scope: string, message: string, fields: LogFields): void {
  if (LEVELS[level] < threshold) return;
  const line = render(level, scope, message, fields, format);
  (LEVELS[level] >= LEVELS.warn ? process.stderr : process.stdout).write(`${line}\n`);
}

/** One log line (without the newline), with the fields of the surrounding `withLogFields`. */
export function render(level: Level, scope: string, message: string, fields: LogFields, as: LineFormat): string {
  // Stacks only on errors: a warning's cause is in its message, a stack would bury it.
  const stacks: string[] | null = level === "error" ? [] : null;
  const data = serialize({ ...context.getStore(), ...fields }, stacks) as LogFields;
  if (!as.json) return textLine(level, scope, message, data, stacks ?? [], as.color);
  return JSON.stringify({
    time: new Date().toISOString(),
    level,
    scope,
    msg: message,
    ...data,
    ...(stacks?.length ? { stack: stacks.join("\n") } : {}),
  });
}

/** Plain JSON data: errors as { name, message, own primitive fields, cause }, long strings cut; stacks go to `stacks`. */
function serialize(value: unknown, stacks: string[] | null, depth = 0): unknown {
  if (typeof value === "string") return clip(value);
  if (typeof value === "bigint") return value.toString();
  if (!value || typeof value !== "object") return value;
  if (depth > DEPTH_MAX) return "[…]";
  if (value instanceof Error) return serializeError(value, stacks, depth);
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map((v) => serialize(v, stacks, depth + 1));
  return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, serialize(v, stacks, depth + 1)]));
}

function serializeError(err: Error, stacks: string[] | null, depth: number): LogFields {
  if (err.stack) stacks?.push(clip(err.stack));
  const own = Object.entries(err).filter(([k, v]) => PRIMITIVE.has(typeof v) && k !== "message" && k !== "stack");
  return {
    name: err.name,
    message: clip(err.message),
    ...Object.fromEntries(own),
    ...(err.cause !== undefined ? { cause: serialize(err.cause, stacks, depth + 1) } : {}),
  };
}

const clip = (s: string) => (s.length > STRING_MAX ? `${s.slice(0, STRING_MAX)}… (+${s.length - STRING_MAX})` : s);

const TINT: Record<Level, string> = { debug: "\x1b[90m", info: "\x1b[36m", warn: "\x1b[33m", error: "\x1b[31m" };

/** `12:00:01.234 WARN  builder  version failed: timeout plugin=ai-1 n=2 ms=300004`, then an error's stacks. */
function textLine(level: Level, scope: string, message: string, data: LogFields, stacks: string[], color: boolean) {
  const paint = (code: string, s: string) => (color ? `${code}${s}\x1b[0m` : s);
  const time = new Date().toISOString().slice(11, 23);
  const pairs = Object.entries(data)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${paint("\x1b[2m", `${k}=`)}${textValue(v)}`);
  const head = [paint("\x1b[2m", time), paint(TINT[level], level.toUpperCase().padEnd(5)), paint("\x1b[1m", scope)];
  const tail = stacks.map((stack) => paint("\x1b[2m", stack.replace(/^/gm, "    ")));
  return [[...head, message, ...pairs].join(" "), ...tail].join("\n");
}

const textValue = (v: unknown) => (typeof v === "string" && /^[^\s"=]+$/.test(v) ? v : JSON.stringify(v));
