import type { PluginModule } from "@app/shared";
import issues from "./issues";

/** Wtyczki wbudowane w obraz API. Nowa wbudowana wtyczka = plik obok + wpis tutaj. */
export const builtinPlugins: PluginModule[] = [issues];
