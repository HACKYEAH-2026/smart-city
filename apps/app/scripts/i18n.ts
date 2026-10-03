/** Kompiluje komunikaty Paraglide do src/paraglide (Metro nie ma pluginu Paraglide). */
import { compile } from "@inlang/paraglide-js";
import { paraglide } from "../paraglide.config.ts";

await compile(paraglide);
console.log(`paraglide: skompilowano -> ${paraglide.outdir}`);
