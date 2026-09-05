import type { SubtitleStyle } from '@tscaps/engine';
import picoTemplate from '../../../../templates/pico/template.json';
import picoCss from '../../../../templates/pico/style.build.css?raw';

// Pico as the template ships it (Silver variant defaults), with
// container-query units pre-resolved to px at the render size. The browser
// path resolves cqh/cqw against its subtitle container at paint time;
// Takumi has no container context, so the same arithmetic happens here:
// cqh = height/100, cqw = width/100.
export function buildPicoStyle(width: number, height: number): SubtitleStyle {
  const cqh = height / 100;
  const cqw = width / 100;
  const controls = new Map<string, string>();
  for (const control of picoTemplate.styleControls as ReadonlyArray<{
    id: string; type: string; default: unknown; valueOn?: string; valueOff?: string;
  }>) {
    if (control.type === 'toggle') {
      const on = String(control.default) === 'true';
      controls.set(control.id, on ? (control.valueOn ?? '') : (control.valueOff ?? ''));
    } else {
      controls.set(control.id, String(control.default));
    }
  }
  const px = (cqValue: string): string =>
    cqValue.replace(/([\d.]+)cqh/g, (_, n: string) => `${(Number(n) * cqh).toFixed(2)}px`)
      .replace(/([\d.]+)cqw/g, (_, n: string) => `${(Number(n) * cqw).toFixed(2)}px`);
  // The browser resolves container units against the subtitle container
  // (the full frame here). Takumi has no container context, so the same
  // arithmetic is applied to the stylesheet text up front.
  const css = px(picoCss);
  return {
    css,
    inlineStyles: {
      '--tscaps-font-family': '"JetBrains Mono", monospace',
      '--tscaps-font-weight': String(picoTemplate.typography.fontWeight),
      '--tscaps-font-size': `${(picoTemplate.typography.fontSize * cqh).toFixed(2)}px`,
      '--tscaps-letter-spacing': `${picoTemplate.typography.letterSpacing}em`,
      '--tscaps-word-spacing': `${picoTemplate.typography.wordSpacing}em`,
      '--tscaps-text-align': 'left',
      '--tscaps-primary-color': controls.get('primary-color')!,
      '--tscaps-window-bg': controls.get('window-bg')!,
      '--tscaps-titlebar-bg': controls.get('titlebar-bg')!,
      '--tscaps-titlebar-text': controls.get('titlebar-text')!,
      '--tscaps-gutter-color': controls.get('gutter-color')!,
      '--tscaps-caret-color': controls.get('caret-color')!,
      '--tscaps-chrome-scale': String(controls.get('chrome-scale')),
      '--tscaps-show-line-numbers': controls.get('show-line-numbers') || '1',
      '--tscaps-tag-bold': controls.get('tag-bold') || '900',
      '--tscaps-fixed-width': px(controls.get('fixed-width') || '0cqw'),
      '--tscaps-title': controls.get('title') ?? 'caption.md',
    },
    alignment: {
      verticalAlign: picoTemplate.alignment.verticalAlign as 'top' | 'center' | 'bottom',
      verticalOffset: picoTemplate.alignment.verticalOffset,
      horizontalAlign: 'center',
      horizontalOffset: 0.5,
    },
    rendering: {
      splitWordsIntoLetters: picoTemplate.rendering.splitWordsIntoLetters,
      videoFrame: { required: false, jpegQuality: 1 },
      padding: null,
      textDirection: 'ltr',
    },
  };
}
