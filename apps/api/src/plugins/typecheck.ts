import { existsSync, readFileSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import type { CheckIssue } from "@app/plugin-sdk";
import type ts from "typescript";
import { safetyIssues } from "./safety";

type TS = typeof ts;

/**
 * A read-only file system for type checking plugin source: every file, directory and symlink the TypeScript
 * compiler found while checking a probe plugin (the SDK sources, the types they import, the ES standard library),
 * with paths relative to the repo root. Whatever was not recorded does not exist, so plugin code sees
 * `@app/plugin-sdk` and ES2023 only: no Bun or Node globals (`process`, `require`, `fetch`, `console`).
 */
export type TypeFs = {
  options: ts.CompilerOptions;
  libDir: string;
  files: Record<string, string>;
  dirs: string[];
  links: Record<string, string>;
};

type Fs = {
  read: (path: string) => string | undefined;
  dirExists: (path: string) => boolean;
  realpath: (path: string) => string;
};

/** Where plugin source sits in the file system (relative to the root): one file, as uploaded. */
const PLUGIN_FILE = "plugins/__check__/plugin.ts";
const PROBE = 'import type { PluginModule } from "@app/plugin-sdk";\nexport type Probe = PluginModule;\n';
/** Root of the recorded file system when checking; it does not exist on disk. */
const VIRTUAL_ROOT = "/plugin-check";
const REPO_ROOT = join(import.meta.dir, "../../../..");
/** Written next to the production bundle by scripts/build.ts (the image has no repo to record from). */
const SNAPSHOT_FILE = join(import.meta.dir, "plugin-types.json");
/** Quoted types longer than this are cut in messages (the useful part, e.g. "Did you mean …?", follows them). */
const MAX_TYPE_LENGTH = 100;

const typescript = async (): Promise<TS> => (await import("typescript")).default;

/** Records the TypeFs from the repo: at build time, and on the first check in dev and tests. */
export async function recordTypeFs(root: string = REPO_ROOT): Promise<TypeFs> {
  const ts = await typescript();
  const options = compilerOptions(ts, root);
  const libDir = dirname(ts.getDefaultLibFilePath(options));
  const plugin = join(root, PLUGIN_FILE);
  const recorder = recordingFs(ts, root, plugin);
  const host = compilerHost(ts, recorder.fs, root, libDir, (path, text, lang) => ts.createSourceFile(path, text, lang));
  const program = ts.createProgram([plugin], options, host);
  const issues = issuesOf(ts, program, PROBE);
  if (issues.length > 0) throw new Error(`plugin types: the probe does not type-check: ${issues[0]?.message}`);
  return { options, libDir: recorder.key(libDir), ...recorder.snapshot() };
}

/** One plugin source compiled: its type errors, and the `safety` stage's issues (computed on demand, same program). */
export type Analysis = { types: CheckIssue[]; safety: () => CheckIssue[] };

/**
 * Compiles plugin source over a recorded TypeFs (never the disk). Parsed library files are kept between calls;
 * the plugin source is parsed on every call.
 */
export function createAnalyzer(ts: TS, typeFs: TypeFs): (source: string) => Analysis {
  const plugin = `${VIRTUAL_ROOT}/${PLUGIN_FILE}`;
  const mounted = mount(typeFs);
  const parsed = new Map<string, ts.SourceFile>();
  const libDir = `${VIRTUAL_ROOT}/${typeFs.libDir}`;
  const sourceFile = (path: string, text: string, lang: ts.ScriptTarget | ts.CreateSourceFileOptions) =>
    path === plugin
      ? ts.createSourceFile(path, text, lang)
      : cached(parsed, path, () => ts.createSourceFile(path, text, lang));
  return (source) => {
    const fs: Fs = { ...mounted, read: (path) => (path === plugin ? source : mounted.read(path)) };
    const program = ts.createProgram([plugin], typeFs.options, compilerHost(ts, fs, VIRTUAL_ROOT, libDir, sourceFile));
    const file = program.getSourceFile(plugin);
    return {
      types: issuesOf(ts, program, source),
      safety: () => (file ? safetyIssues(ts, program, file, source) : []),
    };
  };
}

/** A type checker over a recorded TypeFs: the type errors of plugin source (empty = none). */
export const createTypeChecker = (ts: TS, typeFs: TypeFs): ((source: string) => CheckIssue[]) => {
  const analyze = createAnalyzer(ts, typeFs);
  return (source) => analyze(source).types;
};

let defaultAnalyzer: Promise<(source: string) => Analysis> | undefined;
/** The last analysis: the `types` and `safety` stages of one check share a program. */
let last: { source: string; analysis: Analysis } | undefined;

async function analysis(source: string): Promise<Analysis> {
  defaultAnalyzer ??= loadAnalyzer();
  const analyze = await defaultAnalyzer;
  if (last?.source !== source) last = { source, analysis: analyze(source) };
  return last.analysis;
}

/** Type errors in plugin source, checked against the plugin SDK; empty = none. */
export const typeIssues = async (source: string): Promise<CheckIssue[]> => (await analysis(source)).types;

/** Escape hatches out of ctx and the SDK (see safety.ts); empty = none. Run after `typeIssues` found none. */
export const unsafeIssues = async (source: string): Promise<CheckIssue[]> => (await analysis(source)).safety();

async function loadAnalyzer() {
  const ts = await typescript();
  const typeFs = existsSync(SNAPSHOT_FILE)
    ? (JSON.parse(readFileSync(SNAPSHOT_FILE, "utf8")) as TypeFs)
    : await recordTypeFs();
  return createAnalyzer(ts, typeFs);
}

/** tsconfig.base.json, without ambient types (no `bun`): a plugin gets only what the SDK passes it. */
function compilerOptions(ts: TS, root: string): ts.CompilerOptions {
  const { config } = ts.readConfigFile(join(root, "tsconfig.base.json"), ts.sys.readFile);
  const { options, errors } = ts.convertCompilerOptionsFromJson(config?.compilerOptions, root);
  if (errors.length > 0) throw new Error(`plugin types: tsconfig.base.json: ${errors[0]?.messageText}`);
  return { ...options, types: [], noEmit: true };
}

/**
 * The disk, as the compiler sees it, recording what exists. Paths outside the root count as missing (also
 * when recording), so checking from the snapshot finds exactly what recording found.
 */
function recordingFs(ts: TS, root: string, plugin: string) {
  const files: Record<string, string> = {};
  const dirs = new Set<string>();
  const links: Record<string, string> = {};
  const key = (path: string) => relative(root, path).split(sep).join("/");
  const inside = (path: string) => !key(path).startsWith("..");
  const read = (path: string) => (inside(path) ? ts.sys.readFile(path) : undefined);
  const fs: Fs = {
    read: (path) => (path === plugin ? PROBE : remember(files, key(path), read(path))),
    dirExists: (path) => inside(path) && ts.sys.directoryExists(path) && Boolean(dirs.add(key(path))),
    realpath: (path) => {
      const real = ts.sys.realpath?.(path) ?? path;
      if (real === path || !inside(real) || !inside(path)) return path;
      links[key(path)] = key(real);
      return real;
    },
  };
  return { fs, key, snapshot: () => ({ files, dirs: [...dirs], links }) };
}

function mount(typeFs: TypeFs): Fs {
  const at = (key: string) => (key ? `${VIRTUAL_ROOT}/${key}` : VIRTUAL_ROOT);
  const files = new Map(Object.entries(typeFs.files).map(([key, text]) => [at(key), text]));
  const dirs = new Set(typeFs.dirs.map(at));
  const links = new Map(Object.entries(typeFs.links).map(([key, target]) => [at(key), at(target)]));
  return {
    read: (path) => files.get(path),
    dirExists: (path) => dirs.has(path),
    realpath: (path) => links.get(path) ?? path,
  };
}

function compilerHost(
  ts: TS,
  fs: Fs,
  cwd: string,
  libDir: string,
  sourceFile: (path: string, text: string, lang: ts.ScriptTarget | ts.CreateSourceFileOptions) => ts.SourceFile,
): ts.CompilerHost {
  return {
    getSourceFile: (path, lang) => {
      const text = fs.read(path);
      return text === undefined ? undefined : sourceFile(path, text, lang);
    },
    getDefaultLibFileName: (options) => `${libDir}/${ts.getDefaultLibFileName(options)}`,
    getDefaultLibLocation: () => libDir,
    writeFile: () => {},
    getCurrentDirectory: () => cwd,
    getCanonicalFileName: (path) => path,
    useCaseSensitiveFileNames: () => true,
    getNewLine: () => "\n",
    fileExists: (path) => fs.read(path) !== undefined,
    readFile: (path) => fs.read(path),
    directoryExists: (path) => fs.dirExists(path),
    realpath: (path) => fs.realpath(path),
    getDirectories: () => [],
  };
}

/** Diagnostics of the plugin file (and of the configuration, which would be a host bug), as issues. */
function issuesOf(ts: TS, program: ts.Program, source: string): CheckIssue[] {
  const file = program.getRootFileNames()[0];
  const sourceFile = file ? program.getSourceFile(file) : undefined;
  const lines = source.split("\n");
  return [
    ...program.getOptionsDiagnostics(),
    ...program.getGlobalDiagnostics(),
    ...program.getSyntacticDiagnostics(sourceFile),
    ...program.getSemanticDiagnostics(sourceFile),
  ].map((diagnostic) => toIssue(ts, diagnostic, lines));
}

function toIssue(ts: TS, diagnostic: ts.Diagnostic, lines: string[]): CheckIssue {
  const message = explainGlobals(shortenTypes(ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")));
  if (!diagnostic.file || diagnostic.start === undefined) return { message };
  const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
  return { message, line: line + 1, column: character + 1, snippet: lines[line]?.trim() ?? "" };
}

/** Quoted segments are matched pairwise (left to right), so text between two quotes is never taken for a type. */
const shortenTypes = (message: string) =>
  message.replace(/'([^'\n]*)'/g, (quoted, type: string) =>
    type.length > MAX_TYPE_LENGTH ? `'${type.slice(0, 60)}…'` : quoted,
  );

/** TypeScript suggests installing Node/Bun types or the DOM lib; for a plugin the answer is "not available". */
const explainGlobals = (message: string) =>
  message.replace(
    /^Cannot find name '([^']+)'\. Do you need to[\s\S]*$/,
    "Cannot find name '$1': a plugin gets no Bun, Node or browser globals, only ES2023 and the SDK (ctx, ui, z, t, fileRef).",
  );

function remember(files: Record<string, string>, key: string, text: string | undefined) {
  if (text !== undefined) files[key] = text;
  return text;
}

function cached<K, V>(map: Map<K, V>, key: K, create: () => V): V {
  const hit = map.get(key);
  if (hit !== undefined) return hit;
  const value = create();
  map.set(key, value);
  return value;
}
