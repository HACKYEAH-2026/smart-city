import { Search, X } from "lucide-react-native";
import { Pressable, StyleSheet, TextInput, type TextInputProps, View } from "react-native";
import { tapFeedback } from "../lib/haptics";
import { t } from "../texts";
import { colors, radii, shadows, sizes, spacing, typography } from "../theme";
import { Icon } from "./Icon";

export interface SearchFieldProps extends Omit<TextInputProps, "onChangeText" | "value"> {
  /** Accessible name; also the placeholder. */
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  /** Enter / the keyboard's search key. */
  onSubmit: () => void;
}

/**
 * Search field over a map (COMPONENTS.md → SearchField): white, rounded, magnifier on the left, a clear button once
 * there is text. Searches on Enter (no request per keystroke).
 */
export function SearchField({ label, value, onChangeText, onSubmit, ...rest }: SearchFieldProps) {
  return (
    <View style={styles.field}>
      <Icon icon={Search} size={sizes.iconS} color="textSecondary" />
      <TextInput
        aria-label={label}
        placeholder={label}
        placeholderTextColor={colors.placeholder}
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmit}
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
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[5],
    height: sizes.input,
    paddingHorizontal: spacing[8],
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    ...shadows.floating,
  },
  input: { ...typography.input, flex: 1, height: "100%", color: colors.text },
});
