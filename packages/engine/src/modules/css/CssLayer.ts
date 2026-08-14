/**
 * Cascade layers the framework publishes as part of its stylesheet
 * contract, mirroring how `CssClass` names the published classes.
 *
 * Only the framework's own layer is named here. A consumer that wants
 * its stylesheets to lose to the framework's `!important` rules and win
 * over its normal ones puts them in layers of its own, declared after
 * this one — layers are ordered by first appearance, and the framework
 * baseline is emitted first.
 *
 * The layer is load-bearing rather than cosmetic. Cascade order puts
 * unlayered `!important` declarations *below* layered ones, so a
 * framework rule left outside a layer would lose to any `!important` a
 * consumer writes — including the frozen-frame rule that makes a
 * rendered frame a function of the playhead.
 */
export enum CssLayer {
  FRAMEWORK = 'tscaps-framework',
}
