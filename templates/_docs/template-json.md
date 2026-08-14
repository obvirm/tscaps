# `template.json`

Everything about a template that is not CSS: its identity, its typography defaults, the knobs
the editor shows, how the transcript is cut into captions, and the rendering switches the
engine needs before the stylesheet is applied.

**Every field is optional except `name`.** Missing fields fall back to the same defaults the
rest of the editor uses, and unknown fields are ignored. The minimum viable file is:

```json
{ "name": "Bare" }
```

Guide: [../AUTHORING.md](../AUTHORING.md) · Controls: [style-controls.md](style-controls.md)

---

## Identity

```jsonc
{
  // Display name shown in the gallery. The only required field.
  "name": "Juno",

  // Free-form tags. The picker derives its category tabs from the union across all templates.
  "categories": ["impact"],

  // Case-insensitive substrings matched against navigator.userAgent. If any matches, the
  // template is marked unrenderable on that browser so the editor can flag it and skip it
  // during export. For templates that depend on CSS a browser gets wrong — Safari and
  // feDisplacementMap, for instance.
  "unsupportedUserAgents": ["Firefox"]
}
```

## Typography defaults

What the editor's universal controls pre-fill when the user picks this template. Each field
also belongs in your stylesheet as the fallback of the matching `var(--tscaps-*)` read — see
[style-controls.md](style-controls.md).

```jsonc
{
  "typography": {
    "fontFamily": "Bungee",     // any family the engine ships
    "fontSize": 3.91,           // cqh — 1cqh is 1% of video height
    "fontWeight": 400,          // 100..900 in steps of 100
    "letterSpacing": 0,         // em
    "wordSpacing": 0.12,        // em
    "lineSpacing": 0,           // em
    "textCase": "uppercase",    // "none" | "uppercase" | "lowercase"
    "textAlign": "center",      // "start" | "center" | "end", or "left" | "right"
    "italic": true,
    "underline": false,
    "strikethrough": false
  },

  // Default rotation in degrees (-180..180). Opt in by reading var(--tscaps-rotation) on
  // .segment; a template that omits the var simply ignores the rotation slider.
  "rotation": { "angleDeg": 0 }
}
```

## Placement in the frame

`*Align` picks which edge of the caption box lands on the anchor; `*Offset` is a fraction of
the video's dimension.

```jsonc
{
  "alignment": {
    "verticalAlign": "bottom",   // "top" | "center" | "bottom"
    "verticalOffset": 0.12,      // fraction of video height
    "horizontalAlign": "center", // "left" | "center" | "right", or "start" | "end"
    "horizontalOffset": 0.5      // fraction of video width, from the left edge
  }
}
```

`horizontalAlign` takes either vocabulary, the way `text-align` accepts both:

- **`left` / `center` / `right`** name a side of the screen, and `horizontalOffset` counts
  from the video's left edge. **This is the default choice.** Short-form players draw their
  action rail down the *right* edge — TikTok reserves roughly 120px of 1080, Reels about 90,
  while the left costs around 60. A template that hugs an edge should hug the left in every
  language, because that budget belongs to the player and not to the caption.
- **`start` / `center` / `end`** name a side of the reading order, and `horizontalOffset`
  then counts from the edge reading begins at. The two halves travel together, so `start` at
  `0.06` sits six percent in from the left in English and six percent in from the right in
  Arabic. Reach for it only when the placement is genuinely part of the reading, and weigh it
  against the rail above.

**Keep `typography.textAlign` in the same vocabulary as the anchor.** A block hugging an edge
only reads as a block when its text grows out of *that* edge, ragged edge facing inwards;
align it the other way and only the longest line reaches the edge. `levi` and `luna` are
anchored `left` and aligned `left` even in Arabic, which trades typographic convention for
the template's own shape, and the reader can undo it from the Align buttons. A block anchored
`center` has no edge to hug, so its text stays reading-relative (`start` / `end`).

The vertical axis has no equivalent. No language flips top and bottom.

Either way the user can drag the caption anywhere, and a dragged position is stored as a
screen side: a position placed with a pointer is a position on the screen.

## Splitting the transcript into captions

`segmentSplitters` is an ordered pipeline. Each entry runs on the output of the previous one.
Every config carries a `type` discriminator; every other field is optional.

```jsonc
{
  "segmentSplitters": [
    // Splits at hard boundary characters. mode: "none" | "sentence" | "clause" | "custom"
    // (with `chars` and optional `extends`).
    { "type": "boundary", "mode": "clause" },

    // Caps each segment at maxChars after the boundary splitter.
    { "type": "limit_by_chars", "maxChars": 28, "minChars": 6, "minDuration": 0.4, "minLastWordDuration": 0.15 },

    // Character-limit splitter that prefers cuts where the words carry a high boundaryScore
    // (populated upstream on Word). Falls back to greedy — grow to maxChars, retreat if the
    // tail would break minChars — when no word in the valid range carries a score.
    { "type": "boundary_score_limit_by_chars", "maxChars": 14 },

    // Upper bound on the word count per segment.
    { "type": "limit_by_words", "maxWords": 6 },

    // Breaks where the inter-word silence exceeds minGap seconds.
    { "type": "pause_based", "minGap": 0.45 }
  ],

  // How a segment is broken into visible lines. Three implementations:
  //   "balanced"             — character-balanced; needs no DOM measurement.
  //   "balanced-pixel-width" — pixel-balanced; uses the engine's text measurer.
  //   "fixed-tail"           — reserves the last `tailWordCount` words for their own closing
  //                            line; big-last-word layouts pair it with CSS.
  "lineSplitter": {
    "type": "balanced-pixel-width",
    "maxLines": 2,
    "minLines": 1,
    "maxWidthRatio": 0.8   // line width capped at this fraction of the video width
  }
}
```

How the pixel-width splitter measures, and what it cannot see, is in
[rendering.md](rendering.md#how-the-line-splitter-measures).

## Effects

Document-level transformations applied between transcription and rendering. Each entry runs
only when `enabled` is true; the other sub-fields fall back to per-effect defaults.

```jsonc
{
  "effects": [
    { "type": "gap_free", "enabled": true },
    { "type": "smart_punctuation", "enabled": false },
    { "type": "emoji", "enabled": true, "placement": "segment-below", "size": 1.8, "gap": 0.1 }
  ]
}
```

Available types: `gap_free`, `remove_punctuation`, `smart_punctuation`, `smart_lowercase`,
`carry_quotes`, `emoji`. The emoji effect renders decoration glyphs next to tagged words;
`placement` is `word` | `segment-above` | `segment-below`, and `size` and `gap` are
multipliers.

## Style controls

Every entry becomes `--tscaps-<id>` on the caption wrapper, and your CSS reads it with
`var(--tscaps-<id>, <fallback>)`. The full shape, the catalogued shorthand, the groups and
what the build refuses are in [style-controls.md](style-controls.md).

```jsonc
{
  "styleControls": [
    {
      "id": "primary-color",       // becomes --tscaps-primary-color
      "label": "Text",
      "type": "color",             // "color" | "integer" | "float" | "toggle" | "select" | "text" | "image" | "font"
      "default": "#ffffff",
      "group": "style",            // "style" | "motion"
      "subgroup": "colors"         // style: colors | appearance | assets · motion: segments | words | emojis
    },
    {
      "id": "shadow-depth",
      "label": "Shadow depth",
      "type": "float",
      "default": 1,
      "min": 0, "max": 2, "step": 0.1,
      "unit": "em",                // "px" | "%" | "em" | "cqh" | "cqw" | "s"
      "group": "style",
      "subgroup": "appearance",
      "legend": "How far the shadow stack extends behind each word."
    },
    {
      "id": "shadow-preset",
      "label": "Shadow style",
      "type": "select",
      "default": "hard-3d",
      "options": [
        { "value": "hard-3d",   "label": "Hard 3D",   "cssValue": "0.04em 0.04em 0 var(--tscaps-shadow-color)" },
        { "value": "soft-glow", "label": "Soft glow", "cssValue": "0 0 0.4em var(--tscaps-shadow-color)" }
      ]
    },
    {
      "id": "uppercase-overlay",
      "label": "Bold accents",
      "type": "toggle",
      "default": false,
      "valueOn": "900",                              // emitted when on
      "valueOff": "var(--tscaps-font-weight, 400)"   // emitted when off
    }
  ]
}
```

## Variants

Named presets over the template's own controls. Every override key must name a control the
template ships, whether it declared it by hand or received it from a primitive. Two or more
variants expose a preset picker in the Style tab and power the multi-speaker flow, one
variant per speaker sheet, cyclic by index. Omit for a fixed-look template.

```jsonc
{
  "variants": [
    { "label": "Amber", "overrides": { "primary-color": "#ffb300", "shadow-color": "#3a2400" } },
    { "label": "Cyan",  "overrides": { "primary-color": "#4dd4ff", "shadow-color": "#062a33" } }
  ]
}
```

## Feature opt-outs

Every flag defaults to true. Declare an entry only where the template does **not** support the
feature.

```jsonc
{
  "features": {
    // A windowed layout that breaks under per-word rotation.
    "rotation": { "segment": true, "word": false },

    // A look that does not survive being animated. Keyed by the kind an animation would land
    // on, so name every ancestor of the element that breaks — for a blend on .word, that is
    // segment and line.
    "animation": { "segment": false, "line": false }
  }
}
```

`animation` exists because `mix-blend-mode` mixes against its backdrop inside the parent
stacking context, and every entrance in the library animates `transform` or `opacity` —
either of which puts a stacking context on the ancestor and cuts the blend. Measured in both
engines: even `translateY(0)` isolates, Firefox isolates on an animated `opacity` where
Chromium does not, and the frozen-frame model keeps the fill applied, so the blend never
comes back. The panels for the named kinds lock with the reason rather than offering a choice
that would break the look, and the action refuses one even if it arrives another way. luna,
milo and luca blend today, and all three already opt out of `rotation` for the same reason.

## Rendering switches

Handled by the engine and the loader before the CSS is applied.

```jsonc
{
  "rendering": {
    // Wrap each word's text in one <span class="letter"> per grapheme.
    // See css-contract.md#letter-mode for the trade-offs.
    "splitWordsIntoLetters": false,

    // CSS padding shorthand (1 to 4 tokens). The loader generates a
    // `.segment { padding: ...; margin: -... }` rule that grows the filter's bounding box
    // without changing the visual layout. Use em so it scales with font-size.
    // See filters.md#giving-a-filter-room.
    "padding": "2em",

    // Opt into the video-frame layer. See rendering.md#the-video-frame-layer.
    //   previewMode "omit" (default) — no live mirror in the preview.
    //   previewMode "live"           — a <video srcObject> mirrors the player.
    //   jpegQuality [0,1]            — tunes the encoded frame slice fed to --video-frame.
    "videoFrame": { "required": true, "previewMode": "live", "jpegQuality": 0.75 }
  },

  // Opt into the text-behind-actor effect. tagCondition is a boolean tag expression scoping
  // which segments activate automatically; absent means every scene-valid segment qualifies.
  // See rendering.md#text-behind-the-actor.
  "behindActor": { "required": true, "tagCondition": "highlight or hook" }
}
```
