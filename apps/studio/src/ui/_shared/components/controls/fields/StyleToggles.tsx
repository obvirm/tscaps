import { memo, useMemo } from 'react';
import { Italic, Underline, Strikethrough } from 'lucide-react';
import { IconToggleStrip, type IconToggleItem } from '@ui/_shared/components/controls/fields/IconToggleStrip';

export interface StyleTogglesValue {
  italic: boolean;
  underline: boolean;
  strikethrough: boolean;
}

interface StyleTogglesProps {
  value: StyleTogglesValue;
  onChange: (patch: Partial<StyleTogglesValue>) => void;
}

const LABELS: Readonly<Record<keyof StyleTogglesValue, string>> = {
  italic: 'Italic',
  underline: 'Underline',
  strikethrough: 'Strikethrough',
};

const ICONS: Readonly<Record<keyof StyleTogglesValue, React.ReactNode>> = {
  italic: <Italic size={13} />,
  underline: <Underline size={13} />,
  strikethrough: <Strikethrough size={13} />,
};

const KEYS: ReadonlyArray<keyof StyleTogglesValue> = ['italic', 'underline', 'strikethrough'];

/**
 * The sheet's italic/underline/strikethrough switches. Bold has its own
 * dedicated Weight slider — the binary toggle was dropped when
 * typography moved to a numeric `fontWeight` (variable fonts make the
 * full 100..900 range meaningful, so a 2-state toggle is the wrong
 * primitive). Callers provide their own row or label around it.
 */
export const StyleToggles = memo(function StyleToggles({ value, onChange }: StyleTogglesProps) {
  const items = useMemo<ReadonlyArray<IconToggleItem>>(
    () => KEYS.map((key) => ({ id: key, label: LABELS[key], icon: ICONS[key], pressed: value[key] })),
    [value],
  );
  return (
    <IconToggleStrip
      items={items}
      ariaLabel="Style"
      onToggle={(id, pressed) => onChange({ [id]: pressed } as Partial<StyleTogglesValue>)}
    />
  );
});
