import type { CheckIssue } from "@app/plugin-sdk";
import type ts from "typescript";

type TS = typeof ts;

/**
 * The `safety` check stage: escape hatches out of what a plugin is given (ctx and the SDK). Plugins run in the API
 * process (docs/plugins.md, Security) and place admins write them with AI, so the source must not reach the host's
 * globals, mutate built-in objects or switch the type checker off. It reads the program the `types` stage built
 * (types are needed to spot calls through `any` or `Function`). A static guard, not a sandbox: see docs/plugins.md.
 */

/** Globals that reach the host (process, network, code evaluation) or the realm itself. */
const HOST_GLOBALS = new Set([
  "globalThis",
  "global",
  "self",
  "window",
  "process",
  "Bun",
  "Deno",
  "require",
  "module",
  "exports",
  "Function",
  "eval",
  "Reflect",
  "Proxy",
  "WebAssembly",
  "fetch",
  "WebSocket",
  "XMLHttpRequest",
  "Worker",
  "SharedArrayBuffer",
  "Atomics",
  "importScripts",
]);

/** Properties that lead to constructors, prototypes or property descriptors of shared objects. */
const UNSAFE_PROPERTIES = new Set([
  "constructor",
  "prototype",
  "__proto__",
  "caller",
  "callee",
  "__defineGetter__",
  "__defineSetter__",
  "__lookupGetter__",
  "__lookupSetter__",
  "defineProperty",
  "defineProperties",
  "setPrototypeOf",
]);

const TS_DIRECTIVE = /@ts-(ignore|expect-error|nocheck)\b/;

export function safetyIssues(ts: TS, program: ts.Program, file: ts.SourceFile, source: string): CheckIssue[] {
  const checker = program.getTypeChecker();
  const lines = source.split("\n");
  const declared = declaredNames(ts, file);
  const issue = (node: ts.Node, message: string): CheckIssue => {
    const { line, character } = file.getLineAndCharacterOfPosition(node.getStart(file));
    return { message, line: line + 1, column: character + 1, snippet: lines[line]?.trim() ?? "" };
  };
  const issues: CheckIssue[] = [...directiveIssues(lines)];
  const visit = (node: ts.Node): void => {
    const found = problemOf(ts, checker, declared, node);
    if (found) issues.push(issue(node, found));
    ts.forEachChild(node, visit);
  };
  visit(file);
  return issues;
}

/** What is wrong with this node, or null. */
function problemOf(ts: TS, checker: ts.TypeChecker, declared: Set<string>, node: ts.Node): string | null {
  if (ts.isIdentifier(node) && HOST_GLOBALS.has(node.text) && !isPropertyName(ts, node)) {
    return `'${node.text}' is not available to plugins: use only ctx and the SDK (ui, z, t, fileRef)`;
  }
  if (ts.isPropertyAccessExpression(node) && UNSAFE_PROPERTIES.has(node.name.text)) {
    return `'.${node.name.text}' is not allowed in plugins: it reaches the host's constructors and prototypes`;
  }
  if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) && isDeniedName(node.text)) {
    return `The string "${node.text}" is not allowed in plugins: it names a host global or an unsafe property`;
  }
  if (ts.isMetaProperty(node) && node.keywordToken === ts.SyntaxKind.ImportKeyword) {
    return "'import.meta' is not available to plugins";
  }
  if (hasDeclareModifier(ts, node) || ts.isModuleDeclaration(node)) {
    return "Ambient declarations ('declare', 'namespace', 'module') are not allowed: a plugin gets only ctx and the SDK";
  }
  const callee = calleeOf(ts, node);
  if (callee && isUntyped(ts, checker, checker.getTypeAtLocation(callee))) {
    return "Calling a value of type 'any' or 'Function' is not allowed: give it a function type";
  }
  const target = mutationTarget(ts, node);
  const root = target && rootIdentifier(ts, target);
  if (root && !declared.has(root.text)) {
    return `Changing '${target.getText()}' is not allowed: a plugin cannot modify built-in objects`;
  }
  return null;
}

const isDeniedName = (text: string) => HOST_GLOBALS.has(text) || UNSAFE_PROPERTIES.has(text);

/** `x.name`, `{ name: … }`, `name() {}` — the identifier names a property, it does not reference a global. */
function isPropertyName(ts: TS, node: ts.Identifier): boolean {
  const parent = node.parent;
  return (
    (ts.isPropertyAccessExpression(parent) && parent.name === node) ||
    ((ts.isPropertyAssignment(parent) ||
      ts.isMethodDeclaration(parent) ||
      ts.isPropertyDeclaration(parent) ||
      ts.isPropertySignature(parent) ||
      ts.isMethodSignature(parent) ||
      ts.isGetAccessorDeclaration(parent) ||
      ts.isSetAccessorDeclaration(parent)) &&
      parent.name === node)
  );
}

const hasDeclareModifier = (ts: TS, node: ts.Node) =>
  ts.canHaveModifiers(node) && (ts.getModifiers(node) ?? []).some((m) => m.kind === ts.SyntaxKind.DeclareKeyword);

/** What a call, `new` or tagged template calls; null for any other node. */
function calleeOf(ts: TS, node: ts.Node): ts.Expression | null {
  if (ts.isCallExpression(node) || ts.isNewExpression(node)) return node.expression;
  return ts.isTaggedTemplateExpression(node) ? node.tag : null;
}

/** `any` (anything goes) or the bare `Function` type (e.g. after `typeof x === "function"`): no checked signature. */
const isUntyped = (ts: TS, checker: ts.TypeChecker, type: ts.Type) =>
  (type.flags & ts.TypeFlags.Any) !== 0 || checker.typeToString(type) === "Function";

/** The member expression an assignment, `++`/`--` or `delete` changes, or null. */
function mutationTarget(ts: TS, node: ts.Node): ts.PropertyAccessExpression | ts.ElementAccessExpression | null {
  const member = (expr: ts.Expression) =>
    ts.isPropertyAccessExpression(expr) || ts.isElementAccessExpression(expr) ? expr : null;
  if (ts.isBinaryExpression(node) && isAssignment(ts, node.operatorToken.kind)) return member(node.left);
  if ((ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node)) && isIncrement(ts, node.operator)) {
    return member(node.operand);
  }
  if (ts.isDeleteExpression(node)) return member(node.expression);
  return null;
}

const isAssignment = (ts: TS, kind: ts.SyntaxKind) =>
  kind >= ts.SyntaxKind.FirstAssignment && kind <= ts.SyntaxKind.LastAssignment;

const isIncrement = (ts: TS, op: ts.SyntaxKind) =>
  op === ts.SyntaxKind.PlusPlusToken || op === ts.SyntaxKind.MinusMinusToken;

/** `a` of `a.b[c].d`; null when the chain starts elsewhere (a call, `this`, a literal). */
function rootIdentifier(ts: TS, expr: ts.Expression): ts.Identifier | null {
  if (ts.isIdentifier(expr)) return expr;
  if (ts.isPropertyAccessExpression(expr) || ts.isElementAccessExpression(expr)) {
    return rootIdentifier(ts, expr.expression);
  }
  if (ts.isParenthesizedExpression(expr) || ts.isNonNullExpression(expr)) return rootIdentifier(ts, expr.expression);
  return null;
}

/** Every name the plugin declares itself (variables, parameters, functions, classes, destructured bindings). */
function declaredNames(ts: TS, file: ts.SourceFile): Set<string> {
  const names = new Set<string>();
  const bind = (name: ts.BindingName): void => {
    if (ts.isIdentifier(name)) names.add(name.text);
    else for (const element of name.elements) if (!ts.isOmittedExpression(element)) bind(element.name);
  };
  const visit = (node: ts.Node): void => {
    if (ts.isVariableDeclaration(node) || ts.isParameter(node) || ts.isBindingElement(node)) bind(node.name);
    if ((ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) && node.name) names.add(node.name.text);
    ts.forEachChild(node, visit);
  };
  visit(file);
  return names;
}

/** `// @ts-expect-error` and friends switch the type checker off, and with it the checks of this stage. */
function directiveIssues(lines: string[]): CheckIssue[] {
  return lines.flatMap((text, index) => {
    const match = TS_DIRECTIVE.exec(text);
    return match
      ? [
          {
            message: `'${match[0]}' is not allowed: plugin code must type-check`,
            line: index + 1,
            column: match.index + 1,
            snippet: text.trim(),
          },
        ]
      : [];
  });
}
