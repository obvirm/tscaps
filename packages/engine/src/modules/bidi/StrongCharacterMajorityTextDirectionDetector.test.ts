import { describe, expect, it } from 'vitest';
import { BidiJsCharacterClassifier } from '@modules/bidi/BidiJsCharacterClassifier';
import { StrongCharacterMajorityTextDirectionDetector } from '@modules/bidi/StrongCharacterMajorityTextDirectionDetector';

const detector = new StrongCharacterMajorityTextDirectionDetector(new BidiJsCharacterClassifier());

describe('StrongCharacterMajorityTextDirectionDetector', () => {

  it('reads right-to-left scripts as right-to-left', () => {
    expect(detector.detect('في هذا الفيديو سنتحدث عن إضافة الترجمة')).toBe('rtl');
    expect(detector.detect('در این ویدیو درباره زیرنویس صحبت می کنیم')).toBe('rtl');
    expect(detector.detect('בסרטון הזה נדבר על איך להוסיף כתוביות')).toBe('rtl');
    expect(detector.detect('میں یہ ویڈیو بنا رہا ہوں')).toBe('rtl');
  });

  it('is not thrown off by the foreign names a text borrows', () => {
    expect(detector.detect('في هذا الفيديو سنتحدث عن tscaps وهو تطبيق لإضافة الترجمة'))
      .toBe('rtl');
    expect(detector.detect('Today I want to talk about a phrase, مرحبا بكم, my grandmother used'))
      .toBe('ltr');
  });

  it('does not let the opening word speak for the whole text', () => {
    expect(detector.detect('tscaps هو الأفضل لإضافة الترجمة إلى الفيديو')).toBe('rtl');
  });

  // Product names outvote the language the video is actually in. Accepted: the
  // reader flips one field, whereas a left-to-right video wrongly read as
  // right-to-left would have every one of its lines rearranged.
  it('resolves left-to-right when a borrowed script outweighs the language', () => {
    expect(detector.detect('اليوم نراجع iPhone 16 Pro Max و Samsung Galaxy S25 Ultra'))
      .toBe('ltr');
  });

  it('resolves left-to-right for text that carries no direction of its own', () => {
    expect(detector.detect('')).toBe('ltr');
    expect(detector.detect('12 34 - 56 %')).toBe('ltr');
  });
});
