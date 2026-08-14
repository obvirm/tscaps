import type { CssContractRule } from '@core/templates/domain/contract/CssContractRule';
import type { ContractViolation } from '@core/templates/domain/contract/ContractViolation';
import type { AssetReferenceIndex } from '@core/templates/domain/contract/AssetReferenceIndex';

const ASSET_TOKEN_PATTERN = /asset:([a-zA-Z0-9_-]+)/g;

/**
 * Flags every `asset:<id>` token whose id no file in the asset pool
 * registers. The scan covers the whole source, so tokens hiding
 * inside `var()` fallbacks are found too.
 */
export class AssetReferencesCssContractRule implements CssContractRule {
  constructor(private readonly assetReferenceIndex: AssetReferenceIndex) {}

  check(minifiedCss: string): ContractViolation[] {
    const violations: ContractViolation[] = [];
    for (const match of minifiedCss.matchAll(ASSET_TOKEN_PATTERN)) {
      const id = match[1]!;
      if (this.assetReferenceIndex.has(id)) continue;
      violations.push({
        message: `Unknown asset id "asset:${id}": no file in the asset pool registers it.`,
      });
    }
    return violations;
  }
}
