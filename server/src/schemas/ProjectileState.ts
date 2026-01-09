import { Schema, type } from '@colyseus/schema';

export class ProjectileState extends Schema {
  @type('string') id: string = '';
  @type('string') ownerId: string = ''; // Session ID of player who fired it
  @type('string') ownerTeam: string = 'RED';

  // Position
  @type('number') posX: number = 0;
  @type('number') posY: number = 0;
  @type('number') posZ: number = 0;

  // Velocity
  @type('number') velocityX: number = 0;
  @type('number') velocityY: number = 0;
  @type('number') velocityZ: number = 0;

  // Lifetime
  @type('number') createdAt: number = 0;
  @type('number') maxLifetime: number = 3000; // 3 seconds
}
