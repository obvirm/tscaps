import type { Tag } from '@modules/tags/Tag';
import type { TagCondition } from '@modules/tags/TagCondition';

/** True when any tag in the set carries the given name. */
export class HasTagCondition implements TagCondition {

  constructor(private readonly tagName: string) {}

  evaluate(tags: ReadonlySet<Tag>): boolean {
    for (const tag of tags) {
      if (tag.name === this.tagName) return true;
    }
    return false;
  }

  toExpression(): string {
    return this.tagName;
  }
}
