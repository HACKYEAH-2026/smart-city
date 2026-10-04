import { BottomSheet, Text } from "../components";
import { usePluginView } from "../data/communities";
import { t } from "../texts";
import { type SheetTarget, usePluginActions } from "./actions";
import { InSheetContext, type UploadImage } from "./context";
import { PluginRenderer } from "./Renderer";
import { sheetKey } from "./state";

/**
 * A plugin view as a bottom sheet over the screen at `here` (design Z-Polaczono: "Czy to ten sam problem?"): its
 * eyebrow and title head the sheet, its content below (scrolling when taller than the screen). The screen under it
 * stays mounted, so closing the sheet returns to it as it was (a typed form included). In the sheet: a tool result
 * that presents another sheet shows it here instead (a fresh tree: no form or state of the previous view), one that
 * navigates closes the sheet and opens the view, `close` and any other success close it. While its tool runs the
 * sheet cannot be dismissed: the result must reach it (it may open the next view).
 */
export function PluginSheet({
  slug,
  plugin,
  target,
  here,
  upload,
  onOpen,
  onClose,
}: {
  slug: string;
  plugin: string;
  target: SheetTarget;
  here: string;
  upload: UploadImage;
  onOpen: (target: SheetTarget) => void;
  onClose: () => void;
}) {
  const view = usePluginView(slug, plugin, target.view, target.params);
  const actions = usePluginActions(slug, plugin, { here, openSheet: onOpen, closeSheet: onClose, onStay: onClose });
  const node = view.data?.type === "Screen" ? view.data : undefined;
  return (
    <BottomSheet
      visible
      scrollable
      dismissible={!actions.busy}
      title={node?.title ?? t.loading}
      eyebrow={node?.eyebrow}
      accentEyebrow
      onClose={onClose}
    >
      {actions.toolError ? (
        <Text variant="bodyL" color="primaryPressed" role="alert">
          {actions.toolError}
        </Text>
      ) : null}
      {actions.failed ? (
        <Text variant="bodyL" color="primaryPressed" role="alert">
          {t.plugin_action_error}
        </Text>
      ) : null}
      {node ? (
        <InSheetContext.Provider value={true}>
          <PluginRenderer
            key={sheetKey(target)}
            node={node}
            onAction={actions.onAction}
            busy={actions.busy}
            upload={upload}
          />
        </InSheetContext.Provider>
      ) : view.isError ? (
        <Text variant="bodyL" color="primaryPressed" role="alert">
          {t.plugin_load_error}
        </Text>
      ) : null}
    </BottomSheet>
  );
}
