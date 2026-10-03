import { type CheckIssue, type CheckStage, PluginCheckError, PluginError } from "@app/plugin-sdk";
import { SchemaError } from "@app/plugin-sdk/engine";
import { typeIssues } from "./typecheck";

/**
 * The source stages of a plugin check (see `CHECK_STAGES` in the SDK): they read the source and run nothing.
 * The host runs them before `load` and `schema` (PluginHost.check / upload).
 */
const transpiler = new Bun.Transpiler({ loader: "ts" });

type BunSyntaxError = { message: string; position?: { line: number; column: number; lineText: string } | null };

/** The source parses as Bun will run it (Bun reports the first syntax error). */
export function checkSyntax(source: string): void {
  try {
    transpiler.transformSync(source);
  } catch (err) {
    throw new PluginCheckError("syntax", [syntaxIssue(err as BunSyntaxError)]);
  }
}

/** Nothing is imported at runtime: only `import type` (erased); the SDK comes from the factory argument. */
export function checkImports(source: string): void {
  const imports = transpiler.scan(source).imports;
  if (imports.length > 0)
    throw new PluginCheckError(
      "imports",
      imports.map((i) => importIssue(source, i.path)),
    );
}

/** The source type-checks against the plugin SDK, with no Bun/Node globals. */
export async function checkTypes(source: string): Promise<void> {
  const issues = await typeIssues(source);
  if (issues.length > 0) throw new PluginCheckError("types", issues);
}

/** `.catch(failAs("load"))`: a plugin or schema error becomes a failed check stage; anything else is rethrown. */
export const failAs =
  (stage: CheckStage) =>
  (err: unknown): never => {
    if (err instanceof PluginCheckError) throw err;
    if (err instanceof PluginError || err instanceof SchemaError)
      throw new PluginCheckError(stage, [{ message: err.message }]);
    throw err;
  };

const syntaxIssue = ({ message, position }: BunSyntaxError): CheckIssue =>
  position ? { message, line: position.line, column: position.column, snippet: position.lineText.trim() } : { message };

function importIssue(source: string, path: string): CheckIssue {
  const message = `Runtime import of "${path}": a plugin may only use \`import type\`; the SDK (definePlugin, ui, z, fileRef, t) is the factory argument`;
  const lines = source.split("\n");
  const index = lines.findIndex((line) => line.includes(`"${path}"`) || line.includes(`'${path}'`));
  return index < 0 ? { message } : { message, line: index + 1, snippet: lines[index]!.trim() };
}
