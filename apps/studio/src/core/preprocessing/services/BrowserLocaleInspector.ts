/**
 * Reads runtime signals about the user's locale to produce candidate
 * transcription-language codes. Two independent sources feed the
 * result: `navigator.languages` and a small curated mapping from IANA
 * time zones to the majority language of the region. Codes are always
 * two-letter ISO 639-1 to match the transcriber code space; the caller
 * intersects with its own supported list.
 *
 * The result is a stable order: navigator languages first (highest
 * precedence, in the order the browser reports them), then the
 * timezone match. Duplicates are collapsed to their earliest slot.
 */
export class BrowserLocaleInspector {

  suggestedLanguageCodes(): readonly string[] {
    const ordered: string[] = [];
    const seen = new Set<string>();
    for (const code of this.navigatorLanguageCodes()) {
      if (!seen.has(code)) { ordered.push(code); seen.add(code); }
    }
    const timezoneCode = this.timezoneLanguageCode();
    if (timezoneCode !== null && !seen.has(timezoneCode)) {
      ordered.push(timezoneCode);
    }
    return ordered;
  }

  private navigatorLanguageCodes(): readonly string[] {
    if (typeof navigator === 'undefined') return [];
    const raw = Array.isArray(navigator.languages) && navigator.languages.length > 0
      ? navigator.languages
      : (typeof navigator.language === 'string' ? [navigator.language] : []);
    const codes: string[] = [];
    for (const tag of raw) {
      const code = tag.slice(0, 2).toLowerCase();
      if (/^[a-z]{2}$/.test(code)) codes.push(code);
    }
    return codes;
  }

  private timezoneLanguageCode(): string | null {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (typeof tz !== 'string') return null;
      return TIMEZONE_TO_LANGUAGE[tz] ?? null;
    } catch {
      return null;
    }
  }
}

const TIMEZONE_TO_LANGUAGE: Record<string, string> = {
  'America/Argentina/Buenos_Aires': 'es',
  'America/Argentina/Cordoba': 'es',
  'America/Argentina/Mendoza': 'es',
  'America/Buenos_Aires': 'es',
  'America/Bogota': 'es',
  'America/Caracas': 'es',
  'America/Havana': 'es',
  'America/Lima': 'es',
  'America/Mexico_City': 'es',
  'America/Monterrey': 'es',
  'America/Montevideo': 'es',
  'America/Panama': 'es',
  'America/Santiago': 'es',
  'America/Sao_Paulo': 'pt',
  'America/Fortaleza': 'pt',
  'America/Recife': 'pt',
  'America/Bahia': 'pt',
  'America/Manaus': 'pt',
  'America/Belem': 'pt',
  'Europe/Amsterdam': 'nl',
  'Europe/Athens': 'el',
  'Europe/Belgrade': 'sr',
  'Europe/Berlin': 'de',
  'Europe/Bratislava': 'sk',
  'Europe/Brussels': 'nl',
  'Europe/Bucharest': 'ro',
  'Europe/Budapest': 'hu',
  'Europe/Copenhagen': 'da',
  'Europe/Helsinki': 'fi',
  'Europe/Istanbul': 'tr',
  'Europe/Kyiv': 'uk',
  'Europe/Kiev': 'uk',
  'Europe/Lisbon': 'pt',
  'Europe/Ljubljana': 'sl',
  'Europe/Madrid': 'es',
  'Europe/Moscow': 'ru',
  'Europe/Oslo': 'no',
  'Europe/Paris': 'fr',
  'Europe/Prague': 'cs',
  'Europe/Riga': 'lv',
  'Europe/Rome': 'it',
  'Europe/Sofia': 'bg',
  'Europe/Stockholm': 'sv',
  'Europe/Tallinn': 'et',
  'Europe/Vienna': 'de',
  'Europe/Vilnius': 'lt',
  'Europe/Warsaw': 'pl',
  'Europe/Zagreb': 'hr',
  'Europe/Zurich': 'de',
  'Asia/Bangkok': 'th',
  'Asia/Colombo': 'si',
  'Asia/Dhaka': 'bn',
  'Asia/Ho_Chi_Minh': 'vi',
  'Asia/Hong_Kong': 'zh',
  'Asia/Jakarta': 'id',
  'Asia/Karachi': 'ur',
  'Asia/Kolkata': 'hi',
  'Asia/Kuala_Lumpur': 'ms',
  'Asia/Manila': 'tl',
  'Asia/Riyadh': 'ar',
  'Asia/Seoul': 'ko',
  'Asia/Shanghai': 'zh',
  'Asia/Singapore': 'zh',
  'Asia/Taipei': 'zh',
  'Asia/Tashkent': 'uz',
  'Asia/Tehran': 'fa',
  'Asia/Tel_Aviv': 'he',
  'Asia/Jerusalem': 'he',
  'Asia/Tokyo': 'ja',
  'Asia/Ulaanbaatar': 'mn',
  'Africa/Algiers': 'ar',
  'Africa/Cairo': 'ar',
  'Africa/Casablanca': 'ar',
  'Africa/Nairobi': 'sw',
  'Africa/Tunis': 'ar',
};

