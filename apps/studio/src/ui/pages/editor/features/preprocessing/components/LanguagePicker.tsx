import { useMemo } from 'react';
import type { SupportedLanguage } from '@shared/transcription-languages';
import {
  Autocomplete,
  type AutocompleteFilter,
  type AutocompleteOption,
} from '@ui/_shared/components/Autocomplete/Autocomplete';

export const AUTO_DETECT_LANGUAGE_VALUE = 'auto';

interface LanguageOption extends AutocompleteOption {
  readonly nativeName?: string | undefined;
}

interface LanguagePickerProps {
  readonly id: string;
  readonly label: string;
  readonly languages: readonly SupportedLanguage[];
  readonly value: string;
  readonly onChange: (value: string) => void;
  /**
   * Prepends an "Auto-detect" option that submits `AUTO_DETECT_LANGUAGE_VALUE`
   * to the caller. Callers whose transcriber can detect the language from
   * the audio turn this on; the in-browser Whisper transcriber defaults
   * silently to English when nothing is specified, so the option is
   * deliberately withheld there.
   */
  readonly allowAutoDetect: boolean;
  readonly placeholder?: string | undefined;
  /**
   * Renders a small red validation notice below the picker when set.
   * Undefined means no error is being shown.
   */
  readonly errorMessage?: string | undefined;
}

const LABEL_CLS = 'block text-xs text-fg-secondary mb-1.5 tracking-[-0.005em]';

/**
 * Language picker on the "Start your video" dialog. Wraps `Autocomplete`
 * with a language-aware option renderer that lays out the English name
 * on the left and the endonym on the right for languages that have one.
 * Free-text search matches the English name.
 */
export function LanguagePicker({
  id,
  label,
  languages,
  value,
  onChange,
  allowAutoDetect,
  placeholder,
  errorMessage,
}: LanguagePickerProps) {
  const options = useMemo<readonly LanguageOption[]>(() => {
    const base: LanguageOption[] = languages.map((l) => ({
      value: l.code,
      label: l.nameEn,
      nativeName: l.nativeName !== l.nameEn ? l.nativeName : undefined,
    }));
    if (allowAutoDetect) {
      base.unshift({ value: AUTO_DETECT_LANGUAGE_VALUE, label: 'Auto-detect' });
    }
    return base;
  }, [languages, allowAutoDetect]);

  return (
    <div>
      <label className={LABEL_CLS} htmlFor={id}>{label}</label>
      <LanguagePickerBody
        id={id}
        options={options}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
      />
      {errorMessage !== undefined && (
        <p className="text-2xs text-danger m-0 mt-1.5 leading-snug" role="alert">
          {errorMessage}
        </p>
      )}
    </div>
  );
}

interface LanguagePickerBodyProps {
  readonly id: string;
  readonly options: readonly LanguageOption[];
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly placeholder?: string | undefined;
}

const matchLanguageQuery: AutocompleteFilter<LanguageOption> = (option, query) => {
  if (option.label.toLowerCase().includes(query)) return true;
  return option.nativeName?.toLowerCase().includes(query) === true;
};

function LanguagePickerBody({ id, options, value, onChange, placeholder }: LanguagePickerBodyProps) {
  return (
    <Autocomplete
      id={id}
      options={options}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      renderOption={renderLanguageOption}
      filter={matchLanguageQuery}
      size="md"
    />
  );
}

function renderLanguageOption(option: LanguageOption) {
  if (option.nativeName === undefined) {
    return <span className="truncate">{option.label}</span>;
  }
  return (
    <span className="flex-1 min-w-0 flex items-baseline gap-2 truncate">
      <span className="truncate">{option.label}</span>
      <span className="truncate text-fg-faint text-xs">{option.nativeName}</span>
    </span>
  );
}
