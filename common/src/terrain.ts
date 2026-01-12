/**
 * Shared terrain height calculation
 * This function MUST return the same value on both client and server
 * to ensure visual terrain matches physical collision terrain
 */

export const TERRAIN_CONFIG = {
  WATER_LEVEL: 11, // meters (Updated to match client)
  CENTRAL_PEAK_HEIGHT: 250, // meters
  CENTRAL_PEAK_RADIUS: 300, // meters
  CRATER_RADIUS: 80, // Width of volcano mouth
  CRATER_DEPTH: 80, // Depth of depression
  SMALL_PEAK_HEIGHT: 120, // meters
  SMALL_PEAK_RADIUS: 180, // meters
  RIVER_WIDTH_START: 20, // Width at source
  RIVER_WIDTH_END: 100, // Width at sea
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

  // Crater subtraction
  const crater = TERRAIN_CONFIG.CRATER_DEPTH *
    Math.exp(-(distFromCenter * distFromCenter) / (2 * TERRAIN_CONFIG.CRATER_RADIUS * TERRAIN_CONFIG.CRATER_RADIUS));

  const volcanoHeight = Math.max(0, mainMountain - crater);

  // 2. Asymmetric surrounding mountains
  // Hardcoded irregular positions to look natural/random but remain deterministic
  const peaks = [
    { x: 500, z: 100, h: 1.0, r: 1.0 },      // East-ish
    { x: -450, z: 300, h: 1.2, r: 1.1 },     // North-West
    { x: -300, z: -500, h: 0.8, r: 0.9 },    // South-West
    { x: 200, z: -600, h: 1.1, r: 1.2 },     // South-East
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
    maxSmallPeakHeight = Math.max(maxSmallPeakHeight, height);
  }

  // Combine mountains
  const totalHeight = Math.max(volcanoHeight, maxSmallPeakHeight);

  // 3. Island Base
  const islandRadius = 1300;
  const baseTerrain = Math.max(0, 30 * (1 - Math.pow(distFromCenter / islandRadius, 2)));

  let finalHeight = baseTerrain + totalHeight;

  // 4. River Carving (Flows East along +X axis)
  // River starts at X=80 (crater rim) and goes to edge
  if (x > 50) {
    const riverProgress = Math.min(1, (x - 50) / 1200); // 0 to 1 along length
    const currentWidth = TERRAIN_CONFIG.RIVER_WIDTH_START +
      (TERRAIN_CONFIG.RIVER_WIDTH_END - TERRAIN_CONFIG.RIVER_WIDTH_START) * riverProgress;

    // Check if point is within river bank
    if (Math.abs(z) < currentWidth) {
      // 0 at center, 1 at edge
      const bankFactor = Math.abs(z) / currentWidth;

      // Cosine shape for smooth channel: 1 at center, 0 at edge
      const depthFactor = (Math.cos(bankFactor * Math.PI) + 1) / 2;

      // Calculate depth to carve
      // We want the river bottom to be safely underwater (e.g. Water Level - 5m)
      const riverBottom = Math.max(0, TERRAIN_CONFIG.WATER_LEVEL - 5);

      // Smoothly fade in river from source
      const startRamp = Math.min(1, (x - 50) / 100);

      const targetHeight = riverBottom;

      // If terrain is higher than river bottom, carve down
      if (finalHeight > targetHeight) {
        const carveAmount = (finalHeight - targetHeight) * depthFactor * startRamp;
        finalHeight -= carveAmount;
      }
    }
  }

  return finalHeight;
}

/**
 * Check if a position is underwater
 */
export function isUnderwater(x: number, z: number, y: number): boolean {
  const terrainHeight = getTerrainHeight(x, z);
  return y < Math.max(terrainHeight, TERRAIN_CONFIG.WATER_LEVEL);
}
