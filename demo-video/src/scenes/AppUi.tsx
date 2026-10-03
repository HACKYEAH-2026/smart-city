import type React from "react";
import { View } from "react-native";
import { AbsoluteFill } from "remotion";
import { Body, Button, color, Heading, radius, shadow, space, TextField } from "../app-ui";
import { useIn } from "../theme";

// fadeUp() for react-native styles (RN transforms are objects, not CSS strings).
const rise = (p: number) => ({ opacity: p, transform: [{ translateY: (1 - p) * 24 }] });

// Starter scene built from the app's own components (apps/app/src/components/ui.tsx).
export const AppUi: React.FC = () => {
  const card = useIn(5);
  const cta = useIn(25);
  return (
    <AbsoluteFill style={{ backgroundColor: color.paper, alignItems: "center", justifyContent: "center" }}>
      <View
        style={{
          width: 880,
          gap: space.xl,
          padding: space.section,
          backgroundColor: color.sheet,
          borderRadius: radius.card,
          ...shadow.sheet,
          ...rise(card),
        }}
      >
        <Heading level={1}>Twoje Miejsce</Heading>
        <Body size="lead">Zgłoś problem w swojej okolicy — miasto dowie się o nim od razu.</Body>
        <TextField label="Opis" value="Nie świeci latarnia przy ul. Długiej 12." editable={false} />
        <View style={{ flexDirection: "row", gap: space.m, ...rise(cta) }}>
          <Button label="Wyślij zgłoszenie" />
          <Button label="Anuluj" variant="quiet" />
        </View>
      </View>
    </AbsoluteFill>
  );
};
