import { useRouter } from "expo-router";
import Head from "expo-router/head";
import { ChevronLeft } from "lucide-react-native";
import { useState } from "react";
import { Button, Heading, IconButton, Screen, Text, TextField } from "../components";
import { useCreatePlace, useVisitPlace } from "../data/communities";
import { t } from "../texts";

/** Creates a place (name only) and opens it on the dashboard; the creator becomes its admin. */
export default function CreatePlaceForm() {
  const router = useRouter();
  const create = useCreatePlace();
  const visit = useVisitPlace();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    setError(null);
    create.mutate(name, {
      onSuccess: (place) => visit.mutate(place.slug, { onSuccess: () => router.replace("/app") }),
      onError: () => setError(t.create_error),
    });
  };

  return (
    <Screen chrome={false}>
      <Head>
        <title>{t.create_title}</title>
      </Head>
      <IconButton icon={ChevronLeft} label={t.back} onPress={() => router.replace("/app")} />
      <Heading level={1}>{t.create_title}</Heading>
      <TextField label={t.create_name} value={name} onChangeText={setName} onSubmitEditing={submit} />
      {error ? (
        <Text variant="bodyL" color="primaryPressed" role="alert">
          {error}
        </Text>
      ) : null}
      <Button label={t.create_submit} onPress={submit} disabled={!name.trim() || create.isPending} />
    </Screen>
  );
}
