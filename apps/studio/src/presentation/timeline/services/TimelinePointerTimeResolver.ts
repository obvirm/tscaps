import type {
  TimelineRowBinding,
  TimelineRowViewportRegistry,
} from '@presentation/timeline/controllers/TimelineRowViewportRegistry';

interface MeasuredRow {
  readonly binding: TimelineRowBinding;
  readonly rect: DOMRect;
}

/**
 * Turns a pointer position anywhere over the cuts timeline into a
 * media time, so a gesture that starts on one row can keep going
 * across the rest of them.
 *
 * A row's track is only part of its card: padding, the next card's
 * header and the space between them add up to a tall band where the
 * pointer belongs to no row at all. The whole band answers as the row
 * above it, so the answer is the last row the pointer has actually
 * reached. Leaving a track changes nothing on its own — the pointer
 * has to arrive somewhere — and until it does, the horizontal
 * position keeps deciding the time as if it had never left.
 *
 * Past the mounted rows the answer stops depending on the horizontal
 * position: above the topmost row it is that row's start and below the
 * bottommost it is that row's end, so a drag held outside the panel
 * keeps swallowing rows as the auto-scroll brings them in.
 *
 * Returns `null` when no row can be measured, which is what a hidden
 * panel looks like: the elements are still mounted but every rect
 * collapses to zero.
 */
export class TimelinePointerTimeResolver {

  constructor(private readonly rows: TimelineRowViewportRegistry) {}

  resolve(clientX: number, clientY: number): number | null {
    const measured = this.measureRows();
    const firstRow = measured[0];
    const lastRow = measured[measured.length - 1];
    if (!firstRow || !lastRow) return null;
    if (clientY < firstRow.rect.top) return firstRow.binding.startSec;
    if (clientY > lastRow.rect.bottom) return lastRow.binding.endSec;
    return this.timeAcross(this.rowReached(measured, clientY), clientX);
  }

  private rowReached(measured: MeasuredRow[], clientY: number): MeasuredRow {
    let reached = measured[0]!;
    for (const row of measured) {
      if (row.rect.top > clientY) break;
      reached = row;
    }
    return reached;
  }

  private measureRows(): MeasuredRow[] {
    const measured: MeasuredRow[] = [];
    for (const binding of this.rows.all()) {
      const rect = binding.element.getBoundingClientRect();
      if (rect.width === 0) continue;
      measured.push({ binding, rect });
    }
    return measured.sort((a, b) => a.rect.top - b.rect.top);
  }

  private timeAcross(row: MeasuredRow, clientX: number): number {
    const { binding, rect } = row;
    const fraction = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return binding.startSec + fraction * (binding.endSec - binding.startSec);
  }
}
