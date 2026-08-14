import type { AssetRepository } from '@core/assets/domain/AssetRepository';
import type { AssetReferenceIndex } from '@core/templates/domain/contract/AssetReferenceIndex';

/**
 * Projects the live asset repository as a membership test, so
 * contract validation sees user-uploaded assets the moment they
 * register.
 */
export class RepositoryAssetReferenceIndex implements AssetReferenceIndex {
  constructor(private readonly repository: AssetRepository) {}

  has(id: string): boolean {
    return this.repository.resolve(id) !== null;
  }
}
