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

    // Register message handlers
    this.setupMessageHandlers();

    console.log(`📍 Room phase: ${this.state.phase}`);
  }

  /**
   * Setup message handlers for lobby actions
   */
  private setupMessageHandlers() {
    // Set pilot name
    this.onMessage('setPilotName', (client, message: { name: string }) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;

      // Validate name
      const trimmedName = message.name?.trim();
      if (!trimmedName || trimmedName.length === 0) {
        console.log(`❌ Client ${client.sessionId} tried to set empty name`);
        client.send('error', { message: 'Name cannot be empty' });
        return;
      }

      if (trimmedName.length > 20) {
        console.log(`❌ Client ${client.sessionId} tried to set name too long: ${trimmedName}`);
        client.send('error', { message: 'Name cannot exceed 20 characters' });
        return;
      }

      // Update player name
      player.name = trimmedName;
      console.log(`✏️  Player ${client.sessionId} set name to "${trimmedName}"`);
    });

    // Choose team
    this.onMessage('chooseTeam', (client, message: { team: Team }) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;

      // Validate phase - cannot change team during countdown or match
      if (this.state.phase !== GamePhase.LOBBY) {
        console.log(`❌ Client ${client.sessionId} tried to change team during ${this.state.phase}`);
        client.send('error', { message: 'Cannot change team after lobby phase' });
        return;
      }

      // Validate team value
      if (message.team !== Team.RED && message.team !== Team.BLUE) {
        console.log(`❌ Client ${client.sessionId} tried to set invalid team: ${message.team}`);
        client.send('error', { message: 'Invalid team' });
        return;
      }

      // Check team capacity (only for human players, not bots)
      if (!player.isBot) {
        const teamCount = this.getTeamCount(message.team, false); // Count only humans
        if (teamCount >= CONFIG.MAX_PLAYERS_PER_TEAM) {
          console.log(`❌ Client ${client.sessionId} tried to join full team ${message.team} (${teamCount}/${CONFIG.MAX_PLAYERS_PER_TEAM})`);
          client.send('error', { message: `Team ${message.team} is full (${CONFIG.MAX_PLAYERS_PER_TEAM}/${CONFIG.MAX_PLAYERS_PER_TEAM})` });
          return;
        }
      }

      // Update player team
      const oldTeam = player.team;
      player.team = message.team;
      console.log(`🔄 Player ${client.sessionId} changed team: ${oldTeam} → ${message.team}`);
    });

    // Toggle ready
    this.onMessage('toggleReady', (client) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;

      // Can only ready in lobby phase
      if (this.state.phase !== GamePhase.LOBBY) {
        console.log(`❌ Client ${client.sessionId} tried to toggle ready during ${this.state.phase}`);
        client.send('error', { message: 'Can only ready in lobby' });
        return;
      }

      // Toggle ready state
      player.ready = !player.ready;
      console.log(`${player.ready ? '✅' : '⬜'} Player ${client.sessionId} (${player.name}) is ${player.ready ? 'READY' : 'NOT READY'}`);
    });
  }

  /**
   * Count players on a specific team
   */
  private getTeamCount(team: Team, includeBots: boolean = true): number {
    let count = 0;
    this.state.players.forEach((player) => {
      if (player.team === team) {
        if (includeBots || !player.isBot) {
          count++;
        }
      }
    });
    return count;
  }

  /**
   * Called when a client joins the room
   */
  onJoin(client: Client, options: any) {
    console.log(`👤 Client ${client.sessionId} joined`);

    // Generate player name
    const playerName = options.name || `Player-${client.sessionId.substring(0, 4)}`;

    // Auto-assign to team with fewer players (for balance)
    const redCount = this.getTeamCount(Team.RED, false);
    const blueCount = this.getTeamCount(Team.BLUE, false);
    const playerTeam = redCount <= blueCount ? Team.RED : Team.BLUE;

    const player = new PlayerState(
      client.sessionId,
      playerName,
      playerTeam,
      false // not a bot
    );

    // Add player to state
    this.state.players.set(client.sessionId, player);

    console.log(`📊 Player count: ${this.state.players.size}/${this.maxClients}`);
    console.log(`👤 Player "${playerName}" auto-assigned to team ${playerTeam} (Red: ${redCount + (playerTeam === Team.RED ? 1 : 0)}, Blue: ${blueCount + (playerTeam === Team.BLUE ? 1 : 0)})`);

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
