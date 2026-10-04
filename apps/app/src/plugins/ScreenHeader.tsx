import type { Action, ScreenAction, UINode } from "@app/plugin-sdk";
import { StyleSheet, View } from "react-native";
import { BackButton, Button, Heading, Icon, IconButton, Text } from "../components";
import { confirmDestructive } from "../lib/confirm";
import { t } from "../texts";
import { radii, sizes, spacing } from "../theme";
import { UI_ICON } from "./icons";

type ScreenNode = Extract<UINode, { type: "Screen" }>;

/**
 * A plugin screen's header (designs Z-Lista, Z-AdminPanel): the back button (none when the screen floats it over a
 * photo), the eyebrow over the title, and the screen's actions at the right: a dark pill with an icon and the label,
 * or a dark round icon button named by its label. An action with `confirm` (e.g. closing a discussion) asks first, in
 * the system dialog.
 */
export function PluginScreenHeader({
  node,
  backHref,
  onAction,
}: {
  node: ScreenNode;
  backHref: string | null;
  onAction: (action: Action) => void;
}) {
  const run = async (action: ScreenAction) => {
    const confirmed = action.confirm
      ? await confirmDestructive({
          title: action.confirm.title,
          message: action.confirm.message,
          confirm: action.confirm.confirmLabel,
          cancel: t.cancel,
        })
      : true;
    if (confirmed) onAction(action.action);
  };
  return (
    <View style={styles.row}>
      {backHref ? <BackButton href={backHref} /> : null}
      <View style={styles.text}>
        {node.eyebrow ? (
          <Text variant="sectionLabel" color="textSecondary" numberOfLines={1}>
            {node.eyebrow}
          </Text>
        ) : null}
        <Heading level={1} variant="headingS">
          {node.title}
        </Heading>
      </View>
      {(node.actions ?? []).map((action) =>
        action.variant === "icon" && action.icon ? (
          <IconButton
            key={action.label}
            icon={UI_ICON[action.icon]}
            label={action.label}
            variant="roundDark"
            onPress={() => run(action)}
          />
        ) : (
          <Button
            key={action.label}
            label={action.label}
            variant="dark"
            size="xs"
            fullWidth={false}
            leftIcon={
              action.icon ? (
                <Icon icon={UI_ICON[action.icon]} size={sizes.iconXs} color="onPrimary" strokeWidth={2} />
              ) : undefined
            }
            style={styles.pill}
            hitSlop={spacing[1]}
            onPress={() => run(action)}
          />
        ),
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: spacing[7] },
  text: { flex: 1, minWidth: 0, gap: spacing[1] },
  pill: { borderRadius: radii.pill },
});
