import type { AnimationStateFingerprint } from '@modules/rendering/subtitle/AnimationStateFingerprint';

/**
 * Describes nothing, at any timestamp: no two states are ever
 * comparable. Reads no CSS and mounts nothing.
 */
export class UnknownAnimationStateFingerprint implements AnimationStateFingerprint {
  at(): Promise<string | null> {
    return Promise.resolve(null);
  }
}
