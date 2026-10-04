import type { UINode } from "@app/plugin-sdk";
import { useState } from "react";
import { Image, ScrollView, StyleSheet, View } from "react-native";
import { Text } from "../components";
import { t } from "../texts";
import { colors, radii, sizes, spacing } from "../theme";

type GalleryNode = Extract<UINode, { type: "Gallery" }>;

/**
 * Photos to swipe through, one page each (4:3), with "1 / 2" in the corner when there are more (announced politely as
 * they change). `edgeToEdge`: the screen draws it across its full width at the top (a report's details), so no
 * rounded corners.
 */
export function PluginGallery({ node, edgeToEdge = false }: { node: GalleryNode; edgeToEdge?: boolean }) {
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);
  const count = node.items.length;
  return (
    <View style={[styles.frame, !edgeToEdge && styles.rounded]} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={(e) => {
          if (width) setIndex(Math.round(e.nativeEvent.contentOffset.x / width));
        }}
      >
        {node.items.map((item, i) => (
          <View
            // biome-ignore lint/suspicious/noArrayIndexKey: the photos keep their order; a file may repeat.
            key={`${item.file}-${i}`}
            role="img"
            aria-label={item.alt}
            style={[styles.page, { width }]}
          >
            {item.url ? <Image source={{ uri: item.url }} style={styles.photo} resizeMode="cover" /> : null}
          </View>
        ))}
      </ScrollView>
      {count > 1 ? (
        <View aria-live="polite" style={styles.counter}>
          <Text
            variant="smallStrong"
            color="onPrimary"
            accessibilityLabel={`${t.plugin_photo_number} ${index + 1} ${t.plugin_photo_of} ${count}`}
          >{`${index + 1} / ${count}`}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { width: "100%", aspectRatio: 4 / 3, overflow: "hidden", backgroundColor: colors.mapBase },
  rounded: { borderRadius: radii["3xl"] },
  page: { height: "100%" },
  photo: { width: "100%", height: "100%" },
  counter: {
    position: "absolute",
    right: spacing[6],
    bottom: spacing[6],
    height: sizes.photoPill,
    justifyContent: "center",
    paddingHorizontal: spacing[5],
    borderRadius: radii.pill,
    backgroundColor: colors.photoOverlay,
  },
});
