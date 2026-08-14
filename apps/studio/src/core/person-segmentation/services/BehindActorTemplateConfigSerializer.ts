import type { TagConditionParser } from '@tscaps/engine';
import type { BehindActorTemplateConfig } from '@core/person-segmentation/domain/BehindActorTemplateConfig';
import { BEHIND_ACTOR_TEMPLATE_CONFIG_DEFAULT } from '@core/person-segmentation/domain/BehindActorTemplateConfig';

/**
 * JSON-safe form of `BehindActorTemplateConfig`: the parsed tag
 * condition is stored as its textual expression.
 */
export interface SerializedBehindActorTemplateConfig {
  readonly required: boolean;
  readonly tagCondition: string | null;
}

/**
 * Converts `BehindActorTemplateConfig` to and from a JSON-safe record.
 * The parsed `TagCondition` round-trips through its textual expression
 * so any persistence layer can store the config without carrying a
 * parser.
 */
export class BehindActorTemplateConfigSerializer {

  constructor(private readonly tagConditionParser: TagConditionParser) {}

  serialize(config: BehindActorTemplateConfig): SerializedBehindActorTemplateConfig {
    return {
      required: config.required,
      tagCondition: config.tagCondition?.toExpression() ?? null,
    };
  }

  /** Tolerates records saved before the field existed. */
  deserialize(record: SerializedBehindActorTemplateConfig | undefined): BehindActorTemplateConfig {
    if (!record) return BEHIND_ACTOR_TEMPLATE_CONFIG_DEFAULT;
    return {
      required: record.required ?? BEHIND_ACTOR_TEMPLATE_CONFIG_DEFAULT.required,
      tagCondition: record.tagCondition ? this.tagConditionParser.parse(record.tagCondition) : null,
    };
  }
}
