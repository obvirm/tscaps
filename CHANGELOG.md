# Changelog

All notable changes to the tscaps web app are documented here. This file
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the
project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

The engine (`@tscaps/engine`) is versioned separately; see its own release
notes on npm.

## [Unreleased]

### Added
- Style one element on its own. Click a word, a scene or an emoji in the preview and a panel opens over the editor with that element's own typeface, size, weight, colour, rotation and place in the frame. Setting a field further out takes it back from everything inside, so painting a whole caption yellow reaches the word you had made blue. Beside the fields is the CSS they write, editable: anything the fields do not cover, you write yourself, and a field whose declaration your own line has taken over dims and says so rather than pretending to still be in charge.
- Pick how the captions move. A Motion tab offers a grid of drawn cards for each part: how a scene enters, how its words arrive one after another, how its emojis do. Picking one plays that element's own stretch of the video so you see the choice rather than read its name, and pressing the chosen card again replays it. Answer for the one element you picked, or for a whole style sheet at once, in which case every caption under it follows. The card selected when the tab opens is the entrance the template already applies, so you see what you have before replacing it, and a template whose look does not survive being animated locks the panel and says why.
- Where an animation has something worth dragging, its controls sit beside it. A distance, a direction, a duration, an overshoot, a swing, whichever the animation you picked actually has.
- Editing a style sheet's own CSS now warns about `!important`. In a template stylesheet it is not a strong rule but an unreachable one, and it silently switches off every control the editor offers for that template, the colour picker and the size slider included.
- Style the opening scenes of your video as a hook. In the transcript's scene actions menu (the wand icon), "Set hook scenes" lets you click through the first scenes to mark them; they move to a Hook sheet with its own template, style and effects, and go back to Main when you clear the selection.
- Export the captions as a subtitle file, to carry them into another editor. "Export subtitles instead" at the bottom of the export dialog writes SubRip (`.srt`), WebVTT (`.vtt`), Advanced SubStation Alpha (`.ass`), SubViewer (`.sbv`), or the plain transcript as `.txt`. Cut sections are accounted for, so the file lines up with the video you export from the same project, and the text comes from your transcript, so punctuation and capitalization are there even when the style you picked drops them from the captions on screen. An optional word-level timing switch times each word rather than each phrase; the dialog says what that costs in the format you picked, since some carry it inside a normal entry and others can only reach it by making the file several times longer. Your caption design stays in tscaps: these formats carry text and timing, not the look.
- Right-to-left captions. Arabic, Hebrew, Persian and Urdu now read in the correct order instead of coming out word-reversed, in the preview and in the exported video alike. The direction is picked from your transcript when the video is transcribed, and a Direction field at the bottom of the Typography tab lets you change it. Persian, Hebrew and Urdu joined the language list in the start dialog.
- Linked sheets: tie two or more sheets into a group so a single style edit (font, size, template, effects) rides across every sibling while each keeps its own preset. Multi-speaker projects link all speaker sheets by default. Unlink or relink from the chain icon on each sheet chip.
- Group scenes by tag: the "Group scenes" dialog can now send every word carrying a chosen tag (number, quote, emphasis, and the rest) to a sheet at once. Only the tagged words move, splitting into their own scenes on the target sheet; the surrounding words stay where they are. A toast reports how many scenes or tagged words moved.

### Changed
- The style controls speak one vocabulary across the gallery. The same knob now carries the same name, unit and range whichever template you are on, and a few that had been doing two jobs at once were split apart, so tuning a template's shadow no longer recolours its outline. Your saved projects carry their tuning across.
- Style controls are split into a Style tab and a Motion tab. Anything that is only about movement renders beside the animation it moves rather than among the colours. The single "Animation intensity" slider that some templates shipped is gone, replaced by the animation's own controls: it could only make one movement bigger or smaller, and there is now something finer to reach for.
- Changing a template keeps the work you did on individual words. It used to clear every word's size, colour and position along with the scenes'. Only the scenes' styling goes now, which is what changing the look of the captions is about.
- Bringing a VTT file keeps the word timings it already carries. WebVTT can mark when each word is spoken, and those marks used to be thrown away and the timings guessed from how long each word is to write. A file that carries them now lands its captions exactly where it says, which matters for the word-by-word styles.
- Local (in-browser) transcription is much faster and shows a real progress bar throughout. It uses multiple CPU threads when the browser allows, runs on smaller model weights that download about 4× faster and infer noticeably quicker without a meaningful accuracy drop, and reports actual progress during transcription instead of an indeterminate spinner. Audio extraction uses less memory on long videos, streaming the audio out of the file track by track instead of loading the whole video into the browser's audio decoder at once. A new Medium option in Advanced trades a longer first-run download for higher accuracy. When your browser genuinely can't decode a video's audio, the message now says so and suggests converting to MP4 (H.264 + AAC).

### Fixed
- The speech model is kept between sessions. A browser that refuses to store it left every later session downloading it again with nothing on screen saying why. It now downloads once, and when it genuinely cannot be kept a notice says so and tells a full disk apart from a private window.
- The selection outline follows what it frames. Resizing a word from its panel left the outline at the box the word had when you picked it, and a caption playing its entrance slid out from under its own outline.
- Clicking the space around a word selects the scene again. A click that missed every word snapped to the nearest one from much too far away: measured, that was swallowing 87 to 92 percent of the area around a line, leaving the scene barely pickable. The reach now only grows where a word is genuinely too small to hit, which is what it was there for.
- A caption nearly as wide as the video can be moved. It snapped to a side guide at every position it could reach, pulled right when you asked it to go left, and could not be pushed out of frame at all. A caption now hangs at most half out of frame on any side and never goes missing.
- In-browser transcription no longer fills longer videos with duplicate lines or looping filler phrases. On videos past about half a minute the speech model would sometimes transcribe the same stretch of audio twice at window boundaries, or get stuck repeating a short phrase ("like, oh, I'm going to be, like, oh…") until it ran out of budget. Both landed verbatim in your transcript, and both are now caught and dropped before they reach the editor.
- Scene tails now follow your edits in both directions. If Gap-free was on, each transcript edit added another second to every scene's tail, so after a dozen edits scenes were hanging on screen several seconds after the speech had stopped. And once a scene had stretched, nothing pulled it back in: moving a later scene's first word earlier left the scene before it still covering that word. Padding now settles at one second past the last word and gives the room back as soon as there is less of it.
- A scene time you set by hand is no longer lost when you retime a word. Editing any word inside the scene wiped the start and end you had chosen and snapped the scene back to its words.
- Kel no longer shifts the line sideways as it plays. The word being narrated switched to a heavier weight, which takes a different width under any font other than Kel's own, pushing every word after it along.
- Running out of browser storage no longer costs you the transcription you just waited for. Preview preparation falls back to the original video, and a failed save shows a notice you can dismiss instead of blocking export behind an error that never cleared.
- Transcription can be retried after the speech model fails to download. A dropped connection used to leave it broken for the rest of the session, behind a message that suggested trying a shorter video.
- The start dialog no longer sits on "Analyzing video" forever with files that don't declare their length (common with screen recordings and fragmented MP4). The length is now read from the video data itself, and if the file truly can't be read, a message says so and suggests re-exporting it as MP4.
- Videos without an audio track now open the editor with an empty transcript so you can add captions by hand, instead of failing with a transcription error. The start dialog warns upfront that there is no speech to transcribe.
- Videos your browser can't actually decode (common with HEVC / iPhone footage) now fail right after the drop, with advice to convert to MP4, instead of minutes later after transcription already ran.
- The editor no longer hangs on "Loading project" when the preview can't open the project's video. A dialog explains what happened and leads back to your projects.
- Cuts panel no longer reveals the transcript and audio waveforms out of sync. A spinner shows while audio is analyzed, and both appear together once ready.

## [0.1.3] - 2026-07-13

### Fixed
- The Docker image now mounts the app correctly. Previously the container served a blank page because the router basename didn't match the served path.
- Loading caption reads "Opening" instead of "Downloading project video" — the previous wording overstated what happens when a project is read from browser storage.

## [0.1.2] - 2026-07-12

### Fixed
- Docker image builds no longer require network access to `api.nuget.org`. The `onnxruntime-node` native postinstall (which downloads a Linux/GPU binary the browser bundle never uses) is skipped, so builds succeed on runners that cannot reach NuGet.

## [0.1.1] - 2026-07-12

First tagged release. Everything below has landed since the last rolling `:latest` push.

### Added
- Hide text behind person: captions render behind the on-screen subject, with live preview, per-segment override, and a prepare-video step when a template needs the effect. Runs entirely in the browser.
- Cuts module: automatic silence removal, resizable cut spans, transcript syncs with cuts, cuts respected in preview and export.
- Mobile playback keeps the screen awake, bottom-sheet resize is refined, and timeline drag feels better on touch.
- Preview video player rebuilt on a canvas surface with WebCodecs decode. This gives higher precision at the frame level, which is required by features like cuts. The native `<video>` player is still available via `VITE_PREVIEW_SURFACE=native` as a fallback.
- Preprocessing stage now generates a video proxy in 480p for the preview. It is useful for other features like *hide text behind person*. It can be disabled with `VITE_PREVIEW_PROXY_ENABLED=false`.
- Emojis effect: decorate captions with emojis.

### Fixed
- Editor video box sizes against the actual column height so aspect ratio holds through layout changes.
- Blocked IndexedDB upgrades surface a dialog instead of hanging.

## [0.0.1] - 2026-06-11

Initial public preview. This entry documents the state of the rolling `:latest` image at its first export, before the project used semver tags. It is included for reference and was never published as a tag.

tscaps is a client-side video editor for burning subtitles into video, running fully in the browser with no backend and no upload.

### Added
- In-browser transcription via WebGPU Whisper, with model-size fallback for low-end devices and a warning for mobile.
- HTML + CSS caption engine: templates author captions as styled DOM, rasterized per frame through SVG `foreignObject` for export.
- MediaBunny-backed export pipeline with configurable resolution and bitrate, service-worker streaming to disk for large exports, and pre-export font collection.
- Overlay editing on the preview: click-to-select segments and words, drag to move, resize handles, and rotation gestures — all commit as per-word / per-segment overrides.
- Captions / transcript editor: edit word text and timings, split into graphemes, split and join lines, find current scene, keyboard navigation, undo/redo across text inputs.
- Style sheets: multiple caption styles per project, per-scene assignment, sheet matchers, multi-speaker templates, and per-segment / per-word style overrides.
- Templates system with a bundled catalog, categories, favorites, JSON + CSS authoring, control fields (typography, colors, layout, effects, SVG filters with CSS vars), custom font uploads, and an assets library.
- Effects: gap-free, remove-punctuation, boundary-aware segment splitter, balanced-line splitter, scaled-character splitter, dynamic sizing.
- Video-frame layer for templates whose visuals depend on the underlying pixels (frosted glass, blend modes).
- Mobile-friendly layout: resizable panels, simplified captions editor, OS theme detection.
- Self-contained Docker image for running the editor locally.
