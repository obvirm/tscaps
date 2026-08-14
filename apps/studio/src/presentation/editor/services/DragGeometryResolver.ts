import type { BoxOrigin, BoxSize } from '@presentation/editor/services/AlignmentGeometryResolver';

export interface DragCentroid {
  readonly centroidXFrac: number;
  readonly centroidYFrac: number;
  readonly boxWidthFrac: number;
  readonly boxHeightFrac: number;
}

/**
 * Pixel-to-fraction conversion for overlay drag gestures. Takes the
 * captured box rect at drag-start, the scaler rect (the frame), and
 * the cursor delta, and returns the box's centroid and dimensions as
 * fractions of the frame. Pure: the caller measures rects, this
 * derives.
 */
export class DragGeometryResolver {
  centroid(
    wrapperRect: DOMRect,
    scalerRect: DOMRect,
    deltaX: number,
    deltaY: number,
  ): DragCentroid {
    const centroidPxX = wrapperRect.left + wrapperRect.width / 2 - scalerRect.left + deltaX;
    const centroidPxY = wrapperRect.top + wrapperRect.height / 2 - scalerRect.top + deltaY;
    return {
      centroidXFrac: centroidPxX / scalerRect.width,
      centroidYFrac: centroidPxY / scalerRect.height,
      boxWidthFrac: wrapperRect.width / scalerRect.width,
      boxHeightFrac: wrapperRect.height / scalerRect.height,
    };
  }

  /**
   * Same conversion as `centroid`, for a box already stated in frame
   * coordinates. Preferred whenever the box's layout position is known:
   * a measured client rect carries the element's rotation and lift
   * transforms, and both would bake into the resolved anchor.
   */
  centroidFromOrigin(
    origin: BoxOrigin,
    box: BoxSize,
    frame: BoxSize,
    deltaX: number,
    deltaY: number,
  ): DragCentroid {
    return {
      centroidXFrac: (origin.left + box.width / 2 + deltaX) / frame.width,
      centroidYFrac: (origin.top + box.height / 2 + deltaY) / frame.height,
      boxWidthFrac: box.width / frame.width,
      boxHeightFrac: box.height / frame.height,
    };
  }
}
