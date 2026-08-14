/**
 * Membership test over the asset ids template CSS may reference via
 * `asset:<id>` tokens. Implementations answer from live state, so an
 * asset registered after construction is immediately visible.
 */
export interface AssetReferenceIndex {
  has(id: string): boolean;
}
