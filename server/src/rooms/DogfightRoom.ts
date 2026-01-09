import { Room, Client } from 'colyseus';
import { CONFIG, Team, GamePhase } from '@air-clash/common';
import { RoomState } from '../schemas/RoomState';
import { PlayerState } from '../schemas/PlayerState';

export class DogfightRoom extends Room<RoomState> {
  /**
   * Called when room is created
   */
  onCreate(options: any) {
    console.log('🎮 DogfightRoom created:', this.roomId);
    console.log(`📋 Room options:`, options);

    // Initialize room state
    this.setState(new RoomState());

    // Set max clients (10 players: 5v5)
    this.maxClients = CONFIG.MAX_PLAYERS_PER_TEAM * 2;

    // Room starts in LOBBY phase
    this.state.phase = GamePhase.LOBBY;

    // Room metadata
    this.setMetadata({
      roomName: CONFIG.ROOM_NAME,
      maxPlayers: this.maxClients,
      currentPlayers: 0,
      phase: this.state.phase,
    });

    console.log(`📍 Room phase: ${this.state.phase}`);
  }

  /**
   * Called when a client joins the room
   */
  onJoin(client: Client, options: any) {
    console.log(`👤 Client ${client.sessionId} joined`);

    // Create player state with default values
    // Team assignment will be handled in Step 2.3 (lobby actions)
    const playerName = options.name || `Player-${client.sessionId.substring(0, 4)}`;
    const playerTeam = Team.RED; // Default team for now

    const player = new PlayerState(
      client.sessionId,
      playerName,
      playerTeam,
      false // not a bot
    );

    // Add player to state
    this.state.players.set(client.sessionId, player);

    console.log(`📊 Player count: ${this.state.players.size}/${this.maxClients}`);
    console.log(`👤 Player "${playerName}" assigned to team ${playerTeam}`);

    // Update metadata
    this.setMetadata({
      ...this.metadata,
      currentPlayers: this.state.players.size,
    });
  }

  /**
   * Called when a client leaves the room
   */
  onLeave(client: Client, consented: boolean) {
    console.log(`👋 Client ${client.sessionId} left (consented: ${consented})`);

    // Remove player from state
    this.state.players.delete(client.sessionId);

    console.log(`📊 Player count: ${this.state.players.size}/${this.maxClients}`);

    // Update metadata
    this.setMetadata({
      ...this.metadata,
      currentPlayers: this.state.players.size,
    });
  }

  /**
   * Called when room is disposed (no more clients or manually disposed)
   */
  onDispose() {
    console.log('🗑️  DogfightRoom disposed:', this.roomId);
    console.log(`📊 Final player count: ${this.state.players.size}`);
    console.log(`📍 Final phase: ${this.state.phase}`);
  }
}
