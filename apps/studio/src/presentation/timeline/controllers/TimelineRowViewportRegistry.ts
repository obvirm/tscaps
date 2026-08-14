export interface TimelineRowBinding {
  readonly index: number;
  readonly startSec: number;
  readonly endSec: number;
  readonly element: HTMLElement;
}

/**
 * The timeline rows currently mounted, so a pointer position can be
 * turned into a time without every collaborator keeping its own copy
 * of the table. The list only ever holds what the virtualizer has on
 * screen; rows scrolled far away are absent by design.
 */
export class TimelineRowViewportRegistry {
  private readonly bindings = new Map<number, TimelineRowBinding>();

  register(binding: TimelineRowBinding): void {
    this.bindings.set(binding.index, binding);
  }

  unregister(index: number): void {
    this.bindings.delete(index);
  }

  all(): IterableIterator<TimelineRowBinding> {
    return this.bindings.values();
  }

  /**
   * Any row currently on screen, for readings that hold across all of
   * them. Rows are equal slices of the clock drawn at one scale, so one
   * serves as a specimen for the rest. Null when none is mounted.
   */
  anyMounted(): TimelineRowBinding | null {
    for (const binding of this.bindings.values()) return binding;
    return null;
  }

  clear(): void {
    this.bindings.clear();
  }
}
