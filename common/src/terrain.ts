/**
 * Shared terrain height calculation
 * This function MUST return the same value on both client and server
 * to ensure visual terrain matches physical collision terrain
 */

export const TERRAIN_CONFIG = {
  WATER_LEVEL: 0, // meters
  CENTRAL_PEAK_HEIGHT: 100, // meters
  CENTRAL_PEAK_RADIUS: 250, // meters (very concentrated)
  SMALL_PEAK_HEIGHT: 50, // meters
  SMALL_PEAK_RADIUS: 150, // meters (very concentrated)
  SMALL_PEAK_DISTANCE: 350, // meters from center
} as const;

/**
 * Calculate terrain height at given world coordinates
 * Uses Gaussian/Cosine functions to create smooth mountain peaks
 *
 * @param x - World X coordinate
 * @param z - World Z coordinate
 * @returns Height in meters (0 = sea level)
 */
export function getTerrainHeight(x: number, z: number): number {
  // Central large mountain at origin (0, 0)
  const centralDist = Math.sqrt(x * x + z * z);
  const centralHeight = TERRAIN_CONFIG.CENTRAL_PEAK_HEIGHT *
    Math.exp(-(centralDist * centralDist) / (2 * TERRAIN_CONFIG.CENTRAL_PEAK_RADIUS * TERRAIN_CONFIG.CENTRAL_PEAK_RADIUS));

  // 4 smaller mountains positioned in cardinal directions
  const peaks = [
    { x: TERRAIN_CONFIG.SMALL_PEAK_DISTANCE, z: 0 },     // East
    { x: -TERRAIN_CONFIG.SMALL_PEAK_DISTANCE, z: 0 },    // West
    { x: 0, z: TERRAIN_CONFIG.SMALL_PEAK_DISTANCE },     // North
    { x: 0, z: -TERRAIN_CONFIG.SMALL_PEAK_DISTANCE },    // South
  ];

  let maxSmallPeakHeight = 0;
  for (const peak of peaks) {
    const dx = x - peak.x;
    const dz = z - peak.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    const height = TERRAIN_CONFIG.SMALL_PEAK_HEIGHT *
      Math.exp(-(dist * dist) / (2 * TERRAIN_CONFIG.SMALL_PEAK_RADIUS * TERRAIN_CONFIG.SMALL_PEAK_RADIUS));
    maxSmallPeakHeight = Math.max(maxSmallPeakHeight, height);
  }

  // Combine heights (take maximum to avoid peaks canceling each other)
  const totalHeight = Math.max(centralHeight, maxSmallPeakHeight);

  // Create a raised island base that slopes from center to edges
  const distFromCenter = Math.sqrt(x * x + z * z);
  const islandRadius = 1200; // Island drops to water level at 1200m (soft boundary)
  // Starts at 20m at center, smoothly drops to 0 at edges using quadratic falloff
  const baseTerrain = Math.max(0, 20 * (1 - Math.pow(distFromCenter / islandRadius, 2)));

  // Final height is raised base + mountains on top
  return baseTerrain + totalHeight;
}

/**
 * Check if a position is underwater
 */
export function isUnderwater(x: number, z: number, y: number): boolean {
  const terrainHeight = getTerrainHeight(x, z);
  return y < Math.max(terrainHeight, TERRAIN_CONFIG.WATER_LEVEL);
}
