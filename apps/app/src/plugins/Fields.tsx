import type { GeoLocation, ToolAction, UINode } from "@app/plugin-sdk";
import { launchCameraAsync, launchImageLibraryAsync, type MediaType } from "expo-image-picker";
import { Camera, Image as GalleryIcon, type LucideIcon, MapPin, X } from "lucide-react-native";
import { useContext, useState } from "react";
import { Image, Modal, Pressable, StyleSheet, View } from "react-native";
import {
  BottomSheet,
  Button,
  Chip,
  ChoiceButton,
  Icon,
  MapView,
  RadioCard,
  SegmentedControl,
  SwitchRow,
  Text,
  TextField,
} from "../components";
import { tapFeedback } from "../lib/haptics";
import { STREET_ZOOM } from "../lib/map/spec";
import { photoLibraryOnly } from "../lib/photoPicker";
import LocationPicker from "../screens/LocationPicker";
import { t } from "../texts";
import { borders, colors, opacity, radii, sizes, spacing } from "../theme";
import { ActionsContext, FormContext, type FormValue, InGroupContext, InlineFormContext } from "./context";
import { UI_ICON } from "./icons";
import { type Pending, photoValue, saveAction, shownValue } from "./state";

type Of<T extends UINode["type"]> = Extract<UINode, { type: T }>;

const text = (value: FormValue | undefined) => (typeof value === "string" ? value : "");

/** Initial form field values (from `value` on nodes), including nested ones. */
export function initialValues(nodes: UINode[]): Record<string, FormValue> {
  const out: Record<string, FormValue> = {};
  const walk = (n: UINode) => {
    if ((n.type === "TextInput" || n.type === "Select" || n.type === "Switch") && n.value !== undefined) {
      out[n.name] = n.value;
    }
    if (n.type === "LocationInput" && n.value) out[n.name] = { address: "", ...n.value };
    const photos =
      n.type === "ImagePicker"
        ? photoValue(
            n.max ?? 1,
            (n.value ?? []).map((p) => p.file),
          )
        : undefined;
    if (n.type === "ImagePicker" && photos !== undefined) out[n.name] = photos;
    if ("children" in n) n.children?.forEach(walk);
  };
  nodes.forEach(walk);
  return out;
}

/**
 * A choice's current value and how to change it. In a Form: the form's value (sent on submit). Outside one: saved at
 * once by its tool with `[name]: value` added to its args; it shows the change while the tool runs, then the node's
 * value (the server's: a failed save rolls back, a refreshed view shows the new one). Disabled while any tool of the
 * view runs, and without a tool there is nothing to change.
 */
function useChoice<T extends string | boolean>(name: string, value: T | undefined, action: ToolAction | undefined) {
  const form = useContext(FormContext);
  const { onAction, busy } = useContext(ActionsContext);
  const [pending, setPending] = useState<Pending<T>>(null);
  if (form) {
    return { current: form.values[name], set: (next: T) => form.set(name, next), disabled: false, saving: false };
  }
  const save = (next: T) => {
    if (!action) return;
    setPending({ value: next });
    onAction(saveAction(action, name, next), { onSettled: () => setPending(null) });
  };
  return { current: shownValue(value, pending), set: save, disabled: busy || !action, saving: busy };
}

export function FormTextInput({ node }: { node: Of<"TextInput"> }) {
  const form = useContext(FormContext);
  const inline = useContext(InlineFormContext);
  return (
    <TextField
      label={node.label}
      hideLabel={inline}
      variant={inline ? "pill" : node.variant}
      multiline={node.multiline}
      helper={node.hint}
      placeholder={node.placeholder}
      value={text(form?.values[node.name])}
      onChangeText={(v) => form?.set(node.name, v)}
    />
  );
}

/** A photo picked or prefilled: its FileId and what to preview (the device's file or the signed URL). */
type Photo = { file: string; uri?: string };

/**
 * Photo picker: camera or gallery → upload → FileId in the form field; previews with a remove button each, and the
 * add tiles until `max` photos are in. Prefilled photos (`value`, a previous step) start the list.
 */
export function FormImagePicker({ node }: { node: Of<"ImagePicker"> }) {
  const form = useContext(FormContext);
  const { upload, showOverlay } = useContext(ActionsContext);
  const max = node.max ?? 1;
  const [photos, setPhotos] = useState<Photo[]>(() => (node.value ?? []).map((p) => ({ file: p.file, uri: p.url })));
  const [state, setState] = useState<"idle" | "uploading" | "error">("idle");
  const save = (next: Photo[]) => {
    setPhotos(next);
    form?.set(
      node.name,
      photoValue(
        max,
        next.map((photo) => photo.file),
      ),
    );
  };

  // The camera or the gallery; either way the photo is uploaded and its FileId goes into the form.
  const pick = async (fromCamera: boolean) => {
    const options: { mediaTypes: MediaType[]; quality: number } = { mediaTypes: ["images"], quality: 0.7 };
    const res = fromCamera ? await launchCameraAsync(options) : await launchImageLibraryAsync(options);
    const asset = res.canceled ? undefined : res.assets[0];
    if (!asset) return;
    setState("uploading");
    try {
      save([...photos, { file: await upload(asset), uri: asset.uri }]);
      setState("idle");
    } catch (error) {
      console.warn("plugin photo upload failed", { mime: asset.mimeType, name: asset.fileName, error });
      setState("error");
    }
  };
  const uploading = state === "uploading";
  const add = () => {
    if (photoLibraryOnly || !showOverlay) {
      void pick(false);
      return;
    }
    const choose = (camera: boolean) => {
      showOverlay(null);
      void pick(camera);
    };
    showOverlay(
      <BottomSheet visible title={node.label} onClose={() => showOverlay(null)}>
        <Button
          label={t.plugin_photo_camera}
          leftIcon={<Icon icon={Camera} color="onPrimary" />}
          onPress={() => choose(true)}
        />
        <Button
          label={t.plugin_photo_gallery}
          variant="secondary"
          leftIcon={<Icon icon={GalleryIcon} />}
          onPress={() => choose(false)}
        />
      </BottomSheet>,
    );
  };

  return (
    <View style={styles.stackTight}>
      {node.hideLabel ? null : (
        <Text variant="sectionLabel" color="textSecondary">
          {node.label}
        </Text>
      )}
      <View role="group" aria-label={node.label} style={styles.photoRow}>
        {photos.map((photo, i) => (
          <View key={photo.file} style={styles.photoTile}>
            {photo.uri ? (
              <Image
                source={{ uri: photo.uri }}
                style={styles.photoImage}
                accessible
                accessibilityRole="image"
                accessibilityLabel={
                  max > 1
                    ? `${t.plugin_photo_number} ${i + 1} ${t.plugin_photo_of} ${photos.length}`
                    : t.plugin_photo_preview
                }
              />
            ) : (
              <View style={[styles.photoImage, styles.photoPlaceholder]} />
            )}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={max > 1 ? `${t.plugin_photo_remove} ${i + 1}` : t.plugin_photo_remove}
              disabled={uploading}
              onPress={() => save(photos.filter((other) => other !== photo))}
              style={styles.photoRemove}
            >
              <Icon icon={X} size={sizes.photoRemoveIcon} color="onPrimary" strokeWidth={2.6} />
            </Pressable>
          </View>
        ))}
        {photos.length < max ? (
          <AddPhotoTile icon={Camera} label={t.plugin_photo_add} disabled={uploading} onPress={add} />
        ) : null}
      </View>
      {uploading ? (
        <Text variant="caption" color="textSecondary">
          {t.plugin_photo_uploading}
        </Text>
      ) : null}
      {state === "error" ? (
        <Text variant="bodyL" color="primaryPressed" role="alert">
          {t.plugin_photo_error}
        </Text>
      ) : null}
    </View>
  );
}

/** A square dashed tile that adds a photo (design: "Dodaj"): an icon and its label under it. */
function AddPhotoTile({
  icon,
  label,
  disabled,
  onPress,
}: {
  icon: LucideIcon;
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPressIn={tapFeedback}
      onPress={onPress}
      style={({ pressed }) => [styles.addTile, pressed && styles.pressed, disabled && styles.disabled]}
    >
      <Icon icon={icon} size={sizes.iconS} color="textSecondary" strokeWidth={2} />
      <Text variant="small" color="textSecondary">
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * A place on the map: a button opens the app's location picker (address search, the user's position, a pin) over the
 * form; once picked, a still map with the pin, the address and buttons to change or remove it.
 */
export function FormLocationInput({ node }: { node: Of<"LocationInput"> }) {
  const form = useContext(FormContext);
  const [picking, setPicking] = useState(false);
  const current = form?.values[node.name];
  const value: GeoLocation | undefined = typeof current === "object" && !Array.isArray(current) ? current : undefined;
  return (
    <View style={styles.stackTight}>
      <Text variant="sectionLabel" color="textSecondary">
        {node.label}
      </Text>
      {value ? (
        <View style={styles.locationCard}>
          <MapView
            // A new place starts a new preview: the map's first view is its only one.
            key={`${value.lat},${value.lng}`}
            label={t.plugin_location_preview}
            center={value}
            zoom={STREET_ZOOM}
            pins={[{ id: "picked", title: value.address || node.label, lat: value.lat, lng: value.lng }]}
            interactive={false}
            style={styles.locationPreview}
          />
          <View style={styles.locationAddress}>
            <Icon icon={MapPin} size={sizes.iconS} color="primary" />
            <Text variant="caption" style={styles.grow}>
              {value.address || node.label}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t.plugin_location_change}
              hitSlop={spacing[4]}
              onPressIn={tapFeedback}
              onPress={() => setPicking(true)}
            >
              <Text variant="buttonS" color="primary">
                {t.plugin_location_change}
              </Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Button
          label={t.plugin_location_pick}
          variant="secondary"
          leftIcon={<Icon icon={MapPin} size={sizes.iconS} color="primary" />}
          onPress={() => setPicking(true)}
        />
      )}
      {picking ? (
        <Modal visible animationType="slide" onRequestClose={() => setPicking(false)}>
          <LocationPicker
            title={node.label}
            hint={t.plugin_location_hint}
            initial={value ?? null}
            onCancel={() => setPicking(false)}
            onConfirm={({ location, address }) => {
              form?.set(node.name, { ...location, address });
              setPicking(false);
            }}
          />
        </Modal>
      ) : null}
    </View>
  );
}

/**
 * One of the options, as a radio group (same code native and web, keyboard accessible): large cards in two columns
 * (`cards`, the default), a row of pills (`chips`), a segmented track (`segmented`) or a column of radio cards with
 * the hint under each (`radio`). Outside a Form a choice saves at once (see useChoice).
 */
export function FormSelect({ node }: { node: Of<"Select"> }) {
  const choice = useChoice(node.name, node.value, node.action);
  const choose = (value: string) => {
    if (!choice.disabled && value !== choice.current) choice.set(value);
  };
  return (
    <View style={styles.stackTight} aria-busy={choice.saving}>
      <Text variant="sectionLabel" color="textSecondary">
        {node.label}
      </Text>
      <SelectOptions node={node} current={choice.current} disabled={choice.disabled} choose={choose} />
    </View>
  );
}

/** The options of a Select as radios, in its variant's look; `disabled` (saving) dims and locks each of them. */
function SelectOptions({
  node,
  current,
  disabled,
  choose,
}: {
  node: Of<"Select">;
  current: FormValue | undefined;
  disabled: boolean;
  choose: (value: string) => void;
}) {
  switch (node.variant) {
    case "chips":
      return (
        <View role="radiogroup" aria-label={node.label} style={styles.chips}>
          {node.options.map((o) => (
            <Chip
              key={o.value}
              label={o.label}
              selected={o.value === current}
              disabled={disabled}
              onPress={() => choose(o.value)}
            />
          ))}
        </View>
      );
    case "segmented":
      return (
        <SegmentedControl
          kind="radio"
          label={node.label}
          options={node.options.map((o) => ({ value: o.value, label: o.label }))}
          value={typeof current === "string" ? current : ""}
          disabled={disabled}
          onChange={choose}
        />
      );
    case "radio":
      return (
        <View role="radiogroup" aria-label={node.label} style={styles.radios}>
          {node.options.map((o) => (
            <RadioCard
              key={o.value}
              label={o.label}
              description={o.hint}
              selected={o.value === current}
              disabled={disabled}
              onPress={() => choose(o.value)}
            />
          ))}
        </View>
      );
    default:
      return (
        <View role="radiogroup" aria-label={node.label} style={styles.cards}>
          {node.options.map((o) => (
            <ChoiceButton
              key={o.value}
              icon={o.icon ? UI_ICON[o.icon] : undefined}
              label={o.label}
              selected={o.value === current}
              disabled={disabled}
              onPress={() => choose(o.value)}
            />
          ))}
        </View>
      );
  }
}

/** A yes/no field as a switch row (a flush row inside a grouped list); the tool gets a boolean. */
export function FormSwitch({ node }: { node: Of<"Switch"> }) {
  const choice = useChoice(node.name, node.value, node.action);
  const inGroup = useContext(InGroupContext);
  return (
    <SwitchRow
      label={node.label}
      hint={node.hint}
      value={choice.current === true}
      flush={inGroup}
      disabled={choice.disabled}
      onChange={choice.set}
    />
  );
}

const styles = StyleSheet.create({
  photoRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing[4] },
  // No overflow clipping on the tile: the remove button sits over its corner. The rounding clips the photo only.
  photoTile: { width: sizes.photoTile, height: sizes.photoTile },
  photoImage: { width: "100%", height: "100%", borderRadius: radii.xl, overflow: "hidden" },
  photoPlaceholder: { backgroundColor: colors.mapBase },
  photoRemove: {
    position: "absolute",
    top: -spacing[2],
    right: -spacing[2],
    width: sizes.photoRemove,
    height: sizes.photoRemove,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.text,
    borderWidth: borders.selected,
    borderColor: colors.background,
  },
  addTile: {
    width: sizes.photoTile,
    height: sizes.photoTile,
    borderRadius: radii.xl,
    borderWidth: borders.row,
    borderStyle: "dashed",
    borderColor: colors.dashed,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing[2],
  },
  pressed: { opacity: opacity.pressed },
  disabled: { opacity: opacity.disabled },
  stackTight: { gap: spacing[2] },
  cards: { flexDirection: "row", gap: spacing[4] },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing[4] },
  radios: { gap: spacing[4] },
  row: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing[4] },
  locationPreview: {
    height: sizes.compactLocationPreview,
  },
  locationCard: {
    borderRadius: radii.lg,
    overflow: "hidden",
    backgroundColor: colors.surface,
    borderWidth: borders.hairline,
    borderColor: colors.border,
  },
  locationAddress: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[5],
    padding: spacing[8],
    minHeight: sizes.input,
  },
  grow: { flex: 1, minWidth: 0 },
});
