import { Room, Client } from 'colyseus';
import { CONFIG, Team, GamePhase } from '@air-clash/common';
import { RoomState } from '../schemas/RoomState';
import { PlayerState } from '../schemas/PlayerState';
import { ProjectileState } from '../schemas/ProjectileState';

export class DogfightRoom extends Room<RoomState> {
  private countdownTimer?: NodeJS.Timeout;
  private projectileIdCounter: number = 0;

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

    // Setup physics simulation loop (30Hz = ~33ms per tick)
    const tickRate = CONFIG.SERVER_TICK_RATE || 30;
    const deltaTime = 1 / tickRate;
    this.setSimulationInterval((deltaTime) => {
      this.updatePhysics(deltaTime / 1000); // Convert ms to seconds
    }, 1000 / tickRate);

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

      // Check if all humans are ready and fill bots if needed
      this.checkAndFillBots();
    });

    // Player input (flight controls)
    this.onMessage('playerInput', (client, message: { up: boolean; down: boolean; left: boolean; right: boolean; shoot: boolean }) => {
      // Debug: Log first input received per client
      if (!(client as any)._hasLoggedInput) {
        console.log(`🎮 First playerInput received from ${client.sessionId}`);
        (client as any)._hasLoggedInput = true;
      }

      const player = this.state.players.get(client.sessionId);
      if (!player) {
        console.log(`⚠️  playerInput from ${client.sessionId} but player not found`);
        return;
      }

      // Only process input during match
      if (this.state.phase !== GamePhase.IN_MATCH) {
        // Log once per client if they send input too early
        if (!(client as any)._hasLoggedWrongPhase) {
          console.log(`⚠️  playerInput from ${client.sessionId} during ${this.state.phase} (expecting IN_MATCH)`);
          (client as any)._hasLoggedWrongPhase = true;
        }
        return;
      }

      // Only process input for alive players
      if (!player.alive) return;

      // Store input state on player (will be processed in physics update)
      (player as any).input = message;
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
   * Check if all human players are ready
   */
  private areAllHumansReady(): boolean {
    let humanCount = 0;
    let readyCount = 0;

    this.state.players.forEach((player) => {
      if (!player.isBot) {
        humanCount++;
        if (player.ready) {
          readyCount++;
        }
      }
    });

    // Need at least 1 human and all humans must be ready
    return humanCount > 0 && humanCount === readyCount;
  }

  /**
   * Check if bots have already been filled
   */
  private areBotsAlreadyFilled(): boolean {
    let botCount = 0;
    this.state.players.forEach((player) => {
      if (player.isBot) {
        botCount++;
      }
    });
    return botCount > 0;
  }

  /**
   * Check if ready to fill bots and fill if conditions are met
   */
  private checkAndFillBots(): void {
    // Only fill bots in LOBBY phase
    if (this.state.phase !== GamePhase.LOBBY) {
      return;
    }

    // Only fill bots once
    if (this.areBotsAlreadyFilled()) {
      return;
    }

    // Check if all humans are ready
    if (this.areAllHumansReady()) {
      this.fillBots();
    }
  }

  /**
   * Fill remaining slots with bots to reach 5v5
   */
  private fillBots(): void {
    console.log('🤖 All humans ready! Filling bots to 5v5...');

    const redHumans = this.getTeamCount(Team.RED, false);
    const blueHumans = this.getTeamCount(Team.BLUE, false);

    console.log(`   Current: Red ${redHumans} humans, Blue ${blueHumans} humans`);

    // Calculate bots needed for each team
    const redBotsNeeded = CONFIG.MAX_PLAYERS_PER_TEAM - redHumans;
    const blueBotsNeeded = CONFIG.MAX_PLAYERS_PER_TEAM - blueHumans;

    let botCounter = 1;

    // Add RED bots
    for (let i = 0; i < redBotsNeeded; i++) {
      const botId = `bot-${Date.now()}-${botCounter}`;
      const botName = `BOT-${botCounter}`;
      const bot = new PlayerState(botId, botName, Team.RED, true);
      bot.ready = true; // Bots are always ready
      this.state.players.set(botId, bot);
      console.log(`🤖 Added ${botName} to RED team`);
      botCounter++;
    }

    // Add BLUE bots
    for (let i = 0; i < blueBotsNeeded; i++) {
      const botId = `bot-${Date.now()}-${botCounter}`;
      const botName = `BOT-${botCounter}`;
      const bot = new PlayerState(botId, botName, Team.BLUE, true);
      bot.ready = true; // Bots are always ready
      this.state.players.set(botId, bot);
      console.log(`🤖 Added ${botName} to BLUE team`);
      botCounter++;
    }

    const finalRed = this.getTeamCount(Team.RED, true);
    const finalBlue = this.getTeamCount(Team.BLUE, true);

    console.log(`✅ Bots filled! Final teams: Red ${finalRed}, Blue ${finalBlue}`);
    console.log(`📊 Total players: ${this.state.players.size}/10`);

    // Start countdown after bots are filled
    this.startCountdown();
  }

  /**
   * Start countdown timer (5 seconds)
   */
  private startCountdown(): void {
    // Prevent countdown if not in LOBBY phase
    if (this.state.phase !== GamePhase.LOBBY) {
      console.log(`⚠️  Cannot start countdown from phase ${this.state.phase}`);
      return;
    }

    // Transition to COUNTDOWN phase
    this.state.phase = GamePhase.COUNTDOWN;
    this.state.countdownStart = Date.now();

    console.log(`⏳ Countdown started! ${CONFIG.COUNTDOWN_DURATION / 1000} seconds until match start...`);
    console.log(`📍 Room phase: ${this.state.phase}`);

    // Update metadata
    this.setMetadata({
      ...this.metadata,
      phase: this.state.phase,
    });

    // Set timer for countdown completion
    this.countdownTimer = setTimeout(() => {
      this.onCountdownComplete();
    }, CONFIG.COUNTDOWN_DURATION);
  }

  /**
   * Calculate spawn positions for a team
   * Teams spawn on opposite sides of the island, facing toward center
   */
  private calculateSpawnPositions(team: Team): Array<{ posX: number; posY: number; posZ: number; rotY: number }> {
    const positions: Array<{ posX: number; posY: number; posZ: number; rotY: number }> = [];

    // RED team spawns on the left (-X), BLUE team spawns on the right (+X)
    const xDirection = team === Team.RED ? -1 : 1;
    const spawnX = xDirection * CONFIG.SPAWN_DISTANCE_FROM_CENTER;
    const spawnY = CONFIG.SPAWN_ALTITUDE;

    // Rotation: RED faces right (+X direction, 0 rad), BLUE faces left (-X direction, π rad)
    const rotY = team === Team.RED ? 0 : Math.PI;

    // Arrange planes in a V-formation (spread in Z axis)
    // Center plane at Z=0, others spread with SPAWN_SPACING
    const teamSize = CONFIG.MAX_PLAYERS_PER_TEAM;
    const centerIndex = Math.floor(teamSize / 2);

    for (let i = 0; i < teamSize; i++) {
      const offsetZ = (i - centerIndex) * CONFIG.SPAWN_SPACING;
      positions.push({
        posX: spawnX,
        posY: spawnY,
        posZ: offsetZ,
        rotY: rotY,
      });
    }

    return positions;
  }

  /**
   * Assign spawn positions to all players
   */
  private assignSpawnPositions(): void {
    console.log('✈️  Assigning spawn positions...');

    // Get spawn positions for each team
    const redSpawns = this.calculateSpawnPositions(Team.RED);
    const blueSpawns = this.calculateSpawnPositions(Team.BLUE);

    let redIndex = 0;
    let blueIndex = 0;

    // Assign positions to players
    this.state.players.forEach((player) => {
      let spawn;
      if (player.team === Team.RED) {
        spawn = redSpawns[redIndex % redSpawns.length];
        redIndex++;
      } else {
        spawn = blueSpawns[blueIndex % blueSpawns.length];
        blueIndex++;
      }

      // Assign position and rotation
      player.posX = spawn.posX;
      player.posY = spawn.posY;
      player.posZ = spawn.posZ;
      player.rotY = spawn.rotY;

      // Set initial velocity (forward at spawn speed)
      const forward = player.team === Team.RED ? 1 : -1; // RED flies toward +X, BLUE toward -X
      player.velocityX = forward * CONFIG.SPAWN_INITIAL_SPEED;
      player.velocityY = 0;
      player.velocityZ = 0;

      // Set alive
      player.alive = true;

      // Apply spawn protection
      player.invulnerable = true;
      player.spawnProtectionEnd = Date.now() + CONFIG.SPAWN_PROTECTION_DURATION;

      console.log(`✈️  ${player.name} (${player.team}): pos=(${player.posX}, ${player.posY}, ${player.posZ}), vel=(${player.velocityX}, ${player.velocityY}, ${player.velocityZ}), invulnerable=${player.invulnerable}`);
    });

    // Schedule spawn protection removal for all players
    this.scheduleSpawnProtectionRemoval();
  }

  /**
   * Schedule removal of spawn protection for all players
   */
  private scheduleSpawnProtectionRemoval(): void {
    setTimeout(() => {
      this.removeSpawnProtection();
    }, CONFIG.SPAWN_PROTECTION_DURATION);
  }

  /**
   * Remove spawn protection from all players
   */
  private removeSpawnProtection(): void {
    const now = Date.now();
    let count = 0;

    this.state.players.forEach((player) => {
      if (player.invulnerable && player.spawnProtectionEnd <= now) {
        player.invulnerable = false;
        count++;
      }
    });

    if (count > 0) {
      console.log(`🛡️  Spawn protection removed for ${count} players`);
    }
  }

  /**
   * Called when countdown timer completes
   */
  private onCountdownComplete(): void {
    console.log(`⏰ Countdown complete! Transitioning to match...`);

    // Transition to IN_MATCH phase
    this.state.phase = GamePhase.IN_MATCH;
    this.state.matchStart = Date.now();

    console.log(`🎮 Match started!`);
    console.log(`📍 Room phase: ${this.state.phase}`);

    // Update metadata
    this.setMetadata({
      ...this.metadata,
      phase: this.state.phase,
    });

    // Clear countdown timer
    this.countdownTimer = undefined;

    // Assign spawn positions to all players
    this.assignSpawnPositions();
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

    // Make player visible in lobby
    player.alive = true;
    player.ready = false;

    // Random lobby position (parking)
    // Random angle at 50m radius
    const angle = Math.random() * Math.PI * 2;
    const radius = 50 + Math.random() * 50;
    player.posX = Math.cos(angle) * radius;
    player.posZ = Math.sin(angle) * radius;
    player.posY = 10; // On ground
    player.rotY = Math.atan2(-player.posX, -player.posZ); // Face center

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

    const player = this.state.players.get(client.sessionId);

    // If leaving during countdown or match, convert to bot
    if (player && (this.state.phase === GamePhase.COUNTDOWN || this.state.phase === GamePhase.IN_MATCH)) {
      console.log(`🔄 Converting ${player.name} to bot (disconnect during ${this.state.phase})`);
      this.convertPlayerToBot(client.sessionId);
    } else {
      // Otherwise, just remove from state
      this.state.players.delete(client.sessionId);
    }

    console.log(`📊 Player count: ${this.state.players.size}/${this.maxClients}`);

    // Update metadata
    this.setMetadata({
      ...this.metadata,
      currentPlayers: this.state.players.size,
    });
  }

  /**
   * Convert a human player to a bot (used when player disconnects during countdown/match)
   */
  private convertPlayerToBot(sessionId: string): void {
    const player = this.state.players.get(sessionId);
    if (!player) return;

    const oldName = player.name;
    const team = player.team;

    // Generate bot name
    const botName = `BOT-${oldName}`;

    // Update player properties to be a bot
    player.isBot = true;
    player.name = botName;
    player.ready = true; // Bots are always ready

    console.log(`🤖 ${oldName} → ${botName} (team ${team})`);
  }

  /**
   * Update physics for all players
   */
  private updatePhysics(deltaTime: number): void {
    // Only update during match
    if (this.state.phase !== GamePhase.IN_MATCH) return;

    // Physics constants (m/s and m/s²)
    const PITCH_SPEED = 1.5;        // Radians per second (pitch up/down)
    const YAW_SPEED = 1.0;          // Radians per second (turn left/right)
    const FORWARD_ACCELERATION = 20; // m/s² (throttle)
    const AIR_RESISTANCE = 0.5;     // Drag coefficient
    const MIN_SPEED = 30;           // Minimum speed (m/s)
    const MAX_SPEED = 100;          // Maximum speed (m/s)
    const GRAVITY = -9.8;           // m/s² (downward)
    const LIFT_COEFFICIENT = 0.18;  // Lift generated per m/s of forward speed (balanced at ~54 m/s)

    this.state.players.forEach((player, sessionId) => {
      // Skip dead players
      if (!player.alive) return;

      // Get player input (if exists)
      const input = (player as any).input || { up: false, down: false, left: false, right: false, shoot: false };

      // Shooting
      if (input.shoot && !player.isBot) { // Only humans can shoot for now
        // Check cooldown (250ms = 4 shots/second)
        const now = Date.now();
        const lastShot = (player as any).lastShootTime || 0;
        if (now - lastShot >= 250) {
          this.spawnProjectile(player, sessionId);
          (player as any).lastShootTime = now;
        }
      }

      // Pitch control (up/down)
      // Negative rotX = nose up, positive rotX = nose down (standard 3D)
      if (input.up) {
        player.rotX -= PITCH_SPEED * deltaTime;  // Nose up
      }
      if (input.down) {
        player.rotX += PITCH_SPEED * deltaTime;  // Nose down
      }

      // Yaw control (left/right)
      // Standard 3D: Left = negative rotation, Right = positive rotation
      if (input.left) {
        player.rotY -= YAW_SPEED * deltaTime;  // Turn left
      }
      if (input.right) {
        player.rotY += YAW_SPEED * deltaTime;  // Turn right
      }

      // Clamp pitch to prevent loop-de-loops
      player.rotX = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, player.rotX));

      // Forward thrust (Z-Forward coordinate system)
      // Standard 3D Game Math: Yaw 0 = +Z forward
      const forward = {
        x: Math.sin(player.rotY) * Math.cos(player.rotX),  // X = Sin(Yaw) * Cos(Pitch)
        y: Math.sin(player.rotX),                          // Y = Sin(Pitch)
        z: Math.cos(player.rotY) * Math.cos(player.rotX)   // Z = Cos(Yaw) * Cos(Pitch)
      };

      // Apply forward acceleration
      player.velocityX += forward.x * FORWARD_ACCELERATION * deltaTime;
      player.velocityY += forward.y * FORWARD_ACCELERATION * deltaTime;
      player.velocityZ += forward.z * FORWARD_ACCELERATION * deltaTime;

      // Apply gravity
      player.velocityY += GRAVITY * deltaTime;

      // Apply lift (upward force proportional to forward speed)
      // Calculate horizontal speed (speed in XZ plane)
      const horizontalSpeed = Math.sqrt(player.velocityX ** 2 + player.velocityZ ** 2);
      // Lift counters gravity, stronger at higher speeds
      const lift = horizontalSpeed * LIFT_COEFFICIENT;
      player.velocityY += lift * deltaTime;

      // Apply air resistance
      const speed = Math.sqrt(
        player.velocityX ** 2 +
        player.velocityY ** 2 +
        player.velocityZ ** 2
      );

      if (speed > 0) {
        const drag = AIR_RESISTANCE * deltaTime;
        player.velocityX *= (1 - drag);
        player.velocityY *= (1 - drag);
        player.velocityZ *= (1 - drag);
      }

      // Enforce speed limits
      const currentSpeed = Math.sqrt(
        player.velocityX ** 2 +
        player.velocityY ** 2 +
        player.velocityZ ** 2
      );

      if (currentSpeed > MAX_SPEED) {
        const scale = MAX_SPEED / currentSpeed;
        player.velocityX *= scale;
        player.velocityY *= scale;
        player.velocityZ *= scale;
      } else if (currentSpeed < MIN_SPEED && currentSpeed > 0) {
        const scale = MIN_SPEED / currentSpeed;
        player.velocityX *= scale;
        player.velocityY *= scale;
        player.velocityZ *= scale;
      }

      // Update position based on velocity
      player.posX += player.velocityX * deltaTime;
      player.posY += player.velocityY * deltaTime;
      player.posZ += player.velocityZ * deltaTime;

      // Ground collision (simple altitude check)
      if (player.posY < 10) {
        player.posY = 10;
        player.velocityY = Math.max(0, player.velocityY); // Stop downward velocity
      }

      // Arena boundaries (2000m x 2000m, wraps around)
      const arenaRadius = CONFIG.ARENA_SIZE / 2;
      if (Math.abs(player.posX) > arenaRadius || Math.abs(player.posZ) > arenaRadius) {
        // Wrap to other side
        if (player.posX > arenaRadius) player.posX = -arenaRadius;
        if (player.posX < -arenaRadius) player.posX = arenaRadius;
        if (player.posZ > arenaRadius) player.posZ = -arenaRadius;
        if (player.posZ < -arenaRadius) player.posZ = arenaRadius;
      }
    });

    // Update projectiles
    const PROJECTILE_SPEED = 200; // m/s (fast bullets)
    const projectilesToRemove: string[] = [];

    this.state.projectiles.forEach((projectile, id) => {
      // Check lifetime
      const age = Date.now() - projectile.createdAt;
      if (age > projectile.maxLifetime) {
        projectilesToRemove.push(id);
        return;
      }

      // Update position
      projectile.posX += projectile.velocityX * deltaTime;
      projectile.posY += projectile.velocityY * deltaTime;
      projectile.posZ += projectile.velocityZ * deltaTime;

      // Check hit with players
      this.state.players.forEach((player, targetId) => {
        // Skip if:
        // - Player is dead
        // - Player is the shooter
        // - Player is on same team
        // - Player is invulnerable
        if (!player.alive) return;
        if (targetId === projectile.ownerId) return;
        if (player.team === projectile.ownerTeam) return;
        if (player.invulnerable) return;

        // Simple sphere collision (10m radius)
        const dx = player.posX - projectile.posX;
        const dy = player.posY - projectile.posY;
        const dz = player.posZ - projectile.posZ;
        const distSq = dx * dx + dy * dy + dz * dz;
        const hitRadius = 10; // 10 meters

        if (distSq < hitRadius * hitRadius) {
          // Hit! Kill the player
          player.alive = false;
          projectilesToRemove.push(id);
          console.log(`💥 ${projectile.ownerId} hit ${targetId}!`);

          // Update alive counts
          this.updateAliveCounts();
        }
      });
    });

    // Remove dead projectiles
    projectilesToRemove.forEach(id => {
      this.state.projectiles.delete(id);
    });
  }

  /**
   * Spawn a projectile from a player
   */
  private spawnProjectile(player: PlayerState, sessionId: string): void {
    const projectile = new ProjectileState();
    projectile.id = `proj_${this.projectileIdCounter++}`;
    projectile.ownerId = sessionId;
    projectile.ownerTeam = player.team;

    // Spawn slightly in front of plane (from the nose, not tail)
    const SPAWN_OFFSET = 15; // 15 meters in front of nose
    // Must match physics forward vector (Z-Forward coordinate system)
    const forward = {
      x: Math.sin(player.rotY) * Math.cos(player.rotX),  // X = Sin(Yaw) * Cos(Pitch)
      y: Math.sin(player.rotX),                          // Y = Sin(Pitch)
      z: Math.cos(player.rotY) * Math.cos(player.rotX)   // Z = Cos(Yaw) * Cos(Pitch)
    };

    projectile.posX = player.posX + forward.x * SPAWN_OFFSET;
    projectile.posY = player.posY + forward.y * SPAWN_OFFSET;
    projectile.posZ = player.posZ + forward.z * SPAWN_OFFSET;

    // Projectile velocity = plane velocity + bullet speed in forward direction
    const PROJECTILE_SPEED = 200; // m/s
    projectile.velocityX = player.velocityX + forward.x * PROJECTILE_SPEED;
    projectile.velocityY = player.velocityY + forward.y * PROJECTILE_SPEED;
    projectile.velocityZ = player.velocityZ + forward.z * PROJECTILE_SPEED;

    projectile.createdAt = Date.now();
    projectile.maxLifetime = 3000; // 3 seconds

    this.state.projectiles.set(projectile.id, projectile);
  }

  /**
   * Update alive counts for both teams
   */
  private updateAliveCounts(): void {
    let redAlive = 0;
    let blueAlive = 0;

    this.state.players.forEach((player) => {
      if (player.alive) {
        if (player.team === Team.RED) {
          redAlive++;
        } else {
          blueAlive++;
        }
      }
    });

    this.state.aliveRed = redAlive;
    this.state.aliveBlue = blueAlive;

    // Check for match end (one team eliminated)
    if (redAlive === 0 || blueAlive === 0) {
      this.endMatch();
    }
  }

  /**
   * End the match and transition to results
   */
  private endMatch(): void {
    if (this.state.phase !== GamePhase.IN_MATCH) return;

    console.log('🏁 Match ended!');
    console.log(`   Red alive: ${this.state.aliveRed}`);
    console.log(`   Blue alive: ${this.state.aliveBlue}`);

    this.state.phase = GamePhase.RESULTS;

    // TODO: Auto-return to lobby after delay (not MVP)
  }

  /**
   * Called when room is disposed (no more clients or manually disposed)
   */
  onDispose() {
    console.log('🗑️  DogfightRoom disposed:', this.roomId);
    console.log(`📊 Final player count: ${this.state.players.size}`);
    console.log(`📍 Final phase: ${this.state.phase}`);

    // Clean up countdown timer if exists
    if (this.countdownTimer) {
      clearTimeout(this.countdownTimer);
      this.countdownTimer = undefined;
      console.log('🧹 Countdown timer cleared');
    }
  }
}
