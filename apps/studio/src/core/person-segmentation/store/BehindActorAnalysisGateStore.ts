/**
 * Observable flag for the moment on screen being one nobody has
 * measured yet.
 *
 * While it is set, playback is held and the frame is not to be read as
 * a finished one: the effect's answer for that instant is not "off",
 * it is "not yet". Showing it as off would put the preview at odds
 * with the file an export burns, which is the one thing the two are
 * not allowed to disagree on.
 *
 * Subscribers listen for the `'change'` event and read `blocked`.
 */
export class BehindActorAnalysisGateStore extends EventTarget {
  private waiting = false;

  get blocked(): boolean {
    return this.waiting;
  }

  set(blocked: boolean): void {
    if (this.waiting === blocked) return;
    this.waiting = blocked;
    this.dispatchEvent(new Event('change'));
  }
}
