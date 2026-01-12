/**
 * Shared terrain height calculation
 * This function MUST return the same value on both client and server
 * to ensure visual terrain matches physical collision terrain
 */

export const TERRAIN_CONFIG = {
  WATER_LEVEL: 0, // meters
  CENTRAL_PEAK_HEIGHT: 250, // meters (Increased height)
  CENTRAL_PEAK_RADIUS: 300, // meters
  CRATER_RADIUS: 80, // Width of volcano mouth
  CRATER_DEPTH: 80, // Depth of depression
  SMALL_PEAK_HEIGHT: 120, // meters
  SMALL_PEAK_RADIUS: 180, // meters
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
  const distFromCenter = Math.sqrt(x * x + z * z);

  // 1. Central Volcano
  const mainMountain = TERRAIN_CONFIG.CENTRAL_PEAK_HEIGHT *
    Math.exp(-(distFromCenter * distFromCenter) / (2 * TERRAIN_CONFIG.CENTRAL_PEAK_RADIUS * TERRAIN_CONFIG.CENTRAL_PEAK_RADIUS));

  // Crater subtraciton (sharper gaussian at center)
  const crater = TERRAIN_CONFIG.CRATER_DEPTH *
    Math.exp(-(distFromCenter * distFromCenter) / (2 * TERRAIN_CONFIG.CRATER_RADIUS * TERRAIN_CONFIG.CRATER_RADIUS));

  const volcanoHeight = Math.max(0, mainMountain - crater);

  // 2. Asymmetric surrounding mountains
  // Hardcoded irregular positions to look natural/random but remain deterministic
  const peaks = [
    { x: 500, z: 100, h: 1.0, r: 1.0 },      // East-ish, normal size
    { x: -450, z: 300, h: 1.2, r: 1.1 },     // North-West, taller/wider
    { x: -300, z: -500, h: 0.8, r: 0.9 },    // South-West, smaller
    { x: 200, z: -600, h: 1.1, r: 1.2 },     // South-East, wide
  ];

  let maxSmallPeakHeight = 0;
  for (const peak of peaks) {
    const dx = x - peak.x;
    const dz = z - peak.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    const peakRadius = TERRAIN_CONFIG.SMALL_PEAK_RADIUS * peak.r;
    const peakMaxHeight = TERRAIN_CONFIG.SMALL_PEAK_HEIGHT * peak.h;

    const height = peakMaxHeight *
      Math.exp(-(dist * dist) / (2 * peakRadius * peakRadius));
    maxSmallPeakHeight = Math.max(maxSmallPeakHeight, height); // Soft union
  }

  // Combine heights (take maximum to avoid peaks canceling each other)
  const totalHeight = Math.max(volcanoHeight, maxSmallPeakHeight);

  // Create a raised island base that slopes from center to edges
  const islandRadius = 1300; // Slightly larger base
  // Starts at 30m at center, smoothly drops to 0 at edges using quadratic falloff
  const baseTerrain = Math.max(0, 30 * (1 - Math.pow(distFromCenter / islandRadius, 2)));

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
