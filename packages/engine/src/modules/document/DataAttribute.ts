/**
 * DOM attributes the framework publishes on rendered elements as part
 * of its stylesheet contract, mirroring how {@link CssClass} names the
 * published classes and `CssVariable` the published custom properties.
 *
 * An attribute lives here rather than being written as a literal
 * because two different renderers produce the caption DOM — the export
 * path and any consumer that mounts its own tree — and a stylesheet
 * addressing an element has to match in both. A literal in one of them
 * is a contract that can drift.
 */
export enum DataAttribute {
  /**
   * Carries the id of the document element the node was rendered
   * from, so a stylesheet can address one specific element rather
   * than a class of them.
   *
   * Present only on elements the caller asked for. The attribute costs
   * 40 bytes with a {@link DocumentNodeId}, and the markup holding it
   * is serialized once per rendered tile, so on a caption whose every
   * word is addressed it is a double-digit percentage of the batch.
   * Addressing nothing costs nothing.
   */
  ELEMENT_ID = 'data-tscaps-el',
}
