import type { ReactNode } from "react";
import { Screen } from "./Screen";
import { Text } from "./Text";

export interface NoticeScreenProps {
  /** The screen's header, the same as when its content shows (e.g. `TitleHeader`). */
  header: ReactNode;
  text: string;
  /** Something went wrong (role=alert), not just a state such as loading. */
  alert?: boolean;
}

/**
 * A screen that shows one message under its header instead of its content: loading, could not load, or not allowed
 * (e.g. a place's admin screens opened by a member).
 */
export function NoticeScreen({ header, text, alert = false }: NoticeScreenProps) {
  return (
    <Screen chrome={false}>
      {header}
      <Text variant="bodyL" color="textSecondary" role={alert ? "alert" : undefined}>
        {text}
      </Text>
    </Screen>
  );
}
