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
} as const;
