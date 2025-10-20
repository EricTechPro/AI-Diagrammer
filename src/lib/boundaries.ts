import { Position, Dimensions } from '../types/diagram';

export const CANVAS_BOUNDS = {
  minX: 50,
  minY: 50,
  maxX: 2950,
  maxY: 2950,
  width: 3000,
  height: 3000,
};

export const GRID_SIZE = 20;

export function snapToGrid(value: number): number {
  return Math.round(value / GRID_SIZE) * GRID_SIZE;
}

export function snapPositionToGrid(position: Position): Position {
  return {
    x: snapToGrid(position.x),
    y: snapToGrid(position.y),
  };
}

export function constrainPosition(
  position: Position,
  dimensions: Dimensions
): Position {
  return {
    x: Math.max(
      CANVAS_BOUNDS.minX,
      Math.min(position.x, CANVAS_BOUNDS.maxX - dimensions.width)
    ),
    y: Math.max(
      CANVAS_BOUNDS.minY,
      Math.min(position.y, CANVAS_BOUNDS.maxY - dimensions.height)
    ),
  };
}

export function constrainAndSnapPosition(
  position: Position,
  dimensions: Dimensions
): Position {
  const snapped = snapPositionToGrid(position);
  return constrainPosition(snapped, dimensions);
}

export function isWithinBounds(
  position: Position,
  dimensions: Dimensions
): boolean {
  return (
    position.x >= CANVAS_BOUNDS.minX &&
    position.y >= CANVAS_BOUNDS.minY &&
    position.x + dimensions.width <= CANVAS_BOUNDS.maxX &&
    position.y + dimensions.height <= CANVAS_BOUNDS.maxY
  );
}
