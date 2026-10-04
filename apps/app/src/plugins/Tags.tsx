import type { CardTag } from "@app/plugin-sdk";
import { X } from "lucide-react-native";
import { useContext } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Badge, Icon, Text } from "../components";
import { tapFeedback } from "../lib/haptics";
import { t } from "../texts";
import { borders, colors, opacity, radii, sizes, spacing } from "../theme";
import { ActionsContext } from "./context";
import { UI_ICON } from "./icons";
import { toBadgeTone } from "./tone";

/** A wrapping row of tags (a Tags node, a card's tags): badges, or removable chips when a tag has `onRemove`. */
export function TagList({ items }: { items: CardTag[] }) {
  return (
    <View style={styles.tags}>
      {items.map((tag, i) =>
        tag.onRemove || tag.variant === "pill" ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: tags keep their order; the text may repeat.
          <RemovableTag key={`${tag.text}-${i}`} tag={tag} onRemove={tag.onRemove} />
        ) : (
          <Badge
            // biome-ignore lint/suspicious/noArrayIndexKey: as above.
            key={`${tag.text}-${i}`}
            text={tag.text}
            tone={toBadgeTone(tag.tone)}
            icon={tag.icon ? UI_ICON[tag.icon] : undefined}
            dot={tag.dot}
          />
        ),
      )}
    </View>
  );
}

/** An outlined pill with the tag's text and an "X" that runs its `onRemove` tool (e.g. deleting a category). */
function RemovableTag({ tag, onRemove }: { tag: CardTag; onRemove?: CardTag["onRemove"] }) {
  const { onAction, busy } = useContext(ActionsContext);
  return (
    <View style={[styles.removable, !onRemove && styles.fixed]}>
      <Text variant="buttonS">{tag.text}</Text>
      {onRemove ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${t.plugin_tag_remove}: ${tag.text}`}
          accessibilityState={{ disabled: busy }}
          disabled={busy}
          hitSlop={spacing[4]}
          onPressIn={tapFeedback}
          onPress={() => onAction(onRemove)}
          style={({ pressed }) => [styles.remove, pressed && styles.pressed, busy && styles.disabled]}
        >
          <Icon icon={X} size={sizes.iconXs} color="iconMuted" strokeWidth={2.4} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tags: { flexDirection: "row", flexWrap: "wrap", gap: spacing[2] },
  fixed: { paddingRight: spacing[7] },
  removable: {
    height: sizes.removableTag,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[2],
    paddingLeft: spacing[7],
    paddingRight: spacing[2],
    borderRadius: radii.pill,
    borderWidth: borders.hairline,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  remove: {
    width: sizes.removableTagButton,
    height: sizes.removableTagButton,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: { opacity: opacity.pressed },
  disabled: { opacity: opacity.disabled },
});
