import { type LoadedDefinition, PluginError } from "./load";

/**
 * Checking plugin source before it is uploaded (`POST /api/admin/plugins/check`, and every upload). Stages run
 * cheapest first and stop at the first failing one: `syntax`, `imports` (only `import type`), `types` (against
 * this SDK, with no Bun/Node globals), `safety` (no escape hatches out of ctx and the SDK), `load` (the factory
 * runs, the manifest is validated), `schema` (tables compared with the stored shape, nothing changed). Messages are
 * for the author (a person or an AI agent).
 */
export const CHECK_STAGES = ["syntax", "imports", "types", "safety", "load", "schema"] as const;
export type CheckStage = (typeof CHECK_STAGES)[number];

/** One problem in plugin source. `line` and `column` are 1-based; `snippet` is that source line, trimmed. */
export type CheckIssue = { message: string; line?: number; column?: number; snippet?: string };

/** What a plugin that passed every stage declares (to confirm it is what the author meant to build). */
export type PluginSummary = {
  id: string;
  version: string;
  name: string;
  icon: string;
  description: string;
  views: string[];
  dashboardWidgets: string[];
  tools: string[];
  streams: string[];
  tables: string[];
};

export type PluginCheck =
  | { status: "ok"; plugin: PluginSummary }
  | { status: "error"; stage: CheckStage; errors: CheckIssue[] };

export const summarize = ({ manifest, definition }: LoadedDefinition): PluginCheck => ({
  status: "ok",
  plugin: {
    id: manifest.id,
    version: manifest.version,
    name: manifest.name,
    icon: manifest.icon,
    description: manifest.description,
    views: Object.keys(definition.views),
    dashboardWidgets: Object.keys(definition.dashboardWidgets ?? {}),
    tools: Object.keys(definition.tools ?? {}),
    streams: Object.keys(definition.streams ?? {}),
    tables: Object.keys(definition.tables ?? {}),
  },
});

/** At most this many issues are reported; the rest are counted in a last issue. */
export const MAX_CHECK_ISSUES = 10;

/** A check stage failed. `message` lists the issues on one line (logs, the upload CLI). */
export class PluginCheckError extends PluginError {
  readonly errors: CheckIssue[];

  constructor(
    readonly stage: CheckStage,
    errors: CheckIssue[],
  ) {
    const capped = cap(errors);
    super(`${stage}: ${capped.map(describe).join("; ")}`);
    this.errors = capped;
  }

  get result(): PluginCheck {
    return { status: "error", stage: this.stage, errors: this.errors };
  }
}

const cap = (errors: CheckIssue[]): CheckIssue[] =>
  errors.length <= MAX_CHECK_ISSUES
    ? errors
    : [...errors.slice(0, MAX_CHECK_ISSUES), { message: `…and ${errors.length - MAX_CHECK_ISSUES} more` }];

const describe = (issue: CheckIssue) =>
  issue.line === undefined ? issue.message : `line ${issue.line}:${issue.column ?? 1}: ${issue.message}`;
