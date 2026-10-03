import { useRouter } from "expo-router";
import Head from "expo-router/head";
import { ChevronLeft } from "lucide-react-native";
import { Heading, IconButton, Screen, Text } from "../components";
import { t } from "../texts";

/** Joining a place: placeholder until the join screens are built. */
export default function JoinPlace() {
  const router = useRouter();
  return (
    <Screen chrome={false}>
      <Head>
        <title>{t.join_title}</title>
      </Head>
      <IconButton icon={ChevronLeft} label={t.back} onPress={() => router.replace("/app")} />
      <Heading level={1}>{t.join_title}</Heading>
      <Text variant="bodyL" color="textSecondary">
        {t.join_body}
      </Text>
    </Screen>
  );
}
