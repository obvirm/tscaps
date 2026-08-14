import type { TimelineDetailChoicesRepository } from '@core/timeline/domain/TimelineDetailChoicesRepository';
import {
  TIMELINE_DETAILS,
  TIMELINE_DETAIL_SHOWN_BY_DEFAULT,
  type TimelineDetail,
  type TimelineDetailChoices,
} from '@core/timeline/domain/TimelineDetail';

/** Whether each of the timeline's details is being drawn. */
export type TimelineDetailVisibility = Readonly<Record<TimelineDetail, boolean>>;

/**
 * Which of the timeline's details are drawn, with what the reader has
 * decided laid over what the build draws by default.
 *
 * The two are kept apart rather than folded together on the way in: only
 * the decisions are remembered, so a default the build later revises
 * reaches everyone who never expressed an opinion about that detail, and
 * nobody else.
 *
 * Subscribers listen for `'change'` and read `visible`, which is
 * replaced rather than mutated so a comparison by identity is enough to
 * notice.
 */
export class TimelineVisibilityController extends EventTarget {

  private choices: TimelineDetailChoices;
  private _visible: TimelineDetailVisibility;

  constructor(private readonly repository: TimelineDetailChoicesRepository) {
    super();
    this.choices = repository.load();
    this._visible = this.resolve();
  }

  get visible(): TimelineDetailVisibility {
    return this._visible;
  }

  toggle(detail: TimelineDetail): void {
    this.choices = { ...this.choices, [detail]: !this._visible[detail] };
    this._visible = this.resolve();
    this.repository.save(this.choices);
    this.dispatchEvent(new Event('change'));
  }

  private resolve(): TimelineDetailVisibility {
    const resolved: Record<TimelineDetail, boolean> = { ...TIMELINE_DETAIL_SHOWN_BY_DEFAULT };
    for (const detail of TIMELINE_DETAILS) {
      const chosen = this.choices[detail];
      if (chosen !== undefined) resolved[detail] = chosen;
    }
    return resolved;
  }
}
