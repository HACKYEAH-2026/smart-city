import { Text } from "./Text";

export interface FeedbackProps {
  /** What happened (role=status), e.g. "Zapisano zmiany.". */
  ok?: string | null;
  /** What went wrong (role=alert); shown instead of `ok`. */
  error?: string | null;
}

/** Feedback after an action: what went wrong (alert) or what happened (status); nothing without either. */
export function Feedback({ ok, error }: FeedbackProps) {
  if (error) {
    return (
      <Text variant="bodyL" color="primaryPressed" role="alert">
        {error}
      </Text>
    );
  }
  return ok ? (
    <Text variant="bodyL" color="textSecondary" role="status">
      {ok}
    </Text>
  ) : null;
}
