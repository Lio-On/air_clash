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
