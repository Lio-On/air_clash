import { Schema, type } from '@colyseus/schema';
import { Team } from '@air-clash/common';

/**
 * Player state synchronized to all clients
 */
export class PlayerState extends Schema {
  @type('string')
  id: string = '';

  @type('string')
  name: string = '';

  @type('string')
  team: Team = Team.RED;

  @type('boolean')
  ready: boolean = false;

  @type('boolean')
  alive: boolean = false;

  @type('boolean')
  isBot: boolean = false;

  // Position (3D coordinates)
  @type('number')
  posX: number = 0;

  @type('number')
  posY: number = 0;

  @type('number')
  posZ: number = 0;

  // Rotation (Euler angles in radians)
  @type('number')
  rotX: number = 0;

  @type('number')
  rotY: number = 0;

  @type('number')
  rotZ: number = 0;

  // Velocity
  @type('number')
  velocityX: number = 0;

  @type('number')
  velocityY: number = 0;

  @type('number')
  velocityZ: number = 0;

  // Spawn protection
  @type('boolean')
  invulnerable: boolean = false;

  @type('number')
  spawnProtectionEnd: number = 0; // Timestamp when protection ends

  constructor(id: string, name: string, team: Team, isBot: boolean = false) {
    super();
    this.id = id;
    this.name = name;
    this.team = team;
    this.isBot = isBot;
    this.ready = false;
    this.alive = false;
  }
}
