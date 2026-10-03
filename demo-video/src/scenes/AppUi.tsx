import type React from "react";
import { View } from "react-native";
import { AbsoluteFill } from "remotion";
import { Button, Card, colors, Heading, layout, spacing, Text, TextField } from "../app-ui";
import { useIn } from "../theme";

// fadeUp() for react-native styles (RN transforms are objects, not CSS strings).
const rise = (p: number) => ({ opacity: p, transform: [{ translateY: (1 - p) * 24 }] });

// Starter scene built from the app's own design-system components (apps/app/src/components).
export const AppUi: React.FC = () => {
  const card = useIn(5);
  const cta = useIn(25);
  return (
    <AbsoluteFill style={{ backgroundColor: colors.background, alignItems: "center", justifyContent: "center" }}>
      <View style={{ width: 880, gap: layout.sectionGap, ...rise(card) }}>
        <Card style={{ gap: layout.sectionGap, padding: spacing[12] }}>
          <Heading level={1}>Twoje Miejsce</Heading>
          <Text variant="bodyL" color="textSecondary">
            Zgłoś problem w swojej okolicy — miasto dowie się o nim od razu.
          </Text>
          <TextField label="Opis" value="Nie świeci latarnia przy ul. Długiej 12." editable={false} />
        </Card>
        <View style={{ flexDirection: "row", gap: spacing[6], ...rise(cta) }}>
          <Button label="Wyślij zgłoszenie" fullWidth={false} />
          <Button label="Anuluj" variant="secondary" fullWidth={false} />
        </View>
      </View>
    </AbsoluteFill>
  );
};
