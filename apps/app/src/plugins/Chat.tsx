import type { UINode } from "@app/plugin-sdk";
import { SendHorizontal } from "lucide-react-native";
import { useContext, useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { Icon, Text } from "../components";
import { tapFeedback } from "../lib/haptics";
import { initials } from "../lib/places";
import { messageTime } from "../lib/relativeTime";
import { t } from "../texts";
import { borders, colors, opacity, radii, shadows, sizes, spacing, typography } from "../theme";
import { blockPlaces } from "./chatBlocks";
import { ActionsContext } from "./context";

type ChatNode = Extract<UINode, { type: "Chat" }>;
type ChatMessage = ChatNode["messages"][number];

/**
 * A messenger-like chat (packages/sdk Chat): the viewer's bubbles on the right in the brand colour, the others' on the
 * left in white. Consecutive messages of one person make one block (chatBlocks.ts) with the name above it and the
 * initials beside its last bubble. No clock times on screen; a screen reader hears each message's time.
 */
export function ChatThread({ node }: { node: ChatNode }) {
  const places = blockPlaces(node.messages);
  return (
    <View role="list" aria-label={node.label} style={styles.chat}>
      {node.messages.map((message, i) => (
        <ChatBubble
          key={message.id}
          message={message}
          first={places[i]?.first ?? true}
          last={places[i]?.last ?? true}
        />
      ))}
    </View>
  );
}

function ChatBubble({ message, first, last }: { message: ChatMessage; first: boolean; last: boolean }) {
  const mine = Boolean(message.mine);
  const who = mine ? t.plugin_chat_you : message.person;
  const note = message.note ? ` (${message.note})` : "";
  // The joined corners of a block are tighter, like in a messenger.
  const corners = mine
    ? { borderTopRightRadius: first ? radii["2xl"] : radii.xs, borderBottomRightRadius: last ? radii["2xl"] : radii.xs }
    : { borderTopLeftRadius: first ? radii["2xl"] : radii.xs, borderBottomLeftRadius: last ? radii["2xl"] : radii.xs };
  return (
    <View
      role="listitem"
      accessible
      accessibilityLabel={`${who}, ${messageTime(message.at)}: ${message.text}${note}`}
      style={first ? styles.blockStart : undefined}
    >
      <View style={[styles.row, mine && styles.rowMine]}>
        {mine ? null : last ? (
          <View style={styles.avatar}>
            <Text variant="chip" color="primary">
              {initials(message.person)}
            </Text>
          </View>
        ) : (
          <View style={styles.avatarSpace} />
        )}
        <View style={[styles.column, mine && styles.columnMine]}>
          {first && !mine ? (
            <Text variant="small" color="textSecondary" style={styles.aside}>
              {message.person}
            </Text>
          ) : null}
          <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs, corners]}>
            <Text variant="body" color={mine ? "onPrimary" : "text"}>
              {message.text}
            </Text>
          </View>
          {message.note ? (
            <Text variant="small" color="textSecondary" style={styles.aside}>
              {message.note}
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}

/**
 * A message field with a round send button (packages/sdk Composer); PluginView pins it above the keyboard. One line,
 * Enter sends; the field empties at once and keeps the focus (and the keyboard), like in a messenger.
 */
export function MessageComposer({ node }: { node: Extract<UINode, { type: "Composer" }> }) {
  const { onAction, busy } = useContext(ActionsContext);
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);
  const message = value.trim();
  const blocked = !message || busy;
  const send = () => {
    if (blocked) return;
    onAction({ ...node.submit, args: { ...node.submit.args, [node.name]: message } });
    setValue("");
  };
  return (
    <View style={styles.composer}>
      <TextInput
        accessibilityLabel={node.label}
        placeholder={node.placeholder ?? node.label}
        placeholderTextColor={colors.placeholder}
        value={value}
        onChangeText={setValue}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        returnKeyType="send"
        onSubmitEditing={send}
        // Keep the focus after Enter: submitBehavior on Android and iOS, blurOnSubmit on the web (react-native-web).
        submitBehavior="submit"
        blurOnSubmit={false}
        style={[styles.input, focused && styles.inputFocused, focused && shadows.focusRing]}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={node.sendLabel}
        accessibilityState={{ disabled: blocked }}
        disabled={blocked}
        onPressIn={tapFeedback}
        onPress={send}
        style={({ pressed }) => [styles.send, blocked && styles.sendBlocked, pressed && styles.sendPressed]}
      >
        <Icon icon={SendHorizontal} size={sizes.iconS} color="onPrimary" strokeWidth={2.2} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  chat: { gap: spacing[1] },
  blockStart: { paddingTop: spacing[4] },
  row: { flexDirection: "row", alignItems: "flex-end", gap: spacing[4] },
  rowMine: { justifyContent: "flex-end" },
  avatar: {
    width: sizes.avatarSm,
    height: sizes.avatarSm,
    borderRadius: radii.pill,
    backgroundColor: colors.primaryTint,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarSpace: { width: sizes.avatarSm },
  column: { maxWidth: "78%", alignItems: "flex-start", gap: spacing[1] },
  columnMine: { alignItems: "flex-end" },
  aside: { paddingHorizontal: spacing[5] },
  bubble: { paddingVertical: spacing[4], paddingHorizontal: spacing[6], borderRadius: radii["2xl"] },
  bubbleMine: { backgroundColor: colors.primary },
  bubbleTheirs: {
    backgroundColor: colors.surface,
    borderWidth: borders.hairline,
    borderColor: colors.borderSubtle,
  },
  composer: { flexDirection: "row", alignItems: "center", gap: spacing[4] },
  input: {
    ...typography.input,
    flex: 1,
    height: sizes.iconButton,
    paddingHorizontal: spacing[8],
    borderRadius: sizes.iconButton / 2,
    borderWidth: borders.hairline,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    color: colors.text,
  },
  // Like TextField: a 2 px brand border, the padding 1 px smaller so the text stays in place.
  inputFocused: {
    borderWidth: borders.selected,
    borderColor: colors.primary,
    paddingHorizontal: spacing[8] - (borders.selected - borders.hairline),
  },
  send: {
    width: sizes.iconButton,
    height: sizes.iconButton,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
  },
  sendBlocked: { opacity: opacity.disabled },
  sendPressed: { opacity: opacity.pressed },
});
