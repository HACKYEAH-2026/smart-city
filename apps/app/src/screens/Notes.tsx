import type { Note } from "@app/shared";
import { NOTE_TITLE_MAX } from "@app/shared";
import { useRouter } from "expo-router";
import Head from "expo-router/head";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { AppLink, Body, Button, Heading, Page, TextField } from "../components/ui";
import { useCreateNote, useDeleteNote, useNotes, useUpdateNote } from "../data/notes";
import { useAuthActions } from "../data/session";
import { useI18n } from "../lib/i18n";
import { color, radius, shadow, space } from "../theme";

/** WZORZEC EKRANU: lista (useQuery) + formularz (useMutation) + edycja w miejscu. */
export default function Notes() {
  const { t } = useI18n();
  const router = useRouter();
  const notes = useNotes();
  const create = useCreateNote();
  const auth = useAuthActions();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const add = () =>
    create.mutate(
      { title, body },
      {
        onSuccess: () => {
          setTitle("");
          setBody("");
        },
      },
    );

  return (
    <Page narrow>
      <Head>
        <title>{t.meta_app_title()}</title>
      </Head>
      <View style={styles.head}>
        <Heading level={1} size="section">
          {t.notes_title()}
        </Heading>
        <View style={styles.row}>
          <AppLink href="/app/c" variant="quiet">
            {t.nav_communities()}
          </AppLink>
          <Button
            label={t.notes_sign_out()}
            variant="quiet"
            onPress={async () => {
              await auth.signOut();
              router.replace("/login");
            }}
          />
        </View>
      </View>
      <View style={{ gap: space.l }}>
        <TextField label={t.notes_field_title()} value={title} onChangeText={setTitle} maxLength={NOTE_TITLE_MAX} />
        <TextField label={t.notes_field_body()} value={body} onChangeText={setBody} multiline />
        {create.isError ? (
          <Body tone="error" role="alert">
            {t.notes_save_error()}
          </Body>
        ) : null}
        <Button label={t.notes_add()} onPress={add} disabled={create.isPending || !title.trim()} />
      </View>
      {notes.isPending ? (
        <Body tone="soft">{t.loading()}</Body>
      ) : (
        <View role="list" aria-label={t.notes_list_label()} style={styles.list}>
          {notes.data?.length ? (
            notes.data.map((n) => <NoteItem key={n.id} note={n} />)
          ) : (
            <View role="listitem" style={styles.empty}>
              <Body tone="soft">{t.notes_empty()}</Body>
            </View>
          )}
        </View>
      )}
    </Page>
  );
}

function NoteItem(props: { note: Note }) {
  const { t } = useI18n();
  const update = useUpdateNote();
  const remove = useDeleteNote();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(props.note.title);
  const [body, setBody] = useState(props.note.body);

  return (
    <View role="listitem" style={styles.note}>
      {editing ? (
        <View style={{ gap: space.m }}>
          <TextField label={t.notes_field_title()} value={title} onChangeText={setTitle} maxLength={NOTE_TITLE_MAX} />
          <TextField label={t.notes_field_body()} value={body} onChangeText={setBody} multiline />
          <View style={styles.row}>
            <Button
              label={t.notes_save()}
              onPress={() =>
                update.mutate({ id: props.note.id, input: { title, body } }, { onSuccess: () => setEditing(false) })
              }
              disabled={update.isPending}
            />
            <Button label={t.notes_cancel()} variant="quiet" onPress={() => setEditing(false)} />
          </View>
        </View>
      ) : (
        <View style={{ gap: space.s }}>
          <Heading level={3}>{props.note.title}</Heading>
          {props.note.body ? <Body tone="soft">{props.note.body}</Body> : null}
          <View style={styles.row}>
            <Button label={t.notes_edit()} variant="quiet" onPress={() => setEditing(true)} />
            <Button
              label={t.notes_delete()}
              variant="danger"
              onPress={() => remove.mutate(props.note.id)}
              disabled={remove.isPending}
            />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  head: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: space.l,
    marginBottom: space.xl,
  },
  list: { marginTop: space.xxl, gap: space.l },
  note: { backgroundColor: color.sheet, borderRadius: radius.card, padding: space.xl, ...shadow.sheet },
  empty: {
    padding: space.xl,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: color.rule,
    borderRadius: radius.card,
  },
  row: { flexDirection: "row", flexWrap: "wrap", gap: space.s },
});
