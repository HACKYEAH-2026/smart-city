import type { PluginModule } from "@app/plugin-sdk";
import announcements from "@plugins/announcements";
import discussions from "@plugins/discussions";
import disruptions from "@plugins/disruptions";
import events from "@plugins/events";
import faq from "@plugins/faq";
import groups from "@plugins/groups";
import help from "@plugins/help";
import issues from "@plugins/issues";
import market from "@plugins/market";
import questions from "@plugins/questions";

/** Plugins built into the API image (code in plugins/). New built-in plugin = package in plugins/ + entry here. */
export const builtinPlugins: PluginModule[] = [
  issues,
  announcements,
  discussions,
  disruptions,
  events,
  faq,
  groups,
  help,
  market,
  questions,
];
