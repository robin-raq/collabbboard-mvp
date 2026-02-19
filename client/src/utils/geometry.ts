/**
 * Geometry utilities for rotation and coordinate transforms.
 */

/** Rotate point (px, py) around center (cx, cy) by angleDeg degrees clockwise. */
export function rotatePoint(
  px: number, py: number,
  cx: number, cy: number,
  angleDeg: number,
): { x: number; y: number } {
  const rad = angleDeg * Math.PI / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  return {
    x: cos * (px - cx) - sin * (py - cy) + cx,
    y: sin * (px - cx) + cos * (py - cy) + cy,
  }
}

/**
 * Calculate angle in degrees from center (cx, cy) to pointer (px, py).
 * 0 degrees = directly above (north), increases clockwise.
 * Returns value in 0-360 range.
 */
export function calcAngle(
  px: number, py: number,
  cx: number, cy: number,
): number {
  const angle = Math.atan2(px - cx, -(py - cy)) * (180 / Math.PI)
  return (angle + 360) % 360
}
