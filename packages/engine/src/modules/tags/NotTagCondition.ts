import type { Tag } from '@modules/tags/Tag';
import type { TagCondition } from '@modules/tags/TagCondition';

/** Negates the wrapped condition. */
export class NotTagCondition implements TagCondition {

  constructor(private readonly condition: TagCondition) {}

  evaluate(tags: ReadonlySet<Tag>): boolean {
    return !this.condition.evaluate(tags);
  }

  toExpression(): string {
    return `not (${this.condition.toExpression()})`;
  }
}
