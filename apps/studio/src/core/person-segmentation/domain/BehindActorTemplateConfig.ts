import type { TagCondition } from '@tscaps/engine';

/**
 * Template-level opt-in for the text-behind-actor effect. `required`
 * is the on/off switch; `tagCondition` scopes automatic activation to
 * segments whose tag set (own structure tags plus every word's tags)
 * satisfies the boolean expression. A `null` condition qualifies every
 * segment. A user's per-segment force-on ignores both fields.
 */
export interface BehindActorTemplateConfig {
  readonly required: boolean;
  readonly tagCondition: TagCondition | null;
}

export const BEHIND_ACTOR_TEMPLATE_CONFIG_DEFAULT: BehindActorTemplateConfig = {
  required: false,
  tagCondition: null,
};
