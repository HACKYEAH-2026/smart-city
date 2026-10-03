import { formatInviteCode } from "@app/shared";
import { Share as ShareIcon } from "lucide-react-native";
import { StyleSheet, View } from "react-native";
import { t } from "../texts";
import { radii, sizes, spacing } from "../theme";
import { Button } from "./Button";
import { Card } from "./Card";
import { Icon } from "./Icon";
import { QrCode } from "./QrCode";
import { Text } from "./Text";

export interface InviteCodeCardProps {
  /** Bare invite code ("KRKMST"); shown as "KRK-MST". */
  code: string;
  /** Link encoded in the QR code. */
  link: string;
  onShare: () => void;
}

/** Card with a place's QR code and invite code (COMPONENTS.md → QR / kod miejsca), with a share action. */
export function InviteCodeCard({ code, link, onShare }: InviteCodeCardProps) {
  return (
    <Card style={styles.card}>
      <View style={styles.row}>
        <QrCode value={link} size={sizes.qrCard} label={t.invite_qr_label} />
        <View style={styles.text}>
          <Text variant="label" color="textSecondary">
            {t.invite_code_label}
          </Text>
          <Text variant="codeXL">{formatInviteCode(code)}</Text>
          <Text variant="small" color="textSecondary">
            {t.invite_code_hint}
          </Text>
        </View>
      </View>
      <Button
        label={t.invite_share}
        variant="tint"
        size="md"
        leftIcon={<Icon icon={ShareIcon} color="primary" strokeWidth={2} />}
        onPress={onShare}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radii["4xl"], gap: spacing[9] },
  row: { flexDirection: "row", alignItems: "center", gap: spacing[9] },
  text: { flex: 1, gap: spacing[3] },
});
