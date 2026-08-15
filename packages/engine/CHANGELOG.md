# Changelog

All notable changes to `@tscaps/engine` are documented here. This file
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the
package uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Prior 0.1.x releases shipped without a tracked changelog; consult the
git history for their contents.

## [0.3.1] - 2026-08-15

### Added
- `onnxruntime-web` is declared as a peer dependency (`^1.27.0`). **Transcription does not work without it, and until now nothing said so until the model weights had already downloaded.**

  `@huggingface/transformers@4.2.0` pins `onnxruntime-web` to an exact `1.26.0-dev` build, and that build cannot open a quantized session against the current `_timestamped` Whisper exports. It fails with `TransposeDQWeightsForMatMulNBits ... Missing required scale`. The runtime side was fixed in ORT 1.27 ([microsoft/onnxruntime#28306](https://github.com/microsoft/onnxruntime/issues/28306), closed 2026-05-12); bundling that fix is tracked in [huggingface/transformers.js#1707](https://github.com/huggingface/transformers.js/issues/1707), where the maintainer places it in transformers.js v4.3.0.

  An exact pin cannot be lifted by a dependency range, so until 4.3.0 ships, a consumer that transcribes has to force the version at the root of their own tree:

  ```yaml
  # pnpm-workspace.yaml
  overrides:
    onnxruntime-web: 1.27.0
  ```

  ```jsonc
  // package.json, npm "overrides" or yarn "resolutions"
  "overrides": { "onnxruntime-web": "1.27.0" }
  ```

  The peer declaration only makes the mismatch visible while the tree is being installed. Resolving it is the consumer's override, and nothing this package can declare replaces it.

## [0.3.0] - 2026-08-14

### Added
- A stylesheet can address one rendered element. `SubtitleStyle.addressableElementIds` names the document elements that carry `data-tscaps-el` (`DataAttribute.ELEMENT_ID`) with their id, so a rule can target one word, line, segment or decoration rather than every element of that kind. Every painted fragment of a word carries it, including the pieces of a word the bidirectional algorithm splits across two embedding levels. Address nothing and nothing is stamped.
- A CSS toolkit for consumers assembling one stylesheet out of several sources: `CssLayer.FRAMEWORK` names the framework's own cascade layer, `CssBlockSealer` makes a hand-written excerpt safe to paste inside a wrapper, `CssKeyframeNamespacer` renames `@keyframes` per scope, `CssFragmentParser` splits a selectorless fragment into its top-level parts with offsets into the source, and `CssCustomPropertyDefinitionScanner` / `CssKeyframesScanner` / `CssSelectorClassScanner` / `CssFilterReferenceScanner` report what a stylesheet defines and reads. `BaselineCssComposer.composeOptional` covers a consumer rendering into a document that already supplies the universal half.
- `SvgFilterDefsRenderer` turns filter definitions into markup in one place: materialize against the render scope, resolve `em` / `cqh` to px, re-emit under the scoped id.
- `ModelFileCache` and `CacheStorageModelFileCache`. `WhisperTranscriber` now owns where model weights are stored instead of leaving it to the inference library, and a browser that refuses to keep them surfaces as `ModelFileCacheUnavailableError` rather than a console warning and a silent re-download every session.
- Subtitle-file writing, the inverse of the existing `SrtTranscriber` / `VttTranscriber` parsers. `SubtitleFileSerializer.serialize({ document, granularity, skipRanges })` returns the file's text, mirroring the shape `VideoRenderer.render` already takes. Six formats ship: `SrtSubtitleFileSerializer`, `VttSubtitleFileSerializer`, `AssSubtitleFileSerializer`, `SbvSubtitleFileSerializer`, `TtmlSubtitleFileSerializer` and `TextSubtitleFileSerializer`, each declaring its own media type and extension. Pass the same `skipRanges` handed to the renderer and the file lands on the same timeline as the video; omit them and nothing is rebased. `granularity: 'word'` asks for timing down to each word and every format honours it as far as it can, inline in WebVTT and TTML, with karaoke tags in ASS, and by emitting an entry per word in the formats that have no other way. Text is taken from `Word.text` rather than `Word.displayText`, so a styling pass cannot change what a file written from the same document contains.
- Bidirectional text support. Each line is resolved through the Unicode bidirectional algorithm and its words are emitted in painting order, so right-to-left and mixed-script captions render the way a browser renders the same text. A word spanning two embedding levels is emitted as one element per level. `RenderingConfig.textDirection` supplies the paragraph direction the resolution hangs from.
- `TextDirectionDetector` for inferring a text's reading direction, and `CursiveScriptDetector`, which letter-splitting consults so joining scripts are never broken into isolated glyphs.
- `ElementRenderOverrides.mergedWith`, layering a second set of per-element overrides over an existing one: inline styles merge key by key with the layer winning, alignment and classes replace when the layer sets them. Lets a caller derive extra per-element styling — a font that follows the writing system of each word, say — without rebuilding the overrides it already assembled.

### Changed
- A cue block that carries no timecode is skipped rather than refusing the whole file. `SrtTranscriber` and `VttTranscriber` announce each one verbatim through the new `onSkippedCueBlock` callback, so a caller can tell a file that was fully understood from one that was mostly understood, and only a file where nothing at all could be read throws — as `SubtitleFileUnreadableError`, which names the operation instead of the malformed byte. This is what the WebVTT parser algorithm prescribes and what a browser does with the same file.
- `VttTranscriber` reads the timestamps a WebVTT cue marks its words with, rather than stripping them and sharing the cue out by word length. A file that recorded when each word is spoken now yields those timings; one that did not is unchanged, and so is `SrtTranscriber`, whose format cannot carry them. Timecodes may now also leave out the hour (`MM:SS.mmm`), which WebVTT allows and the parser used to reject as malformed.
- `SegmentSubtreeHtmlBuilder` takes a `WordFragmenter`, and `RenderingConfig` requires `textDirection`.
- `AlignmentConfig.horizontalAlign` additionally accepts `start` / `end`, the way `text-align` accepts both vocabularies. A screen side leaves `horizontalOffset` counting from the left edge; a reading side mirrors the pair together, so one declaration follows the direction of the text. `HorizontalPlacementResolver` resolves the axis for a renderer, and `HorizontalSideResolver` maps a side on its own.
- Default `AudioDecoder` in the pipeline swapped from `BrowserAudioDecoder` (removed) to the new `MediaBunnyAudioDecoder`, which demuxes the source container with mediabunny and streams the primary audio track through `AudioSampleSink` instead of handing the whole container to `AudioContext.decodeAudioData`. Uses far less transient memory on long videos, covers containers Web Audio rejects, and reports `AudioDecoder.decode`'s new optional `onProgress` callback as samples arrive. A codec the browser cannot decode surfaces as a `DOMException` named `NotSupportedError`, following the WebCodecs convention.
- `WhisperTranscriber` runs on q8 quantization by default on WASM, reports real inference progress through `Transcriber.onProgress`, and adds `medium` to the model ladder alongside `tiny` / `base` / `small`. The inferring stage now carries a monotonic `[0, 1]` fraction of the audio processed so far instead of a single boundary event with no value; a `WhisperTextStreamer` wired into `model.generate` derives it from Whisper's per-window timestamp predictions. Consumers should pin `onnxruntime-web` to `>= 1.27` alongside `@huggingface/transformers@4.2` to unlock quantized session creation against the current `_timestamped` model exports (transformers.js#1707).
- Importing the package no longer pulls the inference runtime in with it. `@huggingface/transformers`, and the ONNX runtime it carries, are reached through a dynamic import the first time a transcription runs: an app that renders captions and never transcribes stops paying for them in download, and in Node the native binding is no longer loaded — on musl, no longer fails to load — for code that never runs. One consequence for bundling: a worker whose graph reaches the transcriber has to be emitted as an ES module rather than an IIFE, because a graph containing a dynamic import cannot be a single script. In Vite that is `worker.format: 'es'`.
- Document node ids are 22 characters instead of 36. `DocumentNodeId.generate()` replaces `crypto.randomUUID()` with sixteen random bytes in base64url — the same guarantee in fourteen fewer characters, which matters now that an id can be written into rendered markup once per addressed element per tile. Ids are opaque strings everywhere they are read, so documents holding the old form keep working and none is rewritten.

### Removed
- The `.section` styling contract. `--on-section-starts`, `--on-section-ends`, `--section-duration`, the `.section` element class and the `first-section-in-document` / `last-section-in-document` structure tags are gone; `Section` remains as the document grouping that decides which splitter and tagger chain a run of segments goes through. Nothing rendered them, so no stylesheet that worked before behaves differently — but a rule written against those names never did anything and now says so.

### Fixed
- A `<filter>`'s own attributes reach the browser. Both render paths rebuilt the element as a bare `<filter id="…">`, so every authored filter region was replaced by the SVG default (`-10%` to `120%`) and every `color-interpolation-filters` by `linearRGB`. Blurs and dilations that were being clipped at the default region now paint their full spread.
- The export's tile cache asks about an element rather than about its class. The probe deciding whether two timestamps share a rendered tile built its throw-away chain from CSS classes alone, so a rule addressing one element by `data-tscaps-el` never matched it and the tile was reused across a frame that moved — an animation played in a live preview and exported as a still image. It also never built a decoration node, so a glyph's animation was unreadable even coming from a stylesheet's own rules.
- `CssScoper` no longer swallows the rules after a statement-form at-rule. `@charset`, `@import`, `@namespace` and `@layer name;` are terminated by `;` rather than a block, and the scanner looked only for the `{` that opens one.
- A custom property a stylesheet only reads through a style query (`@container style(--name: value)`) is no longer stripped from the rendered element. It was dropped as unreferenced, so the rules behind the query never applied.
- `WhisperTranscriber` output no longer duplicates content across window boundaries or leaks the tail of a repetition loop. transformers.js chunk-and-stitch leaves both windows' takes on the same audio in the word-level chunks, and a decoder cornered into looping at the window boundary emits `<|t|>text<|t|>` pairs that the coverage record used to trust as legitimate segment closes. A new `WhisperChunkStitcher` splits the merged stream back into per-window groups (detected via timestamp drops in generation order) and crops each to one side of every overlap; `WhisperWindowCoverage` no longer advances its last-close mark on pairs where open equals close; and `WhisperLoopAbortLogitsProcessor` gates on `MIN_FULL_PERIODS` full repetitions plus `MIN_REPETITION_TOKENS` total tokens instead of a fixed detection window, uncapping the detectable period size while keeping short-phrase-repetition false positives at bay.
- `GapFreeEffect` tail padding is recomputed rather than accumulated, and now follows the words back down. It read `seg.time.end` — its own previous stamp — and added `maxGapMs` on top every time, so every keystroke fed through `reapplyEffects` grew every segment by another second. It also wrote that stamp to `Segment.customTime`, where it was indistinguishable from a window a caller had named, so the only way not to overwrite the caller was to refuse to shrink: a segment stayed stretched even once the following one had moved before its last word. Padding is now measured from the segment's own words and written to the new `Segment.effectTime`, which the effect owns and overwrites wholesale, clearing it when there is no room left to pad. `Segment.time` resolves `customTime ?? effectTime ?? wordTime`, so a caller's explicit window still outranks the pass, and a segment carrying one is skipped rather than padded over. `DocumentEditor.updateWordTime` also stopped discarding `customTime`: moving a word changes when the segment's words sound, not which words it holds.

## [0.2.1] - 2026-07-12

### Added
- Text-behind-actor primitive: engine-level API for compositing a per-frame person-segmentation mask onto captions during export, so captions can render behind the on-screen subject.
- `Word.boundaryScore` field and a score-aware char-limit splitter that prefers natural sentence boundaries over hard character caps.
- Cuts support in the export pipeline: cuts declared on a `Document` are honored when rendering, so time ranges are removed from the output video and captions realign accordingly.
- Segment index prop on rendered segments, exposed to templates for index-based styling.
- Pause tagger.

### Changed
- Segment subtree extracted into a dedicated `SegmentSubtreeDecomposer`, and the transient `<style>` probe used for CSS variable resolution now closes deterministically.

### Fixed
- Editing a word's text or time preserves its decorations and tags instead of dropping them.
- Paint-region measurement uses inline styles so cascade-dependent metrics stay accurate.
- Removed the mutable `parent` prop from the document tree; nodes are consistently traversed top-down.
