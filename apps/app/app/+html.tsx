import { ScrollViewStyleReset } from "expo-router/html";
import type { PropsWithChildren } from "react";
import { color } from "../src/theme";

/** Szkielet HTML dla statycznego eksportu web (tylko web, tylko build-time). */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover" />
        <meta name="theme-color" content={color.paper} />
        <ScrollViewStyleReset />
        <style>{`body{background-color:${color.paper}}::selection{background:${color.ink};color:${color.paper}}`}</style>
      </head>
      <body>{children}</body>
    </html>
  );
}
