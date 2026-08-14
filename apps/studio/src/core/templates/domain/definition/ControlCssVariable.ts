const CONTROL_VARIABLE_PREFIX = '--tscaps-';

/**
 * Naming rule that turns a style-control id into the CSS custom
 * property emitted for it. The id → name mapping is part of the
 * template contract: every emitter and every validation of that
 * contract must agree on it, so it lives here and nowhere else.
 */
export class ControlCssVariable {

  static nameFor(controlId: string): string {
    return `${CONTROL_VARIABLE_PREFIX}${controlId}`;
  }

  private constructor() {}
}
