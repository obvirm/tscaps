import type { CSSProperties } from 'react';
import type { TimelinePointerOrigin } from '@presentation/timeline/controllers/TimelinePointerDragController';
import type { TimelineCellPiece } from '@presentation/timeline/services/TimelineProjection';

// Abutting cells are the norm — words butt against each other and a
// silence butts against the words on both sides — so each cell gives up
// a pixel at its end. Without it a run of them reads as one long chip.
// A cut side gives up nothing: there is no neighbour there, only the
// rest of the same cell in the next row.
const CELL_END_GAP_PX = 1;

interface PointerEventLike {
  readonly pointerId: number;
  readonly clientX: number;
  readonly clientY: number;
  readonly pointerType: string;
}

/** Narrows a pointer event down to what a cuts gesture needs to start. */
export function pointerOrigin(event: PointerEventLike): TimelinePointerOrigin {
  return {
    pointerId: event.pointerId,
    clientX: event.clientX,
    clientY: event.clientY,
    pointerType: event.pointerType,
  };
}

// Scenes share the cell-hover controller with words and silences, so
// their ids have to live in the same namespace without colliding.
const SCENE_CELL_PREFIX = 'scene-';

/** Names a scene for the shared cell-hover state. */
export function sceneCellId(segmentId: string): string {
  return `${SCENE_CELL_PREFIX}${segmentId}`;
}

/** The scene a hovered cell id names, or null when it names anything else. */
export function segmentIdOfCell(cellId: string | null): string | null {
  if (cellId === null || !cellId.startsWith(SCENE_CELL_PREFIX)) return null;
  return cellId.slice(SCENE_CELL_PREFIX.length);
}

export function percentage(value: number, total: number): string {
  if (total <= 0) return '0%';
  return `${(value / total) * 100}%`;
}

/**
 * Where one piece of a cell sits inside the row drawing it, as a fill
 * of whatever band it is placed in.
 */
export function cellPieceStyle(
  piece: TimelineCellPiece,
  rowStartSec: number,
  rowDurationSec: number,
): CSSProperties {
  const widthPct = percentage(piece.endSec - piece.startSec, rowDurationSec);
  return {
    position: 'absolute',
    left: percentage(piece.startSec - rowStartSec, rowDurationSec),
    top: 0,
    bottom: 0,
    width: piece.cutAtEnd ? widthPct : `calc(${widthPct} - ${CELL_END_GAP_PX}px)`,
  };
}
