import type { MetaItem } from "@app/plugin-sdk";
import { Fragment, useContext } from "react";
import { StyleSheet, View } from "react-native";
import { Icon, Text } from "../components";
import { relativeTime } from "../lib/relativeTime";
import { sizes, spacing } from "../theme";
import { InWidgetContext } from "./context";
import { UI_ICON } from "./icons";

const SEPARATOR = "·";

/** What a meta item says: a moment as the app words it ("3 dni temu"), else its text (or its screen-reader label). */
export const metaText = (item: MetaItem, now: Date, style: "long" | "short"): string =>
  "at" in item ? relativeTime(item.at, now, style) : (item.label ?? item.text);

/**
 * A meta line (a Card's `meta`, a `Meta` node): its items joined with dots, in `small` `textSecondary`. A moment is
 * "3 dni temu" ("3 dni" in a widget); an item with an icon draws it and is announced by its `label`.
 */
export function MetaLine({ items }: { items: MetaItem[] }) {
  const style = useContext(InWidgetContext) ? "short" : "long";
  const now = new Date();
  return (
    <View style={styles.line}>
      {items.map((item, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: the items keep their order; their texts may repeat.
        <Fragment key={i}>
          {i > 0 && !("icon" in item && item.icon) ? (
            <Text variant="small" color="textSecondary" aria-hidden>
              {SEPARATOR}
            </Text>
          ) : null}
          <MetaPiece item={item} text={"at" in item ? relativeTime(item.at, now, style) : item.text} />
        </Fragment>
      ))}
    </View>
  );
}

function MetaPiece({ item, text }: { item: MetaItem; text: string }) {
  if (!("icon" in item) || !item.icon) {
    return (
      <Text variant="small" color="textSecondary" accessibilityLabel={"label" in item ? item.label : undefined}>
        {text}
      </Text>
    );
  }
  return (
    <View accessible accessibilityLabel={item.label ?? text} style={styles.piece}>
      <Icon icon={UI_ICON[item.icon]} size={sizes.iconXs} color="textSecondary" strokeWidth={2} />
      <Text variant="small" color="textSecondary">
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  line: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: spacing[3], rowGap: spacing[1] },
  piece: { flexDirection: "row", alignItems: "center", gap: spacing[2] },
});
