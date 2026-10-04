import { type LucideIcon, SendHorizontal } from "lucide-react-native";
import { useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import Animated, { LinearTransition, ZoomIn, ZoomOut } from "react-native-reanimated";
import { tapFeedback } from "../lib/haptics";
import { borders, colors, motion, opacity, radii, sizes, spacing, typography } from "../theme";
import { Icon } from "./Icon";

export interface MessageInputProps {
  /** Accessible name of the field; also its placeholder unless `placeholder` is given. */
  label: string;
  placeholder?: string;
  value: string;
  onChangeText: (text: string) => void;
  /** Accessible name of the send icon ("Wyślij"). */
  sendLabel: string;
  sendIcon?: LucideIcon;
  onSend: () => void;
  /** Sending: the icon stays, dimmed and not pressable. */
  busy?: boolean;
  /** Line breaks allowed and the field grows with the text; without it Enter sends. */
  multiline?: boolean;
}

/**
 * A message box (COMPONENTS.md → MessageInput): a quiet round field and, only once there is something to send, a send
 * icon without a background beside it (it pops in and the field makes room). A multiline field grows up to
 * `sizes.messageInputMax` and shrinks back when it is emptied.
 */
export function MessageInput({
  label,
  placeholder,
  value,
  onChangeText,
  sendLabel,
  sendIcon = SendHorizontal,
  onSend,
  busy = false,
  multiline = false,
}: MessageInputProps) {
  const [focused, setFocused] = useState(false);
  const [contentHeight, setContentHeight] = useState(0);
  const filled = value.trim() !== "";
  const send = () => {
    if (filled && !busy) onSend();
  };
  // Measured content (padding included, border not); an emptied field is one line again (the web reports no shrink).
  const height = value ? clamp(contentHeight + 2 * borders.hairline) : sizes.iconButton;
  return (
    <View style={styles.row}>
      <Animated.View style={styles.field} layout={LinearTransition.duration(motion.fast)}>
        <TextInput
          aria-label={label}
          placeholder={placeholder ?? label}
          placeholderTextColor={colors.placeholder}
          value={value}
          onChangeText={onChangeText}
          multiline={multiline}
          onContentSizeChange={(e) => setContentHeight(e.nativeEvent.contentSize.height)}
          returnKeyType={multiline ? "default" : "send"}
          // One line: Enter sends and the field keeps the focus (and the keyboard): submitBehavior on Android and iOS,
          // blurOnSubmit on the web (react-native-web).
          submitBehavior={multiline ? "newline" : "submit"}
          blurOnSubmit={multiline ? undefined : false}
          onSubmitEditing={multiline ? undefined : send}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[styles.input, { height }, focused && styles.focused]}
        />
      </Animated.View>
      {filled ? (
        <Animated.View entering={ZoomIn.duration(motion.fast)} exiting={ZoomOut.duration(motion.fast)}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={sendLabel}
            accessibilityState={{ disabled: busy }}
            disabled={busy}
            onPressIn={tapFeedback}
            onPress={send}
            style={({ pressed }) => [styles.send, pressed && styles.pressed, busy && styles.busy]}
          >
            <Icon icon={sendIcon} size={sizes.tabIcon} color="primary" strokeWidth={2} />
          </Pressable>
        </Animated.View>
      ) : null}
    </View>
  );
}

const clamp = (height: number) => Math.min(Math.max(height, sizes.iconButton), sizes.messageInputMax);

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-end", gap: spacing[2] },
  field: { flex: 1, minWidth: 0 },
  input: {
    ...typography.input,
    color: colors.text,
    backgroundColor: colors.surface,
    borderWidth: borders.hairline,
    borderColor: colors.border,
    borderRadius: radii.message,
    paddingHorizontal: spacing[8],
    // One line of text centred in the 44 dp field: (44 − 22 − 2 × 1 border) / 2.
    paddingVertical: spacing[5],
    textAlignVertical: "top",
    // Focus is the red border; the web's own focus outline would draw a second one around it (its `auto` style
    // ignores a zero width, so the style is set too).
    outlineStyle: "solid",
    outlineWidth: 0,
  },
  focused: { borderColor: colors.primary },
  send: { width: sizes.iconButton, height: sizes.iconButton, alignItems: "center", justifyContent: "center" },
  pressed: { opacity: opacity.pressed },
  busy: { opacity: opacity.disabled },
});
