// Shared types and constants for Air Clash

/**
 * Team enum
 */
export enum Team {
  RED = 'RED',
  BLUE = 'BLUE'
}

/**
 * Game phase enum
 */
export enum GamePhase {
  LOBBY = 'LOBBY',
  COUNTDOWN = 'COUNTDOWN',
  IN_MATCH = 'IN_MATCH',
  RESULTS = 'RESULTS'
}

/**
 * Player state interface
 */
export interface PlayerState {
  id: string;
  name: string;
  team: Team;
  ready: boolean;
  alive: boolean;
  isBot: boolean;
}

/**
 * Configuration constants
 */
export const CONFIG = {
  MAX_PLAYERS_PER_TEAM: 5,
  COUNTDOWN_DURATION: 5000, // milliseconds
  SPAWN_PROTECTION_DURATION: 2000, // milliseconds
  SERVER_TICK_RATE: 30, // Hz
  SNAPSHOT_RATE: 15, // Hz
  ROOM_NAME: 'dogfight', // Colyseus room name

  // Arena and spawn configuration
  ARENA_SIZE: 2000, // meters (arena is 2000x2000)
  SPAWN_ALTITUDE: 200, // meters above ground (lower altitude for combat start)
  SPAWN_DISTANCE_FROM_CENTER: 1100, // meters from island center (just inside 1200m soft boundary)
  SPAWN_INITIAL_SPEED: 50, // meters per second
  SPAWN_SPACING: 50, // meters between planes on same team
} as const;

/**
 * Environment types
 */
export type Environment = 'development' | 'production';

/**
 * Debug configuration
 */
export interface DebugConfig {
  showFPS: boolean;
  showColliders: boolean;
  verboseLogging: boolean;
}

/**
 * Terrain utilities
 */
export { getTerrainHeight, isUnderwater, TERRAIN_CONFIG } from './terrain';
