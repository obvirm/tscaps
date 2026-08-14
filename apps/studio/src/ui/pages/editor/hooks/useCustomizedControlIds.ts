import { useMemo } from 'react';
import type { Sheet } from '@core/sheets/domain/Sheet';
import { useSheets } from '@ui/_shared/contexts/modules/SheetsContext';

/**
 * The controls this sheet's own CSS has taken over: ones the template
 * drove through a variable and the sheet's current sources no longer
 * read. Their values are still stored and still emitted — nothing reads
 * them, so moving them changes nothing.
 *
 * Empty for a sheet with no source overrides, which is every sheet until
 * someone opens the Code tab.
 */
export function useCustomizedControlIds(sheet: Sheet | null): ReadonlySet<string> {
  const { disconnectedControlFinder } = useSheets();
  return useMemo(() => {
    if (!sheet) return new Set<string>();
    if (sheet.cssOverride === null && sheet.filtersSvgOverride === null) return new Set<string>();
    return disconnectedControlFinder.find(
      { css: sheet.template.getCss(), filtersSvg: sheet.template.getFiltersSvg() },
      { css: sheet.resolveCss(), filtersSvg: sheet.resolveFiltersSvg() },
    );
  }, [disconnectedControlFinder, sheet]);
}
