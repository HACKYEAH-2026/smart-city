import type { MenuOption, UINode } from "@app/plugin-sdk";
import { ChevronDown } from "lucide-react-native";
import { useContext } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { BottomSheet, Chip, Icon, RadioCard, Text } from "../components";
import { tapFeedback } from "../lib/haptics";
import { borders, colors, opacity, radii, sizes, spacing } from "../theme";
import { ActionsContext } from "./context";
import { UI_ICON } from "./icons";

type MenuNode = Extract<UINode, { type: "Menu" }>;

/**
 * Pick one option now (design: sorting "Najwięcej głosów ▾", a report's category chip): the trigger shows the selected
 * option; it opens a bottom sheet with all of them as radios, and choosing one runs its action and closes it. Where
 * nothing can be drawn over the screen (a dashboard tile), the options are a row of chips in place.
 */
export function PluginMenu({ node }: { node: MenuNode }) {
  const { onAction, busy, showOverlay } = useContext(ActionsContext);
  const selected = node.options.find((option) => option.selected) ?? node.options[0];
  const locked = (option: MenuOption) => busy && option.action.type === "tool";
  if (!showOverlay) {
    return (
      <View role="radiogroup" aria-label={node.label} style={styles.chips}>
        {node.options.map((option) => (
          <Chip
            key={option.label}
            label={option.label}
            selected={option === selected}
            onPress={() => {
              if (!locked(option)) onAction(option.action);
            }}
          />
        ))}
      </View>
    );
  }
  const close = () => showOverlay(null);
  const choose = (option: MenuOption) => {
    close();
    if (option !== selected) onAction(option.action);
  };
  const open = () =>
    showOverlay(
      <BottomSheet visible scrollable title={node.label} onClose={close}>
        <View role="radiogroup" aria-label={node.label} style={styles.options}>
          {node.options.map((option) => (
            <RadioCard
              key={option.label}
              label={option.label}
              selected={option === selected}
              onPress={() => choose(option)}
            />
          ))}
        </View>
      </BottomSheet>,
    );
  const chip = node.variant === "chip";
  const disabled = node.options.some(locked);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${node.label}: ${selected?.label ?? ""}`}
      accessibilityState={{ disabled }}
      aria-haspopup="dialog"
      disabled={disabled}
      hitSlop={chip ? spacing[4] : spacing[2]}
      onPressIn={tapFeedback}
      onPress={open}
      style={({ pressed }) => [
        chip ? styles.chip : styles.text,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      {chip && node.icon ? (
        <Icon icon={UI_ICON[node.icon]} size={sizes.iconXs} color="primary" strokeWidth={2} />
      ) : null}
      <Text variant={chip ? "smallStrong" : "buttonS"}>{selected?.label}</Text>
      <Icon icon={ChevronDown} size={sizes.iconXs} color="text" strokeWidth={2.2} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing[4] },
  options: { gap: spacing[5] },
  text: {
    height: sizes.menuText,
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: spacing[2],
  },
  chip: {
    height: sizes.menuChip,
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: spacing[2],
    paddingHorizontal: spacing[5],
    borderRadius: radii.pill,
    borderWidth: borders.hairline,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  pressed: { opacity: opacity.pressed },
  disabled: { opacity: opacity.disabled },
});
