import { Redirect, useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import { Screen, Text } from "../components";
import { useCommunities, useVisitPlace } from "../data/communities";
import { t } from "../texts";

/**
 * /app/c/<slug>: the place on the dashboard. Opening it makes it the last visited place, which the dashboard shows;
 * the account's places and a notification that points to no view of its plugin lead here.
 */
export default function OpenPlace() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  // Observed here, so the visit's refetch of the places ends before the dashboard reads them (else it would show,
  // and visit again, the place it showed before).
  useCommunities();
  const visit = useVisitPlace();
  const { mutate } = visit;
  useEffect(() => {
    mutate(slug);
  }, [slug, mutate]);
  if (visit.isSuccess || visit.isError) return <Redirect href="/app" />;
  return (
    <Screen chrome={false}>
      <Text variant="bodyL" color="textSecondary">
        {t.loading}
      </Text>
    </Screen>
  );
}
