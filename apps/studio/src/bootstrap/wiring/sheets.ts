import type { EditorStore } from '@core/editor/store/EditorStore';
import type { RefreshDocumentAction } from '@core/editor/actions/RefreshDocumentAction';
import type { DocumentDeriver } from '@core/editor/services/DocumentDeriver';
import { SheetColorPalette } from '@core/sheets/services/SheetColorPalette';
import { CssMinifier, CssVarReferenceScanner } from '@tscaps/engine';
import { DisconnectedControlFinder } from '@core/sheets/services/DisconnectedControlFinder';
import { DecorationPlacementResolver } from '@core/effect/services/DecorationPlacementResolver';
import { DecorationVisibility } from '@core/captions/services/DecorationVisibility';
import { DecorationFilter } from '@core/captions/services/DecorationFilter';
import { StyleAssetUsageInspector } from '@core/sheets/services/StyleAssetUsageInspector';
import { LinkedSheetsPropagationNotifier } from '@core/sheets/services/LinkedSheetsPropagationNotifier';
import { LinkedSheetsSync } from '@core/sheets/services/LinkedSheetsSync';
import type { TemplatesModule } from '@bootstrap/wiring/templates';
import type { TelemetryModule } from '@bootstrap/wiring/telemetry';
import { HookTemplatePicker } from '@core/sheets/services/HookTemplatePicker';
import { SetHookScenesAction } from '@core/sheets/actions/SetHookScenesAction';
import { CreateSheetAction } from '@core/sheets/actions/CreateSheetAction';
import { RenameSheetAction } from '@core/sheets/actions/RenameSheetAction';
import { DeleteSheetAction } from '@core/sheets/actions/DeleteSheetAction';
import { AssignSegmentSheetAction } from '@core/sheets/actions/AssignSegmentSheetAction';
import { SetActiveSheetAction } from '@core/sheets/actions/SetActiveSheetAction';
import { CopyStylesFromSheetAction } from '@core/sheets/actions/CopyStylesFromSheetAction';
import { LinkSheetAction } from '@core/sheets/actions/LinkSheetAction';
import { UnlinkSheetAction } from '@core/sheets/actions/UnlinkSheetAction';
import { SheetMatcherRegistry } from '@core/sheet-matchers/services/SheetMatcherRegistry';
import { SpeakerSheetMatcher } from '@core/sheet-matchers/services/SpeakerSheetMatcher';
import { TagSheetMatcher } from '@core/sheet-matchers/services/TagSheetMatcher';
import { RunSheetMatcherAction } from '@core/sheet-matchers/actions/RunSheetMatcherAction';
import { SetTemplateAction } from '@core/sheets/actions/SetTemplateAction';
import { UpdateSheetTextDirectionAction } from '@core/sheets/actions/UpdateSheetTextDirectionAction';
import { UpdateStyleControlAction } from '@core/sheets/actions/style/UpdateStyleControlAction';
import { UpdateSheetVariantAction } from '@core/sheets/actions/style/UpdateSheetVariantAction';
import { UpdateSegmentSplitterConfigAction } from '@core/sheets/actions/style/UpdateSegmentSplitterConfigAction';
import { UpdateLineSplitterConfigAction } from '@core/sheets/actions/style/UpdateLineSplitterConfigAction';
import { UpdateAlignmentAction } from '@core/sheets/actions/style/UpdateAlignmentAction';
import { UpdateTypographyAction } from '@core/sheets/actions/style/UpdateTypographyAction';
import { UpdateRotationAction } from '@core/sheets/actions/style/UpdateRotationAction';
import { UpdateSheetCssOverrideAction } from '@core/sheets/actions/style/UpdateSheetCssOverrideAction';
import { UpdateSheetFiltersSvgOverrideAction } from '@core/sheets/actions/style/UpdateSheetFiltersSvgOverrideAction';
import { UpdateEffectsAction } from '@core/sheets/actions/style/UpdateEffectsAction';
import { AnimationSupportResolver } from '@core/templates/services/animations/AnimationSupportResolver';
import { ResetSheetMotionAction } from '@core/sheets/actions/style/ResetSheetMotionAction';
import { ResetSheetSliceAction } from '@core/sheets/actions/style/ResetSheetSliceAction';
import { SetStyleAssetAction } from '@core/sheets/actions/style/SetStyleAssetAction';
import { AnimationValueComposer } from '@core/elements/services/css/AnimationValueComposer';
import { ReplaceSheetAnimationAction } from '@core/sheets/actions/style/ReplaceSheetAnimationAction';
import { TuneSheetAnimationAction } from '@core/sheets/actions/style/TuneSheetAnimationAction';
import type { ElementAnimationCssBuilder } from '@core/elements/services/animation/ElementAnimationCssBuilder';
import type { ElementAnimationCssWriter } from '@core/elements/services/css/ElementAnimationCssWriter';
import type { SheetElementResolver } from '@core/sheets/domain/SheetElementResolver';

export interface SheetsDependencies {
  readonly store: EditorStore;
  readonly refresh: RefreshDocumentAction;
  readonly deriver: DocumentDeriver;
  readonly templates: TemplatesModule;
  readonly telemetry: TelemetryModule;
  readonly animationCssBuilder: ElementAnimationCssBuilder;
  readonly animationCssWriter: ElementAnimationCssWriter;
  readonly sheetElementResolver: SheetElementResolver;
}

export type SheetsModule = ReturnType<typeof bootSheets>;

/**
 * Boots the sheets feature: per-sheet CRUD actions, the matcher
 * registry plus its built-in auto-assignment matchers (speaker, tag),
 * the style-update actions the sidebar drives, and the typography +
 * segment-color services consumed by both the preview overlay and the
 * export pipeline.
 */
export function bootSheets(deps: SheetsDependencies) {
  const palette = new SheetColorPalette();
  const matcherRegistry = new SheetMatcherRegistry([
    new SpeakerSheetMatcher(),
    new TagSheetMatcher(),
  ]);
  const linkedSheetsPropagationNotifier = new LinkedSheetsPropagationNotifier();
  const linkedSheetsSync = new LinkedSheetsSync(linkedSheetsPropagationNotifier);
  const updateControl = new UpdateStyleControlAction(deps.store, deps.refresh, linkedSheetsSync);
  return {
    matcherRegistry,
    disconnectedControlFinder: new DisconnectedControlFinder(new CssMinifier(), new CssVarReferenceScanner()),
    palette,
    linkedSheetsPropagationNotifier,
    linkedSheetsSync,
    decorationPlacementResolver: new DecorationPlacementResolver(),
    decorationFilter: new DecorationFilter(new DecorationVisibility()),
    assetUsageInspector: new StyleAssetUsageInspector(),
    actions: {
      sheets: {
        create: new CreateSheetAction(deps.store, palette),
        setHookScenes: new SetHookScenesAction(
          deps.store,
          deps.refresh,
          new HookTemplatePicker(),
          deps.telemetry.telemetry,
        ),
        rename: new RenameSheetAction(deps.store),
        delete: new DeleteSheetAction(deps.store, deps.refresh),
        assignSegment: new AssignSegmentSheetAction(deps.store, deps.deriver),
        setActive: new SetActiveSheetAction(deps.store),
        copyStylesFromSheet: new CopyStylesFromSheetAction(deps.store, deps.refresh),
        link: new LinkSheetAction(deps.store, deps.refresh, linkedSheetsSync),
        unlink: new UnlinkSheetAction(deps.store),
        runMatcher: new RunSheetMatcherAction(deps.store, deps.deriver),
        updateTextDirection: new UpdateSheetTextDirectionAction(deps.store),
      },
      style: {
        setTemplate: new SetTemplateAction(
          deps.store,
          deps.refresh,
          deps.templates.actions.recordUse,
          deps.telemetry.telemetry,
          linkedSheetsSync,
        ),
        updateControl,
        updateVariant: new UpdateSheetVariantAction(deps.store, deps.refresh),
        setAsset: new SetStyleAssetAction(updateControl),
        updateSegmentSplitter: new UpdateSegmentSplitterConfigAction(deps.store, deps.refresh, linkedSheetsSync),
        updateLineSplitter: new UpdateLineSplitterConfigAction(deps.store, deps.refresh, linkedSheetsSync),
        updateAlignment: new UpdateAlignmentAction(deps.store, linkedSheetsSync),
        updateRotation: new UpdateRotationAction(deps.store, linkedSheetsSync),
        updateTypography: new UpdateTypographyAction(deps.store, deps.refresh, linkedSheetsSync),
        updateSheetCssOverride: new UpdateSheetCssOverrideAction(deps.store, deps.refresh, linkedSheetsSync),
        updateSheetFiltersSvgOverride: new UpdateSheetFiltersSvgOverrideAction(deps.store, deps.refresh, linkedSheetsSync),
        updateEffects: new UpdateEffectsAction(deps.store, deps.refresh, linkedSheetsSync),
        resetSlice: new ResetSheetSliceAction(deps.store, deps.refresh, linkedSheetsSync),
        resetMotion: new ResetSheetMotionAction(deps.store, deps.refresh, linkedSheetsSync),
        setAnimation: new ReplaceSheetAnimationAction(
          deps.store,
          deps.sheetElementResolver,
          deps.animationCssBuilder,
          deps.animationCssWriter,
          linkedSheetsSync,
          deps.refresh,
          new AnimationSupportResolver(),
        ),
        tuneAnimation: new TuneSheetAnimationAction(
          deps.store,
          deps.animationCssBuilder,
          new AnimationValueComposer(),
          linkedSheetsSync,
        ),
      },
    },
  };
}
