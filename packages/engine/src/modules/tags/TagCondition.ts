import type { Tag } from '@modules/tags/Tag';

/**
 * A boolean predicate over a set of tags. Implementations compose
 * into arbitrary expressions (has / not / and / or); `toExpression`
 * renders the condition in the textual form `TagConditionParser`
 * accepts, so a parsed condition round-trips through serialization.
 */
export interface TagCondition {
  evaluate(tags: ReadonlySet<Tag>): boolean;
  toExpression(): string;
}
