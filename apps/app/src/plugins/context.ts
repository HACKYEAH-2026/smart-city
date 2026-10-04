import type { Action, GeoLocation } from "@app/plugin-sdk";
import type { ImagePickerAsset } from "expo-image-picker";
import { createContext, type ReactNode } from "react";

/** Uploads a photo from an ImagePicker field → FileId (provided by the screen, which knows the community and plugin). */
export type UploadImage = (asset: ImagePickerAsset) => Promise<string>;

/** `onSettled`: the tool call this action started has finished, failed or not (its view is already refreshed). */
export type ActionOptions = { onSettled?: () => void; onSuccess?: () => void };
export const InlineFormContext = createContext(false);

/**
 * What the plugin's nodes can do, provided by the screen that renders them. `onLongPress`: holding anything pressable
 * inside (the dashboard: admins enter edit mode from anywhere on a tile). `showOverlay`: draws something over the
 * whole screen, outside its scroll (a Menu's sheet); without it (a dashboard tile) a Menu shows its options in place.
 */
export type Actions = {
  onAction: (action: Action, options?: ActionOptions) => void;
  busy: boolean;
  upload: UploadImage;
  onLongPress?: () => void;
  showOverlay?: (overlay: ReactNode | null) => void;
};
export const ActionsContext = createContext<Actions>({
  onAction: () => {},
  busy: false,
  upload: () => Promise.reject(new Error("upload unavailable")),
});

/** Inside a dashboard Widget: cards render as compact rows, so a few of them fit in a tile. */
export const InWidgetContext = createContext(false);

/** Inside a grouped List: its items are rows of one white group, between hairlines. */
export const InGroupContext = createContext(false);
export const InSheetContext = createContext(false);

/** A form field's value: text, a switch's on/off, a place from a LocationInput, or several photos (FileIds). */
export type FormValue = string | boolean | GeoLocation | string[];
/** Form values; `undefined` removes the field (e.g. a removed photo does not end up in args). */
export type Form = { values: Record<string, FormValue>; set: (name: string, value: FormValue | undefined) => void };
/** The Form a field is in; null outside one (a standalone Switch or Select saves on change). */
export const FormContext = createContext<Form | null>(null);
