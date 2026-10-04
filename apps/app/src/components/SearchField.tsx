import { Search, X } from "lucide-react-native";
import { Pressable, StyleSheet, TextInput, type TextInputProps, View } from "react-native";
import { tapFeedback } from "../lib/haptics";
import { t } from "../texts";
import { borders, colors, radii, shadows, sizes, spacing, typography } from "../theme";
import { Icon } from "./Icon";

export interface SearchFieldProps extends Omit<TextInputProps, "onChangeText" | "value"> {
  /** Accessible name; also the placeholder. */
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  /**
   * Enter / the keyboard's search key, with the field's text as submitted (not a state that may lag behind). Without
   * it the field filters as the user types (`onChangeText`).
   */
  onSubmit?: (text: string) => void;
  /** floating: over a map, in a row next to the back button (default) · outlined: a bordered field above a list. */
  variant?: "floating" | "outlined";
}

/**
 * Search field (COMPONENTS.md → SearchField): white, rounded, magnifier on the left, a clear button once there is
 * text. Over a map it floats and searches on Enter (no request per keystroke); above a list it has a border.
 */
export function SearchField({ label, value, onChangeText, onSubmit, variant = "floating", ...rest }: SearchFieldProps) {
  return (
    <View style={[styles.field, styles[variant]]}>
      <Icon icon={Search} size={sizes.iconS} color="textSecondary" />
      <TextInput
        aria-label={label}
        placeholder={label}
        placeholderTextColor={colors.placeholder}
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmit ? (e) => onSubmit(e.nativeEvent.text) : undefined}
        returnKeyType="search"
        autoCorrect={false}
        style={styles.input}
        {...rest}
      />
      {value ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t.search_clear}
          onPressIn={tapFeedback}
          onPress={() => onChangeText("")}
          hitSlop={spacing[5]}
        >
          <Icon icon={X} size={sizes.iconS} color="textSecondary" />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[5],
    paddingHorizontal: spacing[8],
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
  },
  floating: { flex: 1, height: sizes.input, ...shadows.floating },
  outlined: { height: sizes.inputS, borderWidth: borders.hairline, borderColor: colors.border },
  input: { ...typography.input, flex: 1, height: "100%", color: colors.text },
});
