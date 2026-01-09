import { Room, Client } from 'colyseus';
import { CONFIG } from '@air-clash/common';

export class DogfightRoom extends Room {
  private playerCount: number = 0;

  /**
   * Called when room is created
   */
  onCreate(options: any) {
    console.log('🎮 DogfightRoom created:', this.roomId);
    console.log(`📋 Room options:`, options);

    // Set max clients (10 players: 5v5)
    this.maxClients = CONFIG.MAX_PLAYERS_PER_TEAM * 2;

    // Room metadata
    this.setMetadata({
      roomName: CONFIG.ROOM_NAME,
      maxPlayers: this.maxClients,
      currentPlayers: 0,
    });
  }

  /**
   * Called when a client joins the room
   */
  onJoin(client: Client, options: any) {
    this.playerCount++;

    console.log(`👤 Client ${client.sessionId} joined`);
    console.log(`📊 Player count: ${this.playerCount}/${this.maxClients}`);

    // Update metadata
    this.setMetadata({
      ...this.metadata,
      currentPlayers: this.playerCount,
    });
  }

  /**
   * Called when a client leaves the room
   */
  onLeave(client: Client, consented: boolean) {
    this.playerCount--;

    console.log(`👋 Client ${client.sessionId} left (consented: ${consented})`);
    console.log(`📊 Player count: ${this.playerCount}/${this.maxClients}`);

    // Update metadata
    this.setMetadata({
      ...this.metadata,
      currentPlayers: this.playerCount,
    });
  }

  /**
   * Called when room is disposed (no more clients or manually disposed)
   */
  onDispose() {
    console.log('🗑️  DogfightRoom disposed:', this.roomId);
    console.log(`📊 Final player count: ${this.playerCount}`);
  }
}
