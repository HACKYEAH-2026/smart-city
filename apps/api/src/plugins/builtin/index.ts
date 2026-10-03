import type { PluginModule } from "@app/plugin-sdk";
import issues from "@plugins/issues";

/** Wtyczki wbudowane w obraz API (kod w plugins/). Nowa wbudowana wtyczka = pakiet w plugins/ + wpis tutaj. */
export const builtinPlugins: PluginModule[] = [issues];
