import { Room, Client } from 'colyseus';
import { CONFIG, Team, GamePhase, getTerrainHeight, TERRAIN_CONFIG } from '@air-clash/common';
import { RoomState } from '../schemas/RoomState';
import { PlayerState } from '../schemas/PlayerState';
import { ProjectileState } from '../schemas/ProjectileState';

/**
 * Bot AI state (server-side only, not synchronized)
 */
enum BotAIState {
  ATTACK = 'ATTACK',
  EVASIVE = 'EVASIVE',
}

interface BotPersonality {
  aggression: number;      // 0.5-1.5 (fire range multiplier)
  accuracy: number;        // 0.0-0.3 (aim error in radians)
  reflexSpeed: number;     // 0.5-1.5 (turn rate multiplier)
  patience: number;        // 5000-12000 (ms before break-away)
}

interface BotAIData {
  state: BotAIState;
  patrolTargetX: number;
  patrolTargetZ: number;
  currentTarget: string | null;  // Enemy session ID
  lastHitTime: number;           // Timestamp of last successful hit
  lastStateChange: number;       // Timestamp of last state change
  evasiveEndTime: number;        // When to exit EVASIVE mode
  personality: BotPersonality;
}

export class DogfightRoom extends Room<RoomState> {
  private countdownTimer?: NodeJS.Timeout;
  private projectileIdCounter: number = 0;
  private botAIData: Map<string, BotAIData> = new Map();  // sessionId -> AI data

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

    // Player input (flight controls) - supports both analog and boolean inputs
    this.onMessage('playerInput', (client, message: {
      up: boolean;
      down: boolean;
      left: boolean;
      right: boolean;
      shoot: boolean;
      pitch?: number;  // Optional analog input -1 to +1
      roll?: number;   // Optional analog input -1 to +1
    }) => {
      // Debug: Log first input received per client
      if (!(client as any)._hasLoggedInput) {
        console.log(`🎮 First playerInput received from ${client.sessionId}`,
          message.pitch !== undefined ? '(analog)' : '(boolean)');
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
      this.initializeBotAI(botId); // Initialize bot AI
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
      this.initializeBotAI(botId); // Initialize bot AI
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

    // Rotation: RED faces right (+X direction), BLUE faces left (-X direction)
    // Inverted physics: forward = -Z, so add 180° to face toward center
    // RED: 90° + 180° = 270° (faces +X), BLUE: -90° + 180° = 90° (faces -X)
    const rotY = team === Team.RED ? 3 * Math.PI / 2 : Math.PI / 2;

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

    // Reset scores and kill counts
    this.state.scoreRed = 0;
    this.state.scoreBlue = 0;
    this.state.players.forEach((player) => {
      player.kills = 0;
    });

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
    player.posY = 100; // On ground (10x scale for realistic altitude)
    player.rotY = Math.atan2(-player.posX, -player.posZ) + Math.PI; // Face center (add 180° for inverted physics)

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

    // Initialize bot AI
    this.initializeBotAI(sessionId);

    console.log(`🤖 ${oldName} → ${botName} (team ${team})`);
  }

  /**
   * Generate bot AI input based on game state (SIMPLIFIED AI WITH FIXED PITCH)
   */
  private generateBotInput(bot: PlayerState, botSessionId: string): { up: boolean; down: boolean; left: boolean; right: boolean; shoot: boolean } {
    const input = { up: false, down: false, left: false, right: false, shoot: false };

    // Get or initialize bot AI data
    let aiData = this.botAIData.get(botSessionId);
    if (!aiData) {
      this.initializeBotAI(botSessionId);
      aiData = this.botAIData.get(botSessionId)!;
    }

    const now = Date.now();
    const personality = aiData.personality;

    // Physics constants
    const PROJECTILE_SPEED = 200;         // m/s (bullet speed for lead targeting)
    const BOUNDARY_DISTANCE = 1200;       // Start turning inward at 1200m
    const FIRE_ANGLE = Math.PI / 6;       // ~30° cone in front

    // ====================
    // PRIORITY 1: OBSTACLE AVOIDANCE (HIGHEST PRIORITY)
    // ====================

    // Ground avoidance (INVERTED TEST)
    // If low, Push DOWN to climb (Counter-intuitive test)
    if (bot.posY < 200) {
      input.down = true; // Was input.up
    }

    // Ceiling avoidance
    // If high, Pull UP to descend
    if (bot.posY > 900) {
      input.up = true; // Was input.down
    }

    // Map edge avoidance
    const distanceFromCenter = Math.sqrt(bot.posX ** 2 + bot.posZ ** 2);
    if (distanceFromCenter > BOUNDARY_DISTANCE) {
      // Turn toward center (add 180° to match inverted physics forward vector)
      const angleToCenter = Math.atan2(0 - bot.posX, 0 - bot.posZ) + Math.PI;
      const angleDiff = this.normalizeAngle(angleToCenter - bot.rotY);

      const turnThreshold = 0.1 / personality.reflexSpeed;
      if (angleDiff > turnThreshold) {
        input.right = true;
      } else if (angleDiff < -turnThreshold) {
        input.left = true;
      }

      return input;
    }

    // ====================
    // EVASIVE MODE (Break-Away Logic)
    // ====================
    if (aiData.state === BotAIState.EVASIVE) {
      // Check if evasive period ended
      if (now > aiData.evasiveEndTime) {
        // Exit EVASIVE, return to ATTACK (always ready to fight)
        aiData.state = BotAIState.ATTACK;
        aiData.currentTarget = null;
        aiData.lastStateChange = now;
        aiData.lastHitTime = now; // Reset timer
      } else {
        // EVASIVE behavior: Pitch down hard + random roll
        input.down = true;
        input.left = Math.random() > 0.5;
        input.right = !input.left;

        // Override with ground avoidance
        if (bot.posY < 100) {
          input.up = true;
          input.down = false;
        }

        return input;
      }
    }

    // ====================
    // PRIORITY 2: FIND ENEMY (WITH STICKY TARGETING)
    // ====================
    let nearestEnemy: PlayerState | null = null;
    let nearestEnemyId: string | null = null;
    let nearestDistance = Infinity;

    // STICKY TARGETING: Check if we should stick to current target
    const CHASE_STICKINESS = 10000; // 10 seconds minimum lock-on
    const chaseDuration = now - aiData.lastStateChange;
    const shouldStickToTarget = aiData.currentTarget && chaseDuration < CHASE_STICKINESS;

    if (shouldStickToTarget) {
      // Try to stick to current target if still valid
      const currentTarget = this.state.players.get(aiData.currentTarget!);
      if (currentTarget && currentTarget.alive && currentTarget.team !== bot.team) {
        // Current target is still valid - stick to it!
        nearestEnemy = currentTarget;
        nearestEnemyId = aiData.currentTarget;

        const dx = currentTarget.posX - bot.posX;
        const dy = currentTarget.posY - bot.posY;
        const dz = currentTarget.posZ - bot.posZ;
        nearestDistance = Math.sqrt(dx ** 2 + dy ** 2 + dz ** 2);
      } else {
        // Current target died or invalid - allow retargeting
        aiData.currentTarget = null;
      }
    }

    // If not sticking to target (or target died), find nearest enemy
    if (!nearestEnemy) {
      this.state.players.forEach((enemy, enemySessionId) => {
        // Skip self, teammates, and dead players
        if (enemySessionId === botSessionId || enemy.team === bot.team || !enemy.alive) {
          return;
        }

        const dx = enemy.posX - bot.posX;
        const dy = enemy.posY - bot.posY;
        const dz = enemy.posZ - bot.posZ;
        const distance = Math.sqrt(dx ** 2 + dy ** 2 + dz ** 2);

        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestEnemy = enemy;
          nearestEnemyId = enemySessionId;
        }
      });
    }

    // ====================
    // STATE TRANSITIONS
    // ====================
    if (nearestEnemy) {
      // Found enemy - enter/stay in ATTACK
      if (aiData.state !== BotAIState.ATTACK || aiData.currentTarget !== nearestEnemyId) {
        aiData.state = BotAIState.ATTACK;
        aiData.currentTarget = nearestEnemyId;
        aiData.lastStateChange = now; // Reset timer when acquiring new target
        aiData.lastHitTime = now;
      }

      // Check break-away timer (patience timeout)
      if (aiData.state === BotAIState.ATTACK) {
        const timeSinceLastHit = now - aiData.lastHitTime;
        if (timeSinceLastHit > personality.patience) {
          // Enter EVASIVE mode
          aiData.state = BotAIState.EVASIVE;
          aiData.evasiveEndTime = now + 3000; // 3 seconds of evasive
          aiData.lastStateChange = now;
          return this.generateBotInput(bot, botSessionId); // Recurse to execute EVASIVE immediately
        }
      }
    }

    // ====================
    // ATTACK MODE (Lead Targeting)
    // ====================
    if (aiData.state === BotAIState.ATTACK && nearestEnemy) {
      // Store enemy reference for type safety
      const enemy: PlayerState = nearestEnemy;

      // LEAD TARGETING: Predict where enemy will be
      const distance = nearestDistance;

      // Clamp time to impact to prevent aiming at "ghosts" miles away
      // Max prediction: 1.5 seconds ahead
      const timeToImpact = Math.min(distance / PROJECTILE_SPEED, 1.5);

      // Predicted enemy position
      const predictedX = enemy.posX + (enemy.velocityX * timeToImpact);
      let predictedY = enemy.posY + (enemy.velocityY * timeToImpact);
      const predictedZ = enemy.posZ + (enemy.velocityZ * timeToImpact);

      // Clamp vertical aim to keep fight lower (200-800m)
      // Don't chase targets into the stratosphere or ground
      if (predictedY < 200) predictedY = 200;
      if (predictedY > 800) predictedY = 800;

      // Calculate direction to PREDICTED position
      const dx = predictedX - bot.posX;
      const dy = predictedY - bot.posY;
      const dz = predictedZ - bot.posZ;

      // Calculate desired yaw (add 180° for inverted physics forward vector)
      const desiredYaw = Math.atan2(dx, dz) + Math.PI;

      // Add personality-based aim error
      const aimError = (Math.random() - 0.5) * personality.accuracy;
      const targetYaw = desiredYaw + aimError;

      // Yaw control (turn toward predicted position)
      const yawDiff = this.normalizeAngle(targetYaw - bot.rotY);
      const turnThreshold = 0.05 / personality.reflexSpeed;

      if (yawDiff > turnThreshold) {
        input.right = true;
      } else if (yawDiff < -turnThreshold) {
        input.left = true;
      }

      // Calculate desired pitch
      const horizontalDistance = Math.sqrt(dx ** 2 + dz ** 2);
      const desiredPitch = Math.atan2(-dy, horizontalDistance); // Negative dy because up is negative rotX

      // CRITICAL FIX: Pitch control with CORRECTED logic
      // In inverted physics: Up is negative rotX, Down is positive rotX
      // If pitchDiff > 0: target is MORE positive (down) → press DOWN
      // If pitchDiff < 0: target is MORE negative (up) → press UP
      const pitchDiff = this.normalizeAngle(desiredPitch - bot.rotX);

      if (pitchDiff > turnThreshold) {
        input.down = true;  // Target is below current → pitch down
      } else if (pitchDiff < -turnThreshold) {
        input.up = true;    // Target is above current → pitch up
      }

      // Shooting logic (personality-based fire range)
      const fireRange = 300 * personality.aggression; // 150-450m depending on aggression
      const isInRange = distance < fireRange;
      const isInFront = Math.abs(yawDiff) < FIRE_ANGLE && Math.abs(pitchDiff) < FIRE_ANGLE;

      if (isInRange && isInFront) {
        input.shoot = true;
      }

      return input;
    }

    // ====================
    // NO ENEMY FOUND: ORGANIC WANDER
    // ====================
    // Gentle random input
    if (Math.random() < 0.02) input.left = true;
    if (Math.random() < 0.02) input.right = true;
    if (Math.random() < 0.01) input.up = true;
    if (Math.random() < 0.01) input.down = true;
    // Hard clamp for absolute ceiling/floor (INVERTED)
    if (bot.posY < 200) input.down = true; // Danger Low -> Push Down
    if (bot.posY > 900) input.up = true;   // Danger High -> Pull Up

    return input;
  }

  /**
   * Normalize angle to range [-π, π]
   */
  private normalizeAngle(angle: number): number {
    while (angle > Math.PI) angle -= 2 * Math.PI;
    while (angle < -Math.PI) angle += 2 * Math.PI;
    return angle;
  }

  /**
   * Generate random bot personality
   */
  private generateBotPersonality(): BotPersonality {
    return {
      aggression: 0.5 + Math.random(),        // 0.5-1.5
      accuracy: Math.random() * 0.3,          // 0.0-0.3
      reflexSpeed: 0.5 + Math.random(),       // 0.5-1.5
      patience: 5000 + Math.random() * 7000,  // 5000-12000ms
    };
  }

  /**
   * Generate random patrol point within arena
   */
  private generatePatrolPoint(): { x: number; z: number } {
    const angle = Math.random() * Math.PI * 2;
    const radius = 200 + Math.random() * 600; // 200-800m from center
    return {
      x: Math.cos(angle) * radius,
      z: Math.sin(angle) * radius,
    };
  }

  /**
   * Initialize bot AI data
   */
  private initializeBotAI(sessionId: string): void {
    this.botAIData.set(sessionId, {
      state: BotAIState.ATTACK,
      patrolTargetX: 0,  // Not used anymore
      patrolTargetZ: 0,  // Not used anymore
      currentTarget: null,
      lastHitTime: Date.now(),
      lastStateChange: Date.now(),
      evasiveEndTime: 0,
      personality: this.generateBotPersonality(),
    });
  }

  /**
   * Update physics for all players
   */
  private updatePhysics(deltaTime: number): void {
    // Only update during match
    if (this.state.phase !== GamePhase.IN_MATCH) return;

    // Physics constants - FORCE BASED MODEL
    const PITCH_SPEED = 1.0;
    const YAW_SPEED = 0.3;
    const ROLL_SPEED = 2.0;
    const MAX_ROLL = Math.PI / 3;
    const RATE_OF_TURN = 1.5;

    // Speed & Force Tuning (30% Boost)
    const FORWARD_ACCELERATION = 20; // Increased from 15
    const MIN_SPEED = 25;            // Stall speed
    const MAX_SPEED = 90;            // Increased from 70
    const GRAVITY = -9.8;

    this.state.players.forEach((player, sessionId) => {
      // Skip dead players
      if (!player.alive) return;

      // ===== CRASH PHYSICS =====
      // If crashing, override normal physics with crash behavior
      if (player.isCrashing) {
        // Crash constants
        const CRASH_GRAVITY = -20;          // Strong downward pull
        const CRASH_SPIN_RATE = Math.PI * 2; // 1 full rotation per second (moderate)
        const CRASH_PITCH_TARGET = -Math.PI / 3; // ~-60° nose down (negative = down)

        // Force pitch down toward target (nose dive)
        const pitchDiff = CRASH_PITCH_TARGET - player.rotX;
        player.rotX += pitchDiff * 2.0 * deltaTime; // Fast pitch down

        // Constant spin around roll axis (death spiral)
        player.rotZ += CRASH_SPIN_RATE * deltaTime;

        // Apply strong gravity
        player.velocityY += CRASH_GRAVITY * deltaTime;

        // Dampen horizontal velocity (air resistance during crash)
        player.velocityX *= Math.pow(0.98, deltaTime * 60); // Exponential decay
        player.velocityZ *= Math.pow(0.98, deltaTime * 60);

        // Update position
        player.posX += player.velocityX * deltaTime;
        player.posY += player.velocityY * deltaTime;
        player.posZ += player.velocityZ * deltaTime;

        // Check for ground impact during crash
        const terrainHeight = getTerrainHeight(player.posX, player.posZ);
        const collisionHeight = Math.max(terrainHeight, TERRAIN_CONFIG.WATER_LEVEL);

        if (player.posY <= collisionHeight) {
          // Final impact - plane explodes
          player.posY = collisionHeight;
          player.alive = false;
          player.isCrashing = false;

          console.log(`💥💥 ${player.name} hit the ground and exploded!`);

          // Update alive counts
          this.updateAliveCounts();
        }

        return; // Skip normal physics for crashing planes
      }

      // Get player input (bots generate AI input, humans use their input)
      let input;
      if (player.isBot) {
        input = this.generateBotInput(player, sessionId);
      } else {
        input = (player as any).input || { up: false, down: false, left: false, right: false, shoot: false };
      }

      // Shooting (both humans and bots can shoot)
      if (input.shoot) {
        // Check ammo first
        if (player.ammo > 0) {
          // Check cooldown (250ms = 4 shots/second)
          const now = Date.now();
          const lastShot = (player as any).lastShootTime || 0;
          if (now - lastShot >= 250) {
            player.ammo -= 1; // Consume ammo
            this.spawnProjectile(player, sessionId);
            (player as any).lastShootTime = now;
          }
        }
      }

      // ===== ANALOG INPUT SUPPORT =====
      // Prefer analog input (pitch/roll) when available, fallback to boolean
      const hasAnalogInput = input.pitch !== undefined && input.roll !== undefined;

      if (hasAnalogInput) {
        // ANALOG MODE: Smooth proportional control
        const pitchInput = input.pitch || 0;  // -1 to +1
        const rollInput = input.roll || 0;    // -1 to +1

        // Pitch control (up/down) - proportional to analog value
        // Negative rotX = nose up, positive rotX = nose down
        player.rotX += pitchInput * PITCH_SPEED * deltaTime;

        // Roll (Banking) - proportional to analog value
        const targetRoll = rollInput * MAX_ROLL;
        const rollDiff = targetRoll - player.rotZ;
        player.rotZ += rollDiff * ROLL_SPEED * deltaTime;
      } else {
        // BOOLEAN MODE: Digital keyboard controls (legacy)
        // Pitch control (up/down)
        if (input.up) {
          player.rotX -= PITCH_SPEED * deltaTime;  // Nose up
        }
        if (input.down) {
          player.rotX += PITCH_SPEED * deltaTime;  // Nose down
        }

        // Roll (Banking) - primary control for turning
        let targetRoll = 0;
        if (input.left) {
          targetRoll = -MAX_ROLL;  // Bank left (negative roll)
        } else if (input.right) {
          targetRoll = MAX_ROLL;   // Bank right (positive roll)
        }
        // Smoothly interpolate to target roll (auto-levels when no input)
        const rollDiff = targetRoll - player.rotZ;
        player.rotZ += rollDiff * ROLL_SPEED * deltaTime;
      }

      // Induced Yaw from Banking (this is how planes actually turn)
      // Banking right (positive rotZ) -> turn right (positive rotY)
      player.rotY += player.rotZ * RATE_OF_TURN * deltaTime;

      // Clamp pitch to prevent loop-de-loops
      player.rotX = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, player.rotX));

      // ===== AERODYNAMICS & FORCES =====
      // 1. Calculate Forward Vector (CORRECTED)
      const forward = {
        x: -Math.sin(player.rotY) * Math.cos(player.rotX),
        y: Math.sin(player.rotX), // Positive = Pitch down goes down
        z: -Math.cos(player.rotY) * Math.cos(player.rotX)
      };

      // 2. Kill Lateral Drift
      const currentSpeed = Math.sqrt(player.velocityX ** 2 + player.velocityY ** 2 + player.velocityZ ** 2);
      player.velocityX = forward.x * currentSpeed;
      player.velocityY = forward.y * currentSpeed;
      player.velocityZ = forward.z * currentSpeed;

      // 3. Apply Forces

      // Thrust (Engine)
      player.velocityX += forward.x * FORWARD_ACCELERATION * deltaTime;
      player.velocityY += forward.y * FORWARD_ACCELERATION * deltaTime;
      player.velocityZ += forward.z * FORWARD_ACCELERATION * deltaTime;

      // Gravity (Always pulls down -9.8)
      player.velocityY += GRAVITY * deltaTime;

      // Drag Logic (Speed Dynamics)
      // Base Drag: Increases with Speed
      let dragFactor = 0.3;

      // Induced Drag: Turning (Banking) causes more drag
      // 60 degrees bank = +50% drag. Bleeds speed in turns.
      dragFactor += Math.abs(player.rotZ) * 0.5;

      if (currentSpeed > 0) {
        const drag = currentSpeed * dragFactor * deltaTime;
        player.velocityX -= player.velocityX * (drag / currentSpeed);
        player.velocityY -= player.velocityY * (drag / currentSpeed);
        player.velocityZ -= player.velocityZ * (drag / currentSpeed);
      }

      // Smart Lift (Counter-Gravity)
      // Only works if wings are level AND pitch is flat
      // Diving (rotX=90) -> No Lift. Banking (rotZ=90) -> No Lift.
      const liftPower = currentSpeed * 0.20;
      const pitchFactor = Math.cos(player.rotX); // 0 at 90 degrees
      const bankFactor = Math.cos(player.rotZ);  // 0 at 90 degrees

      // Lift always acts in the "Up" direction relative to the horizon
      // (Simplified: Just adds +Y velocity to counter gravity)
      const effectiveLift = liftPower * Math.abs(pitchFactor) * Math.abs(bankFactor);
      player.velocityY += effectiveLift * deltaTime;

      // 4. Speed Clamps
      const realSpeed = Math.sqrt(player.velocityX ** 2 + player.velocityY ** 2 + player.velocityZ ** 2);

      // Allow overspeed in dives (gravity), but drag brings it back
      const ABSOLUTE_MAX = 120; // Dive limit

      if (realSpeed > ABSOLUTE_MAX) {
        const scale = ABSOLUTE_MAX / realSpeed;
        player.velocityX *= scale;
        player.velocityY *= scale;
        player.velocityZ *= scale;
      } else if (realSpeed < MIN_SPEED && realSpeed > 0) {
        const scale = MIN_SPEED / realSpeed;
        player.velocityX *= scale;
        player.velocityY *= scale;
        player.velocityZ *= scale;
      }

      // Update position based on velocity
      player.posX += player.velocityX * deltaTime;
      player.posY += player.velocityY * deltaTime;
      player.posZ += player.velocityZ * deltaTime;

      // Terrain collision (Crash Logic)
      // Check if plane hits terrain or water
      const terrainHeight = getTerrainHeight(player.posX, player.posZ);
      const collisionHeight = Math.max(terrainHeight, TERRAIN_CONFIG.WATER_LEVEL);

      if (player.posY <= collisionHeight) {
        player.posY = collisionHeight; // Set to collision surface

        // Determine crash type for better feedback
        if (terrainHeight > TERRAIN_CONFIG.WATER_LEVEL) {
          console.log(`💥 ${player.name} crashed into the mountain!`);
        } else {
          console.log(`💥 ${player.name} crashed into the water!`);
        }

        // If already crashing, this is the final impact - set alive=false
        // If not crashing yet, trigger crash sequence
        if (player.isCrashing) {
          player.alive = false;
          player.isCrashing = false;
        } else {
          player.isCrashing = true;
          player.invulnerable = true; // Invulnerable during crash
        }

        // Update alive counts for team tracking
        this.updateAliveCounts();
        return; // Stop processing physics for this player
      }

      // Soft Boundaries - Force turn back toward center instead of wrapping
      const distanceFromCenter = Math.sqrt(player.posX ** 2 + player.posZ ** 2);
      const SOFT_BOUNDARY = 1200;  // Start forcing turn back
      const HARD_BOUNDARY = 1500;  // Maximum distance (physical clamp)

      if (distanceFromCenter > SOFT_BOUNDARY) {
        // Calculate angle toward center (add 180° to match inverted physics forward vector)
        const angleToCenter = Math.atan2(-player.posX, -player.posZ) + Math.PI;

        // Calculate how far beyond boundary (0 = at soft boundary, 1 = at hard boundary)
        const boundaryPressure = Math.min(1, (distanceFromCenter - SOFT_BOUNDARY) / (HARD_BOUNDARY - SOFT_BOUNDARY));

        // Smoothly rotate toward center (stronger as they get closer to hard boundary)
        const turnRate = YAW_SPEED * 2.0 * boundaryPressure * deltaTime; // Up to 2x normal turn speed
        const currentAngle = player.rotY;
        const angleDiff = this.normalizeAngle(angleToCenter - currentAngle);

        // Apply forced turn toward center
        player.rotY += Math.sign(angleDiff) * Math.min(Math.abs(angleDiff), turnRate);

        // Hard clamp at maximum distance (prevent going beyond hard boundary)
        if (distanceFromCenter > HARD_BOUNDARY) {
          const clampFactor = HARD_BOUNDARY / distanceFromCenter;
          player.posX *= clampFactor;
          player.posZ *= clampFactor;
        }
      }

      // Soft Ceiling - Force nose down when flying too high
      const SOFT_CEILING = 1300;  // Start forcing descent
      const HARD_CEILING = 1500;  // Maximum altitude (physical clamp)

      if (player.posY > SOFT_CEILING) {
        // Calculate how far above ceiling (0 = at soft ceiling, 1 = at hard ceiling)
        const ceilingPressure = Math.min(1, (player.posY - SOFT_CEILING) / (HARD_CEILING - SOFT_CEILING));

        // Force pitch down (rotX negative = nose down)
        const targetPitch = -Math.PI / 6; // Target -30° nose down
        const pitchRate = PITCH_SPEED * 2.0 * ceilingPressure * deltaTime; // Up to 2x normal pitch speed
        const pitchDiff = targetPitch - player.rotX;

        // Apply forced pitch down toward target
        player.rotX += Math.sign(pitchDiff) * Math.min(Math.abs(pitchDiff), pitchRate);

        // Hard clamp at maximum altitude
        if (player.posY > HARD_CEILING) {
          player.posY = HARD_CEILING;
          player.velocityY = Math.min(0, player.velocityY); // Only allow downward velocity
        }
      }
    });

    // ====================
    // PLANE-TO-PLANE COLLISIONS
    // ====================
    // Convert map to array for pair-wise checks
    const players = Array.from(this.state.players.values());
    const COLLISION_RADIUS = 3; // 3m radius (6m diameter)
    const HIT_DISTANCE_SQ = (COLLISION_RADIUS * 2) ** 2; // (3 + 3)^2 = 36

    for (let i = 0; i < players.length; i++) {
      const p1 = players[i];
      if (!p1.alive || p1.invulnerable) continue;

      for (let j = i + 1; j < players.length; j++) {
        const p2 = players[j];
        if (!p2.alive || p2.invulnerable) continue;

        const dx = p1.posX - p2.posX;
        const dy = p1.posY - p2.posY;
        const dz = p1.posZ - p2.posZ;
        const distSq = dx * dx + dy * dy + dz * dz;

        if (distSq < HIT_DISTANCE_SQ) {
          // CRASH! Trigger crash sequence for both planes
          p1.isCrashing = true;
          p1.invulnerable = true;
          p2.isCrashing = true;
          p2.invulnerable = true;

          console.log(`💥 MIDAIR CRASH: ${p1.name} collided with ${p2.name}!`);

          // If it was a human involved, log it with more emphasis
          if (!p1.isBot || !p2.isBot) {
            this.broadcast("message", `💥 MIDAIR CRASH: ${p1.name} slammed into ${p2.name}!`);
          }
        }
      }
    }

    this.updateAliveCounts();

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
          // Hit! Trigger crash sequence
          player.isCrashing = true;
          player.invulnerable = true; // Invulnerable during crash
          projectilesToRemove.push(id);

          // Get the killer and award kill
          const killer = this.state.players.get(projectile.ownerId);
          if (killer) {
            killer.kills++;

            // Increment team score
            if (killer.team === 'RED') {
              this.state.scoreRed++;
            } else {
              this.state.scoreBlue++;
            }

            // Reset bot's break-away timer on successful hit
            if (killer.isBot) {
              const killerAI = this.botAIData.get(projectile.ownerId);
              if (killerAI) {
                killerAI.lastHitTime = Date.now();
              }
            }

            console.log(`💥 ${killer.name} hit ${player.name}! (${killer.team} score: ${killer.team === 'RED' ? this.state.scoreRed : this.state.scoreBlue})`);
          }

          // Update alive counts and check for match end
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
    // Must match physics forward vector (negated to point out nose)
    const forward = {
      x: -Math.sin(player.rotY) * Math.cos(player.rotX),  // Negate X
      y: Math.sin(player.rotX),                           // Keep Y (matches physics)
      z: -Math.cos(player.rotY) * Math.cos(player.rotX)   // Negate Z
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

    // Check for match end (one team eliminated OR one team reached 5 kills)
    if (redAlive === 0 || blueAlive === 0 || this.state.scoreRed >= 5 || this.state.scoreBlue >= 5) {
      this.endMatch();
    }
  }

  /**
   * End the match and transition to results
   */
  private endMatch(): void {
    if (this.state.phase !== GamePhase.IN_MATCH) return;

    console.log('🏁 Match ended!');
    console.log(`   Final Score: Red ${this.state.scoreRed} - ${this.state.scoreBlue} Blue`);
    console.log(`   Survivors: Red ${this.state.aliveRed} - ${this.state.aliveBlue} Blue`);

    // Determine winner
    const winner = this.state.scoreRed > this.state.scoreBlue ? 'RED' :
      this.state.scoreBlue > this.state.scoreRed ? 'BLUE' : 'TIE';
    console.log(`   Winner: ${winner}`);

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
