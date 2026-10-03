import type { JoinRule } from "@app/shared";
import { t } from "../texts";

/** Who may join a place, as the "new place" wizard and the place's settings offer it (design E-NoweMiejsceDostep). */
export const JOIN_RULE_OPTIONS: { rule: JoinRule; label: string; hint: string; recommended?: boolean }[] = [
  { rule: "open", label: t.join_rule_open, hint: t.join_rule_open_hint },
  { rule: "approval", label: t.join_rule_approval, hint: t.join_rule_approval_hint, recommended: true },
  { rule: "invite", label: t.join_rule_invite, hint: t.join_rule_invite_hint },
];
