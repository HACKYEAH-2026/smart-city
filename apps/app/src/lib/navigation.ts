import type { Href, useRouter } from "expo-router";

type AppRouter = ReturnType<typeof useRouter>;

/**
 * Back in the flow: pops the stack when there is a screen to return to, so the screen slides back the way it came;
 * otherwise (e.g. a deep link) goes to `fallback`.
 */
export function goBack(router: AppRouter, fallback: Href): void {
  if (router.canGoBack()) router.back();
  else router.replace(fallback);
}
