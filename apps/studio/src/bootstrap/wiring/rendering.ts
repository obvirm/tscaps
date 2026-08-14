import { BidiJsAnalyzer, CssBlockSealer, CssFragmentParser, CssKeyframeNamespacer, CssMinifier, CursiveScriptDetector, HorizontalPlacementResolver, HorizontalSideResolver, SegmentPaddingCssRuleBuilder, SvgFilterDefinitionsParser, WordFragmenter } from '@tscaps/engine';
import { ElementAnimationCatalog } from '@core/elements/domain/ElementAnimationCatalog';
import { BUILTIN_ANIMATION_FIELDS } from '@core/elements/infrastructure/BuiltinAnimationFields';
import { BUILTIN_ELEMENT_ANIMATION_PRESETS } from '@core/elements/infrastructure/BuiltinElementAnimationPresets';
import { ElementAnimationCssBuilder } from '@core/elements/services/animation/ElementAnimationCssBuilder';
import { ElementAnimationCssWriter } from '@core/elements/services/css/ElementAnimationCssWriter';
import { ElementControlCssWriter } from '@core/elements/services/css/ElementControlCssWriter';
import { ElementTimingVariableResolver } from '@core/elements/services/css/ElementTimingVariableResolver';
import { TemplateContractValidatorFactory } from '@core/templates/services/contract/TemplateContractValidatorFactory';
import { RepositoryAssetReferenceIndex } from '@core/templates/services/contract/RepositoryAssetReferenceIndex';
import { SimilarNameFinder } from '@core/_shared/services/SimilarNameFinder';
import { StyleControlCatalog } from '@core/templates/domain/definition/StyleControlCatalog';
import { TypographyCssVarBuilder } from '@core/sheets/services/TypographyCssVarBuilder';
import { RotationCssVarBuilder } from '@core/sheets/services/RotationCssVarBuilder';
import { TextDirectionCssVarBuilder } from '@core/sheets/services/TextDirectionCssVarBuilder';
import { StyleValuesCssVarsBuilder } from '@core/sheets/services/StyleValuesCssVarsBuilder';
import { ControlValueCssRenderer } from '@core/templates/services/controls/ControlValueCssRenderer';
import { FontScriptClassifier } from '@core/fonts/services/FontScriptClassifier';
import { FontStackResolver } from '@core/fonts/services/FontStackResolver';
import { CaptionFontFamilyResolver } from '@core/fonts/services/CaptionFontFamilyResolver';
import { CaptionFontOverridesBuilder } from '@core/fonts/services/CaptionFontOverridesBuilder';
import { SegmentFontStylesBuilder } from '@core/fonts/services/SegmentFontStylesBuilder';
import { SheetCssVarsBuilder } from '@core/sheets/services/SheetCssVarsBuilder';
import { SheetCaptionTextCollector } from '@core/sheets/services/SheetCaptionTextCollector';
import { SheetTextScriptSynchronizer } from '@core/sheets/services/SheetTextScriptSynchronizer';
import { EmojiCssVarBuilder } from '@core/effect/services/EmojiCssVarBuilder';
import { SegmentColorRotation } from '@core/sheets/services/SegmentColorRotation';
import { SheetSvgFilterDefinitionsResolver } from '@core/sheets/services/SheetSvgFilterDefinitionsResolver';
import { LayeredCaptionCssBuilder } from '@core/captions/services/LayeredCaptionCssBuilder';
import type { AssetLibraryModule } from '@bootstrap/wiring/asset-library';

export interface RenderingDependencies {
  readonly assetLibrary: AssetLibraryModule;
}

export type RenderingModule = ReturnType<typeof bootRendering>;

/**
 * Rendering helpers shared by every surface that paints sheets — the
 * document deriver (editor), the export pipeline, and the live
 * preview. Holds the per-config var builders (typography, rotation,
 * style-values) and the composed `SheetCssVarsBuilder` consumers
 * inject.
 *
 * Depends on the asset library because `StyleValuesCssVarsBuilder`
 * resolves image-typed style controls through it. The composition
 * root wires the library against the user-blobs store before this
 * module boots.
 */
export function bootRendering(deps: RenderingDependencies) {
  const svgFilterDefinitionsParser = new SvgFilterDefinitionsParser();
  const horizontalSideResolver = new HorizontalSideResolver();
  const horizontalPlacementResolver = new HorizontalPlacementResolver(horizontalSideResolver);
  const fontScriptClassifier = new FontScriptClassifier();
  const fontStackResolver = new FontStackResolver();
  const captionFontFamilyResolver = new CaptionFontFamilyResolver(fontStackResolver, fontScriptClassifier);
  const segmentFontStylesBuilder = new SegmentFontStylesBuilder(captionFontFamilyResolver);
  const typographyCssVarBuilder = new TypographyCssVarBuilder(horizontalSideResolver, fontStackResolver);
  const textDirectionCssVarBuilder = new TextDirectionCssVarBuilder();
  const rotationCssVarBuilder = new RotationCssVarBuilder();
  const styleValuesCssVarsBuilder = new StyleValuesCssVarsBuilder(
    deps.assetLibrary.repository,
    new ControlValueCssRenderer(fontStackResolver),
  );
  const emojiCssVarBuilder = new EmojiCssVarBuilder();
  const cssBlockSealer = new CssBlockSealer();
  const animationCatalog = new ElementAnimationCatalog(BUILTIN_ELEMENT_ANIMATION_PRESETS);
  const animationFieldCatalog = BUILTIN_ANIMATION_FIELDS;
  const controlCssWriter = new ElementControlCssWriter(new CssFragmentParser(new CssMinifier()));
  const animationCssBuilder = new ElementAnimationCssBuilder(
    animationCatalog,
    new ElementTimingVariableResolver(),
    controlCssWriter,
  );
  const layeredCaptionCssBuilder = new LayeredCaptionCssBuilder(
    new CssKeyframeNamespacer(),
    new CssMinifier(),
    cssBlockSealer,
  );
  return {
    animationCatalog,
    animationFieldCatalog,
    controlCssWriter,
    animationCssBuilder,
    animationCssWriter: new ElementAnimationCssWriter(animationCssBuilder),
    layeredCaptionCssBuilder,
    typographyCssVarBuilder,
    rotationCssVarBuilder,
    styleValuesCssVarsBuilder,
    emojiCssVarBuilder,
    sheetCssVarsBuilder: new SheetCssVarsBuilder(
      typographyCssVarBuilder,
      textDirectionCssVarBuilder,
      rotationCssVarBuilder,
      styleValuesCssVarsBuilder,
      emojiCssVarBuilder,
    ),
    horizontalSideResolver,
    horizontalPlacementResolver,
    fontStackResolver,
    segmentFontStylesBuilder,
    captionFontOverridesBuilder: new CaptionFontOverridesBuilder(segmentFontStylesBuilder),
    sheetTextScriptSynchronizer: new SheetTextScriptSynchronizer(fontScriptClassifier, new SheetCaptionTextCollector()),
    segmentColorRotation: new SegmentColorRotation(),
    wordFragmenter: new WordFragmenter(new BidiJsAnalyzer(), new CursiveScriptDetector()),
    segmentPaddingCssRuleBuilder: new SegmentPaddingCssRuleBuilder(),
    svgFilterDefinitionsParser,
    svgFilterDefinitionsResolver: new SheetSvgFilterDefinitionsResolver(svgFilterDefinitionsParser),
    templateContractValidator: new TemplateContractValidatorFactory(
      new StyleControlCatalog(new SimilarNameFinder()),
    ).create(
      new RepositoryAssetReferenceIndex(deps.assetLibrary.repository),
    ),
  };
}
