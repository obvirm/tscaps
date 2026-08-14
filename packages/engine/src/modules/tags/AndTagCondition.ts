import type { Tag } from '@modules/tags/Tag';
import type { TagCondition } from '@modules/tags/TagCondition';

/** True when every operand is true. */
export class AndTagCondition implements TagCondition {

  private readonly conditions: ReadonlyArray<TagCondition>;

  constructor(...conditions: TagCondition[]) {
    this.conditions = conditions;
  }

  evaluate(tags: ReadonlySet<Tag>): boolean {
    return this.conditions.every((condition) => condition.evaluate(tags));
  }

  toExpression(): string {
    return this.conditions.map((condition) => `(${condition.toExpression()})`).join(' and ');
  }
}
