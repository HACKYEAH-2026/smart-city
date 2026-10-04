import type { ToolAction, ViewParams } from "@app/plugin-sdk";
import type { FormValue } from "./context";

/**
 * A refresh takes the fields the server changed (a removed one disappears) and keeps the user's drafts in the rest.
 */
export function syncFormValues(
  draft: Record<string, FormValue>,
  before: Record<string, FormValue>,
  after: Record<string, FormValue>,
): Record<string, FormValue> {
  const names = [...new Set([...Object.keys(draft), ...Object.keys(before), ...Object.keys(after)])];
  return Object.fromEntries(
    names.flatMap((name) => {
      const changed = JSON.stringify(before[name]) !== JSON.stringify(after[name]);
      const value = changed ? after[name] : draft[name];
      return value === undefined ? [] : [[name, value]];
    }),
  );
}

/**
 * Pure state rules of the plugin renderer (no React Native here, so `bun test` covers them): save-on-change fields,
 * photo fields and sheet identity.
 */

/** A save-on-change field's change on its way to the server; null when nothing is being saved. */
export type Pending<T> = { value: T } | null;

/**
 * What a save-on-change field shows: the value being saved while its tool runs, else the one the server confirmed
 * (the node's current value). Clearing `pending` once the call settles rolls a failed change back and shows a
 * refreshed value as it comes.
 */
export const shownValue = <T>(confirmed: T | undefined, pending: Pending<T>): T | undefined =>
  pending ? pending.value : confirmed;

/** The tool call that saves a field's change: its value added to the tool's own args under the field's name. */
export const saveAction = (action: ToolAction, name: string, value: string | boolean): ToolAction => ({
  ...action,
  args: { ...action.args, [name]: value },
});

/**
 * A photo field's value in the form. One photo (`max` 1): its FileId, or nothing (the field is left out). Several:
 * always the list, empty included, so removing every photo is sent as such and never falls back to the tool's
 * own args.
 */
export function photoValue(max: number, files: string[]): string | string[] | undefined {
  return max > 1 ? files : files[0];
}

/** A sheet's identity: its view and params (in any order). A different identity is a different sheet. */
export function sheetKey(target: { view: string; params: ViewParams }): string {
  const params = Object.entries(target.params).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `${target.view}?${new URLSearchParams(params).toString()}`;
}
