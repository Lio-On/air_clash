import { Schema, type, MapSchema } from '@colyseus/schema';
import { GamePhase } from '@air-clash/common';
import { PlayerState } from './PlayerState';

/**
 * Room state synchronized to all clients
 */
export class RoomState extends Schema {
  /**
   * Current game phase
   */
  @type('string')
  phase: GamePhase = GamePhase.LOBBY;

  /**
   * Players in the room (keyed by session ID)
   */
  @type({ map: PlayerState })
  players = new MapSchema<PlayerState>();

  /**
   * Timestamp when countdown started (0 if not started)
   */
  @type('number')
  countdownStart: number = 0;

  /**
   * Timestamp when match started (0 if not started)
   */
  @type('number')
  matchStart: number = 0;

  /**
   * Alive count for Red team
   */
  @type('number')
  aliveRed: number = 0;

  /**
   * Alive count for Blue team
   */
  @type('number')
  aliveBlue: number = 0;
}
