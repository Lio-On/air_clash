import { Engine, Scene, HemisphericLight, DirectionalLight, Vector3, MeshBuilder, FreeCamera, FollowCamera, StandardMaterial, Color3, Color4, Mesh } from '@babylonjs/core';
import { CONFIG, Team, GamePhase } from '@air-clash/common';
import { clientConfig } from './config';
import { UIManager } from './UIManager';
import { Client, Room } from 'colyseus.js';

class Game {
  private engine: Engine;
  private scene: Scene;
  private camera: FollowCamera;
  private ui: UIManager;
  private client: Client;
  private room: Room | null = null;
  private sessionId: string = '';
  private currentTeam: string = 'RED';
  private isReady: boolean = false;
  private countdownInterval: any = null;
  private playerMeshes: Map<string, Mesh> = new Map();
  private projectileMeshes: Map<string, Mesh> = new Map();
  private lastMeshUpdateLog: number = 0;

  // Input state
  private inputState = {
    up: false,      // W or Arrow Up
    down: false,    // S or Arrow Down
    left: false,    // A or Arrow Left
    right: false,   // D or Arrow Right
    shoot: false,   // Space
  };
  private lastShootTime: number = 0;
  private shootCooldown: number = 250; // ms between shots (4 shots/second)

  constructor() {
    // Clear loading screen
    const appDiv = document.getElementById('app')!;
    appDiv.innerHTML = '';

    // Create canvas
    const canvas = document.createElement('canvas');
    canvas.id = 'renderCanvas';
    appDiv.appendChild(canvas);

    // Initialize Babylon.js engine
    this.engine = new Engine(canvas, true, {
      preserveDrawingBuffer: true,
      stencil: true,
    });

    // Create scene
    this.scene = this.createScene();

    // Initialize Colyseus client
    this.client = new Client(clientConfig.serverUrl);

    // Initialize UI
    this.ui = new UIManager();
    this.setupUIHandlers();

    // Show home screen initially
    this.ui.showScreen('home');

    // Show FPS counter if debug enabled
    if (clientConfig.debug.showFPS) {
      this.scene.onBeforeRenderObservable.add(() => {
        const fps = this.engine.getFps().toFixed();
        const fpsLabel = document.getElementById('fps-label');
        if (fpsLabel) {
          fpsLabel.textContent = `FPS: ${fps}`;
        }
      });

      // Create FPS overlay
      const fpsDiv = document.createElement('div');
      fpsDiv.id = 'fps-label';
      fpsDiv.style.cssText = 'position:fixed;top:10px;left:10px;color:#0f0;font-family:monospace;font-size:16px;z-index:1000;';
      document.body.appendChild(fpsDiv);
    }

    // Run render loop
    console.log('🚀 Starting render loop...');
    let frameCount = 0;
    this.engine.runRenderLoop(() => {
      this.sendInput();            // Send keyboard input to server
      this.updatePlayerMeshes();   // Update player mesh positions from server
      this.updateProjectileMeshes(); // Update projectile mesh positions from server
      this.updateCamera();         // Update camera to follow local player
      this.scene.render();         // Render the scene

      // Log every 60 frames (about once per second at 60fps)
      frameCount++;
      if (frameCount === 60) {
        console.log('✅ Render loop confirmed running (60 frames rendered)');
      }
      if (frameCount % 60 === 0 && this.room && this.room.state) {
        console.log(`🎮 Render loop active. Players: ${this.room.state.players.size}, Meshes: ${this.playerMeshes.size}, SessionId: ${this.sessionId || 'none'}`);
      }
    });

    // Handle window resize
    window.addEventListener('resize', () => {
      this.engine.resize();
    });

    // Setup keyboard controls
    this.setupKeyboardControls();

    // Log configuration
    if (clientConfig.debug.verboseLogging) {
      console.log('✅ Air Clash Client initialized');
      console.log(`🌍 Environment: ${clientConfig.environment}`);
      console.log(`🔗 Server URL: ${clientConfig.serverUrl}`);
      console.log(`🎮 Room Name: ${CONFIG.ROOM_NAME}`);
      console.log(`📊 Max Players Per Team: ${CONFIG.MAX_PLAYERS_PER_TEAM}`);
      console.log(`⏱️  Countdown Duration: ${CONFIG.COUNTDOWN_DURATION}ms`);
      console.log(`🛡️  Spawn Protection: ${CONFIG.SPAWN_PROTECTION_DURATION}ms`);
    }
  }

  /**
   * Setup UI event handlers
   */
  private setupUIHandlers(): void {
    // Join button clicked - connect to server
    this.ui.onJoinClick = async () => {
      const pilotName = this.ui.getPilotName();
      if (pilotName.length === 0) {
        alert('Please enter a pilot name');
        return;
      }

      console.log(`Joining with name: ${pilotName}`);

      try {
        // Connect to room
        await this.joinRoom(pilotName);

        // Show lobby screen
        this.ui.showScreen('lobby');
      } catch (error) {
        console.error('Failed to join room:', error);
        alert('Failed to connect to server. Please try again.');
      }
    };

    // Team selection clicked - send to server
    this.ui.onTeamClick = (team: string) => {
      if (!this.room) return;

      this.currentTeam = team;
      console.log(`Team selected: ${team}`);

      // Update button visual state
      const redButton = document.getElementById('team-red-button');
      const blueButton = document.getElementById('team-blue-button');

      if (redButton && blueButton) {
        if (team === 'RED') {
          redButton.classList.add('active');
          blueButton.classList.remove('active');
        } else {
          blueButton.classList.add('active');
          redButton.classList.remove('active');
        }
      }

      // Send team choice to server
      this.room.send('chooseTeam', { team });
    };

    // Ready button clicked - send to server
    this.ui.onReadyClick = () => {
      if (!this.room) return;

      // Toggle ready state (server will echo back the change)
      this.room.send('toggleReady');
      console.log('Toggling ready state');
    };

    // Return to lobby clicked (not implemented in MVP)
    this.ui.onReturnToLobbyClick = () => {
      console.log('Return to lobby not implemented in MVP');
      // In future: disconnect and rejoin
    };
  }

  /**
   * Setup keyboard controls
   */
  private setupKeyboardControls(): void {
    // Key down event
    window.addEventListener('keydown', (event: KeyboardEvent) => {
      switch (event.key.toLowerCase()) {
        case 'w':
        case 'arrowup':
          this.inputState.up = true;
          break;
        case 's':
        case 'arrowdown':
          this.inputState.down = true;
          break;
        case 'a':
        case 'arrowleft':
          this.inputState.left = true;
          break;
        case 'd':
        case 'arrowright':
          this.inputState.right = true;
          break;
        case ' ':
          this.inputState.shoot = true;
          break;
      }
    });

    // Key up event
    window.addEventListener('keyup', (event: KeyboardEvent) => {
      switch (event.key.toLowerCase()) {
        case 'w':
        case 'arrowup':
          this.inputState.up = false;
          break;
        case 's':
        case 'arrowdown':
          this.inputState.down = false;
          break;
        case 'a':
        case 'arrowleft':
          this.inputState.left = false;
          break;
        case 'd':
        case 'arrowright':
          this.inputState.right = false;
          break;
        case ' ':
          this.inputState.shoot = false;
          break;
      }
    });
  }

  /**
   * Send input state to server
   */
  private sendInput(): void {
    if (!this.room) return;

    // Only send input during match
    if (this.room.state.phase !== GamePhase.IN_MATCH) return;

    // Send current input state to server
    this.room.send('playerInput', this.inputState);
  }

  /**
   * Join or create a Colyseus room
   */
  private async joinRoom(pilotName: string): Promise<void> {
    console.log(`Connecting to ${clientConfig.serverUrl}...`);

    try {
      this.room = await this.client.joinOrCreate(CONFIG.ROOM_NAME, { name: pilotName });
      this.sessionId = this.room.sessionId;

      console.log(`✅ Joined room ${this.room.id} as ${this.sessionId}`);

      // Setup state listeners
      this.setupRoomListeners();
    } catch (error) {
      console.error('❌ Failed to join room:', error);
      throw error;
    }
  }

  /**
   * Setup room state listeners
   */
  private setupRoomListeners(): void {
    if (!this.room) return;

    console.log(`🔧 Setting up room listeners. SessionId: ${this.sessionId}`);

    // Listen to state changes
    this.room.onStateChange((state) => {
      console.log(`📡 Room state updated: phase=${state.phase}, players=${state.players.size}`);
      this.handleStateChange(state);
    });

    // Listen to player changes
    this.room.state.players.onAdd = (player, sessionId) => {
      console.log(`Player added: ${player.name} (${sessionId})`);
      this.updateRoster();
    };

    this.room.state.players.onRemove = (player, sessionId) => {
      console.log(`Player removed: ${player.name} (${sessionId})`);
      this.updateRoster();
    };

    this.room.state.players.onChange = (player, sessionId) => {
      this.updateRoster();
    };

    // Listen to error messages
    this.room.onMessage('error', (message) => {
      console.error('Server error:', message.message);
      alert(message.message);
    });

    // Listen to room leave
    this.room.onLeave((code) => {
      console.log(`Left room with code ${code}`);
      this.room = null;
    });
  }

  /**
   * Handle room state changes (phase transitions)
   */
  private handleStateChange(state: any): void {
    const phase = state.phase;

    // Update roster whenever state changes
    this.updateRoster();

    // Handle phase-specific logic
    if (phase === GamePhase.LOBBY) {
      // Already in lobby
    } else if (phase === GamePhase.COUNTDOWN) {
      this.handleCountdownPhase(state);
    } else if (phase === GamePhase.IN_MATCH) {
      this.handleMatchPhase(state);
    } else if (phase === GamePhase.RESULTS) {
      this.handleResultsPhase(state);
    }
  }

  /**
   * Handle countdown phase
   */
  private handleCountdownPhase(state: any): void {
    console.log('Countdown started!');

    // Clear any existing countdown
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
    }

    // Calculate remaining time
    const countdownStart = state.countdownStart;
    const countdownDuration = CONFIG.COUNTDOWN_DURATION;
    const elapsed = Date.now() - countdownStart;
    let remaining = Math.ceil((countdownDuration - elapsed) / 1000);

    if (remaining > 0) {
      this.ui.showScreen('match');
      this.ui.showCountdown(remaining);

      this.countdownInterval = setInterval(() => {
        remaining--;
        if (remaining > 0) {
          this.ui.showCountdown(remaining);
        } else {
          this.ui.hideCountdown();
          clearInterval(this.countdownInterval);
          this.countdownInterval = null;
        }
      }, 1000);
    } else {
      this.ui.hideCountdown();
    }
  }

  /**
   * Handle match phase
   */
  private handleMatchPhase(state: any): void {
    console.log(`🎮 Match started! Players in state: ${state.players.size}, SessionId: ${this.sessionId}`);

    // Log all players
    state.players.forEach((player: any, sessionId: string) => {
      console.log(`  Player ${sessionId}: ${player.name} (${player.team}) at (${player.posX}, ${player.posY}, ${player.posZ})`);
    });

    // Make sure we're showing the match HUD
    this.ui.showScreen('match');
    this.ui.hideCountdown();

    // Get local player's state
    const localPlayer = state.players.get(this.sessionId);
    if (localPlayer) {
      // Update HUD with player's stats
      this.ui.updateHUD(
        Math.sqrt(localPlayer.velocityX ** 2 + localPlayer.velocityY ** 2 + localPlayer.velocityZ ** 2),
        localPlayer.posY,
        100  // Ammo (placeholder, will be added later)
      );
    }
  }

  /**
   * Handle results phase
   */
  private handleResultsPhase(state: any): void {
    console.log('Match ended!');

    // Count alive players per team
    let redAlive = 0;
    let blueAlive = 0;

    state.players.forEach((player: any) => {
      if (player.alive) {
        if (player.team === 'RED') redAlive++;
        else blueAlive++;
      }
    });

    // Determine winner
    const winner = redAlive > blueAlive ? 'Red' : blueAlive > redAlive ? 'Blue' : 'Tie';

    this.ui.showResults(winner, redAlive, blueAlive);
  }

  /**
   * Update roster display from room state
   */
  private updateRoster(): void {
    if (!this.room || !this.room.state) return;

    const players: any[] = [];
    this.room.state.players.forEach((player: any, sessionId: string) => {
      players.push({
        name: player.name,
        team: player.team,
        ready: player.ready,
        isBot: player.isBot,
        sessionId: sessionId
      });

      // Update local player's state
      if (sessionId === this.sessionId) {
        this.currentTeam = player.team;
        this.isReady = player.ready;
        this.ui.setReadyButtonState(player.ready);

        // Update team button highlights
        const redButton = document.getElementById('team-red-button');
        const blueButton = document.getElementById('team-blue-button');

        if (redButton && blueButton) {
          if (player.team === 'RED') {
            redButton.classList.add('active');
            blueButton.classList.remove('active');
          } else {
            blueButton.classList.add('active');
            redButton.classList.remove('active');
          }
        }
      }
    });

    this.ui.updateRoster(players);
  }

  /**
   * Create airplane placeholder mesh
   */
  private createAirplaneMesh(sessionId: string, team: Team): Mesh {
    console.log(`🛠️  Creating airplane mesh for session ${sessionId}, team ${team}`);

    // Create parent mesh to hold all parts
    const airplane = new Mesh(`airplane-${sessionId}`, this.scene);

    // Fuselage (body) - long box
    const fuselage = MeshBuilder.CreateBox(`fuselage-${sessionId}`, {
      width: 2,   // X axis
      height: 1,  // Y axis
      depth: 5    // Z axis (length)
    }, this.scene);
    fuselage.parent = airplane;

    // Wings - wide flat box
    const wings = MeshBuilder.CreateBox(`wings-${sessionId}`, {
      width: 8,   // X axis (wingspan)
      height: 0.3,  // Y axis (thin)
      depth: 2    // Z axis
    }, this.scene);
    wings.parent = airplane;
    wings.position.z = -0.5; // Slightly behind center

    // Tail - vertical stabilizer
    const tail = MeshBuilder.CreateBox(`tail-${sessionId}`, {
      width: 0.3,  // X axis (thin)
      height: 2,   // Y axis (tall)
      depth: 1.5   // Z axis
    }, this.scene);
    tail.parent = airplane;
    tail.position.y = 0.5; // Above fuselage
    tail.position.z = 2;   // At back

    // Material based on team
    const material = new StandardMaterial(`airplane-mat-${sessionId}`, this.scene);
    if (team === Team.RED) {
      material.diffuseColor = new Color3(0.86, 0.21, 0.27); // Red (#dc3545)
    } else {
      material.diffuseColor = new Color3(0.05, 0.43, 0.99); // Blue (#0d6efd)
    }
    material.specularColor = new Color3(0.5, 0.5, 0.5); // Some shine

    // Apply material to all parts
    fuselage.material = material;
    wings.material = material;
    tail.material = material;

    return airplane;
  }

  /**
   * Update camera to follow local player
   */
  private updateCamera(): void {
    if (!this.sessionId || !this.playerMeshes.has(this.sessionId)) {
      return;
    }

    const localPlayerMesh = this.playerMeshes.get(this.sessionId);
    if (localPlayerMesh && this.camera.lockedTarget !== localPlayerMesh) {
      // Set camera to follow local player's mesh
      this.camera.lockedTarget = localPlayerMesh;
      console.log(`📷 Camera now following ${this.sessionId}`);
    }
  }

  /**
   * Update all player mesh positions from server state
   */
  private updatePlayerMeshes(): void {
    if (!this.room || !this.room.state || !this.room.state.players) {
      return;
    }

    // Debug log every 60 frames (about once per second)
    const now = Date.now();
    if (!this.lastMeshUpdateLog || now - this.lastMeshUpdateLog > 1000) {
      console.log(`🔄 updatePlayerMeshes: room=${!!this.room}, state=${!!this.room?.state}, players=${this.room?.state?.players?.size || 0}, meshes=${this.playerMeshes.size}, sessionId=${this.sessionId}`);
      this.lastMeshUpdateLog = now;
    }

    // Update existing meshes and create new ones
    this.room.state.players.forEach((player: any, sessionId: string) => {
      let mesh = this.playerMeshes.get(sessionId);

      // Create mesh if it doesn't exist
      if (!mesh) {
        mesh = this.createAirplaneMesh(sessionId, player.team);
        this.playerMeshes.set(sessionId, mesh);
        console.log(`✈️  Created mesh for ${player.name} (${player.team}) at session ${sessionId}`);

        // If this is the local player, immediately position camera near them
        if (sessionId === this.sessionId) {
          console.log(`📷 Positioning camera at local player's spawn position: (${player.posX}, ${player.posY}, ${player.posZ})`);
          this.camera.position.set(player.posX, player.posY + 10, player.posZ - 30);
          this.camera.setTarget(new Vector3(player.posX, player.posY, player.posZ));
        }
      }

      // Update position
      mesh.position.x = player.posX;
      mesh.position.y = player.posY;
      mesh.position.z = player.posZ;

      // Update rotation
      mesh.rotation.x = player.rotX;
      mesh.rotation.y = player.rotY;
      mesh.rotation.z = player.rotZ;

      // Hide dead players
      if (!player.alive) {
        mesh.setEnabled(false);
      } else {
        mesh.setEnabled(true);

        // Visual indicator for spawn protection
        if (player.invulnerable) {
          // Make mesh slightly transparent during invulnerability
          const material = mesh.getChildMeshes()[0].material as StandardMaterial;
          if (material) {
            material.alpha = 0.7;
          }
        } else {
          const material = mesh.getChildMeshes()[0].material as StandardMaterial;
          if (material && material.alpha !== 1.0) {
            material.alpha = 1.0;
          }
        }
      }
    });

    // Remove meshes for players that left
    this.playerMeshes.forEach((mesh, sessionId) => {
      if (!this.room?.state.players.has(sessionId)) {
        console.log(`🗑️  Removing mesh for ${sessionId}`);
        mesh.dispose();
        this.playerMeshes.delete(sessionId);
      }
    });
  }

  /**
   * Update all projectile meshes from server state
   */
  private updateProjectileMeshes(): void {
    if (!this.room || !this.room.state || !this.room.state.projectiles) return;

    // Update existing projectile meshes and create new ones
    this.room.state.projectiles.forEach((projectile: any, id: string) => {
      let mesh = this.projectileMeshes.get(id);

      // Create mesh if doesn't exist
      if (!mesh) {
        // Small sphere for projectile (0.5m radius)
        mesh = MeshBuilder.CreateSphere(`projectile-${id}`, {
          diameter: 1,
          segments: 8
        }, this.scene);

        // Bright yellow/orange material
        const material = new StandardMaterial(`projectile-mat-${id}`, this.scene);
        material.diffuseColor = new Color3(1.0, 0.8, 0.0); // Bright yellow
        material.emissiveColor = new Color3(1.0, 0.6, 0.0); // Glowing effect
        mesh.material = material;

        this.projectileMeshes.set(id, mesh);
      }

      // Update position
      mesh.position.x = projectile.posX;
      mesh.position.y = projectile.posY;
      mesh.position.z = projectile.posZ;
    });

    // Remove meshes for projectiles that expired
    this.projectileMeshes.forEach((mesh, id) => {
      if (!this.room?.state.projectiles.has(id)) {
        mesh.dispose();
        this.projectileMeshes.delete(id);
      }
    });
  }

  private createScene(): Scene {
    const scene = new Scene(this.engine);

    // Sky background - light blue sky
    scene.clearColor = new Color4(0.53, 0.81, 0.98, 1.0);

    // Camera - follow camera for third-person view
    this.camera = new FollowCamera('followCamera', new Vector3(0, 150, -300), scene);
    this.camera.radius = 30;           // Distance from target (30 meters behind)
    this.camera.heightOffset = 10;     // Height above target (10 meters up)
    this.camera.rotationOffset = 180;  // Look forward from behind (180 degrees)
    this.camera.cameraAcceleration = 0.05;  // How fast camera moves to target
    this.camera.maxCameraSpeed = 20;   // Maximum camera movement speed
    // Note: Do NOT attachControl - we want camera to follow plane automatically without manual control

    // Ambient light - soft overall illumination
    const ambientLight = new HemisphericLight('ambientLight', new Vector3(0, 1, 0), scene);
    ambientLight.intensity = 0.5;
    ambientLight.diffuse = new Color3(0.9, 0.9, 1.0); // Slightly blue tint
    ambientLight.groundColor = new Color3(0.3, 0.3, 0.3); // Darker ground reflection

    // Directional light - main sun light
    const sunLight = new DirectionalLight('sunLight', new Vector3(-1, -2, -1), scene);
    sunLight.intensity = 0.8;
    sunLight.diffuse = new Color3(1.0, 0.95, 0.8); // Warm sunlight
    sunLight.specular = new Color3(1.0, 1.0, 0.9);

    // Island placeholder - circular terrain
    const island = MeshBuilder.CreateDisc('island', {
      radius: 1000,  // 2000m diameter arena (1000m radius)
      tessellation: 64
    }, scene);
    island.rotation.x = Math.PI / 2; // Rotate to be horizontal
    island.position.y = 0;

    // Island material - green/brown terrain
    const islandMat = new StandardMaterial('islandMat', scene);
    islandMat.diffuseColor = new Color3(0.25, 0.5, 0.2); // Terrain green
    islandMat.specularColor = new Color3(0.1, 0.1, 0.1); // Low specularity for terrain
    island.material = islandMat;

    // Ocean plane - water around the island
    const ocean = MeshBuilder.CreateGround('ocean', {
      width: 4000,  // Larger than island
      height: 4000
    }, scene);
    ocean.position.y = -5; // Slightly below island

    // Ocean material - blue water
    const oceanMat = new StandardMaterial('oceanMat', scene);
    oceanMat.diffuseColor = new Color3(0.1, 0.3, 0.6); // Deep blue water
    oceanMat.specularColor = new Color3(0.3, 0.3, 0.4); // Some water reflection
    ocean.material = oceanMat;

    return scene;
  }
}

// Start the game
new Game();
