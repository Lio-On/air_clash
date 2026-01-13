import { Engine, Scene, HemisphericLight, DirectionalLight, Vector3, MeshBuilder, FreeCamera, FollowCamera, ArcRotateCamera, StandardMaterial, Color3, Color4, Mesh, Scalar, VertexData, ParticleSystem, Texture } from '@babylonjs/core';
import { CONFIG, Team, GamePhase, getTerrainHeight, TERRAIN_CONFIG } from '@air-clash/common';
import { clientConfig } from './config';
import { UIManager } from './UIManager';
import { Client, Room } from 'colyseus.js';

class Game {
  private engine: Engine;
  private scene: Scene;
  private camera: FollowCamera;
  private lobbyCamera: FreeCamera;
  private deathCamera: ArcRotateCamera | null = null;
  private isPlayerDead: boolean = false;
  private ui: UIManager;
  private client: Client;
  private room: Room | null = null;
  private sessionId: string = '';
  private currentTeam: string = 'RED';
  private isReady: boolean = false;
  private countdownInterval: any = null;
  private playerMeshes: Map<string, Mesh> = new Map();
  private projectileMeshes: Map<string, Mesh> = new Map();
  private smokeSystems: Map<string, ParticleSystem> = new Map(); // Crash smoke effects
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
      this.updateDeathCameraControls(); // Arrow key controls for death camera
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

    // Return to lobby clicked
    this.ui.onReturnToLobbyClick = async () => {
      console.log('Returning to lobby...');

      // Disconnect from current room
      if (this.room) {
        await this.room.leave();
        this.room = null;
      }

      // Clear session and state
      this.sessionId = '';
      this.currentTeam = 'RED';
      this.isReady = false;

      // Clear countdown interval if active
      if (this.countdownInterval) {
        clearInterval(this.countdownInterval);
        this.countdownInterval = null;
      }

      // Dispose all meshes
      this.playerMeshes.forEach((mesh) => mesh.dispose());
      this.playerMeshes.clear();

      this.projectileMeshes.forEach((mesh) => mesh.dispose());
      this.projectileMeshes.clear();

      // Show home screen
      this.ui.showScreen('home');

      console.log('✅ Returned to home screen');
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

    // Reset death state for new match
    this.isPlayerDead = false;

    // Ensure we are using the lobby camera for the countdown view
    if (this.scene.activeCamera !== this.lobbyCamera) {
      this.scene.activeCamera = this.lobbyCamera;
      console.log('� Switched to lobby camera for countdown');
    }

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

    // Switch to game camera (FollowCamera) only if we're coming from the Lobby Camera
    const switchedCamera = this.scene.activeCamera === this.lobbyCamera;
    if (switchedCamera) {
      this.scene.activeCamera = this.camera;
      console.log('📷 Match started - Switching to FollowCamera');
    }

    // Get local player's state
    const localPlayer = state.players.get(this.sessionId);
    if (localPlayer) {
      // Update HUD with player's stats
      this.ui.updateHUD(
        Math.sqrt(localPlayer.velocityX ** 2 + localPlayer.velocityY ** 2 + localPlayer.velocityZ ** 2),
        localPlayer.posY,
        localPlayer.ammo
      );

      // FIX: Snap camera instantly to the correct follow position
      if (switchedCamera) {
        console.log('📷 Snapping camera to initial follow position (Rotation Aware)');

        // Calculate position behind the plane based on its rotation
        // Forward vector (horizontal) is: x = -sin(rotY), z = -cos(rotY)
        // Backward vector is: x = sin(rotY), z = cos(rotY)
        const radius = 80;
        const heightOffset = 30;

        const offsetX = Math.sin(localPlayer.rotY) * radius;
        const offsetZ = Math.cos(localPlayer.rotY) * radius;

        this.camera.position.set(
          localPlayer.posX + offsetX,
          localPlayer.posY + heightOffset,
          localPlayer.posZ + offsetZ
        );

        // Also force the camera rotation to align immediately
        // The FollowCamera will update this next frame, but setting it now helps prevent 1-frame glitches
        this.camera.rotationOffset = 0; // Ensure offset is reset
      }
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

    // Mesh is built along Z-axis (Forward = +Z), matching server physics
    // No rotation needed - server uses Z-forward coordinate system

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

    // Store team in metadata for updates
    airplane.metadata = { team: team };

    return airplane;
  }

  /**
   * Create smoke particle effect for crashing plane
   */
  private createSmokeEffect(planeMesh: Mesh): ParticleSystem {
    // Reduce capacity as we emit fewer particles
    const smokeSystem = new ParticleSystem('smoke', 500, this.scene);

    // Load the smoke texture from public folder
    smokeSystem.particleTexture = new Texture("/smoke.png", this.scene);

    // Emit from the plane's position (center of mesh)
    smokeSystem.emitter = planeMesh;

    // Emit from the tail/back of the plane
    // Plane is approx 5 units long (Z-axis). Back is approx Z = +2.5 (since forward is -Z)
    smokeSystem.minEmitBox = new Vector3(-0.2, 0, 2.0);
    smokeSystem.maxEmitBox = new Vector3(0.2, 0.5, 3.0);

    // Emission rate - Distinct puffs one after another
    // Plane moves at ~50-80 units/sec. 20 puffs/sec = ~2.5-4 units separation.
    smokeSystem.emitRate = 20;

    // Particle appearance - Sphere-like puffs
    // Start smaller, grow larger
    smokeSystem.minSize = 2;
    smokeSystem.maxSize = 2; // Uniform start size

    // Size gradient: Start at 0.5x, grow to 2.5x over lifetime
    smokeSystem.addSizeGradient(0, 0.5);
    smokeSystem.addSizeGradient(1.0, 2.5);

    // Lifetime - "a couple of seconds"
    smokeSystem.minLifeTime = 2.0;
    smokeSystem.maxLifeTime = 3.0;

    // Grey tones (light to dark grey)
    smokeSystem.color1 = new Color4(0.6, 0.6, 0.6, 1.0); // Light grey
    smokeSystem.color2 = new Color4(0.4, 0.4, 0.4, 1.0); // Darker grey
    smokeSystem.colorDead = new Color4(0.2, 0.2, 0.2, 0.0); // Fade to black/transparent

    // Emission direction - Slight drift up and back, but mostly leaving a trail
    smokeSystem.direction1 = new Vector3(-0.5, 0.5, 1);
    smokeSystem.direction2 = new Vector3(0.5, 1.5, 1);

    // Speed - Very slow emission power, let the plane leave them behind
    smokeSystem.minEmitPower = 0.1;
    smokeSystem.maxEmitPower = 0.5;
    smokeSystem.updateSpeed = 0.015;

    // Gravity - Smoke slowly rises
    smokeSystem.gravity = new Vector3(0, 1.0, 0);

    // Start the system
    smokeSystem.start();

    return smokeSystem;
  }

  /**
   * Update camera to follow local player or switch to death camera
   */
  private updateCamera(): void {
    if (!this.sessionId || !this.playerMeshes.has(this.sessionId)) {
      return;
    }

    // Check if local player is dead
    if (this.room && this.room.state && this.room.state.players) {
      const localPlayer = this.room.state.players.get(this.sessionId);
      if (localPlayer && !localPlayer.alive && !this.isPlayerDead) {
        // Player just died - switch to death camera
        this.isPlayerDead = true;
        this.activateDeathCamera();
        console.log('💀 Player died - switching to spectator camera');
        return;
      } else if (localPlayer && localPlayer.alive && this.isPlayerDead) {
        // Player respawned - switch back to follow camera
        this.isPlayerDead = false;
        this.scene.activeCamera = this.camera;
        console.log('✨ Player respawned - switching back to follow camera');
      }
    }

    // Normal follow camera logic (only if player is alive)
    if (!this.isPlayerDead) {
      const localPlayerMesh = this.playerMeshes.get(this.sessionId);
      if (localPlayerMesh && this.camera.lockedTarget !== localPlayerMesh) {
        // Set camera to follow local player's mesh
        this.camera.lockedTarget = localPlayerMesh;
        console.log(`📷 Camera now following ${this.sessionId}`);
      }
    }
  }

  /**
   * Activate spectator death camera with arrow key controls
   */
  private activateDeathCamera(): void {
    // Create death camera if it doesn't exist
    if (!this.deathCamera) {
      this.deathCamera = new ArcRotateCamera(
        'DeathCamera',
        0,                    // Alpha (horizontal angle - start at 0)
        Math.PI / 2.5,        // Beta (72° - horizontal view, looking slightly down)
        800,                  // Radius (800m - closer default)
        Vector3.Zero(),       // Target (island center)
        this.scene
      );

      // DO NOT attach mouse controls - we use arrow keys instead
      // this.deathCamera.attachControl(this.engine.getRenderingCanvas()!, true);

      // Zoom limits
      this.deathCamera.lowerRadiusLimit = 200;   // Can zoom in to 200m
      this.deathCamera.upperRadiusLimit = 1500;  // Can zoom out to 1500m

      // Very slow auto-rotation
      this.deathCamera.useAutoRotationBehavior = true;
      if (this.deathCamera.autoRotationBehavior) {
        this.deathCamera.autoRotationBehavior.idleRotationSpeed = 0.05; // Very slow spin
      }

      console.log('🎥 Death camera created (arrow key controls)');
    }

    // Switch to death camera
    this.scene.activeCamera = this.deathCamera;
  }

  /**
   * Update death camera controls using arrow keys
   */
  private updateDeathCameraControls(): void {
    if (!this.isPlayerDead || !this.deathCamera) {
      return;
    }

    const ROTATION_SPEED = 0.02;  // Radians per frame for rotation
    const ZOOM_SPEED = 10;        // Units per frame for zoom

    // Left/Right = Rotate around island
    if (this.inputState.left) {
      this.deathCamera.alpha -= ROTATION_SPEED;
    }
    if (this.inputState.right) {
      this.deathCamera.alpha += ROTATION_SPEED;
    }

    // Up/Down = Zoom In/Out
    if (this.inputState.up) {
      this.deathCamera.radius = Math.max(
        this.deathCamera.lowerRadiusLimit,
        this.deathCamera.radius - ZOOM_SPEED
      );
    }
    if (this.inputState.down) {
      this.deathCamera.radius = Math.min(
        this.deathCamera.upperRadiusLimit,
        this.deathCamera.radius + ZOOM_SPEED
      );
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

      // Target position and rotation from server
      const targetPos = new Vector3(player.posX, player.posY, player.posZ);
      const targetRot = new Vector3(player.rotX, player.rotY, player.rotZ);

      // Interpolate position (smooth movement) to fix flickering
      // Lerp factor 0.3 means we move 30% towards target each frame (smooth catchup)
      // This smoothing hides the 30Hz vs 60Hz update rate difference
      mesh.position = Vector3.Lerp(mesh.position, targetPos, 0.3);

      // Interpolate rotation (shortest path)
      // Server uses Z-forward coordinate system matching Babylon.js mesh default
      mesh.rotation.x = Scalar.Lerp(mesh.rotation.x, targetRot.x, 0.3);
      mesh.rotation.y = Scalar.Lerp(mesh.rotation.y, targetRot.y, 0.3);
      mesh.rotation.z = Scalar.Lerp(mesh.rotation.z, targetRot.z, 0.3);

      // If distance is too large (teleport/spawn), snap instantly
      if (Vector3.Distance(mesh.position, targetPos) > 100) {
        mesh.position = targetPos;
        mesh.rotation.x = targetRot.x;
        mesh.rotation.y = targetRot.y;
        mesh.rotation.z = targetRot.z;
      }

      // Check for team change and update color
      if (mesh.metadata && mesh.metadata.team !== player.team) {
        const material = this.scene.getMaterialByName(`airplane-mat-${sessionId}`) as StandardMaterial;
        if (material) {
          if (player.team === Team.RED) {
            material.diffuseColor = new Color3(0.86, 0.21, 0.27); // Red
          } else {
            material.diffuseColor = new Color3(0.05, 0.43, 0.99); // Blue
          }
          mesh.metadata.team = player.team;
          console.log(`🎨 Updated team color for ${player.name} to ${player.team}`);
        }
      }

      // Handle crash smoke effects
      if (player.isCrashing && !this.smokeSystems.has(sessionId)) {
        // Create smoke particle system for crashing plane
        const smokeSystem = this.createSmokeEffect(mesh);
        this.smokeSystems.set(sessionId, smokeSystem);
        console.log(`💨 Created smoke effect for crashing ${player.name}`);
      }

      // Hide dead players and cleanup smoke
      if (!player.alive) {
        mesh.setEnabled(false);

        // Dispose smoke system if it exists
        const smokeSystem = this.smokeSystems.get(sessionId);
        if (smokeSystem) {
          smokeSystem.stop();
          smokeSystem.dispose();
          this.smokeSystems.delete(sessionId);
          console.log(`🧹 Cleaned up smoke effect for ${player.name}`);
        }
      } else {
        mesh.setEnabled(true);

        // Visual indicator for spawn protection
        if (player.invulnerable && !player.isCrashing) {
          // Make mesh slightly transparent during invulnerability (but not during crash)
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

        // Also cleanup smoke system if exists
        const smokeSystem = this.smokeSystems.get(sessionId);
        if (smokeSystem) {
          smokeSystem.stop();
          smokeSystem.dispose();
          this.smokeSystems.delete(sessionId);
        }
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

    // IMPORTANT: Disable environment reflections/IBL to prevent blue sky reflections on terrain
    scene.environmentTexture = null;

    // Sky background - light blue sky
    scene.clearColor = new Color4(0.53, 0.81, 0.98, 1.0);

    // ===== ATMOSPHERIC DEPTH: Distance Fog =====
    // Adds subtle depth by fading distant objects toward sky color
    scene.fogEnabled = true;
    scene.fogMode = Scene.FOGMODE_LINEAR; // Linear fog for predictable fade
    scene.fogColor = new Color3(0.53, 0.81, 0.98); // Match sky color
    scene.fogStart = 1000; // Fog starts at 1000m (pushed further back)
    scene.fogEnd = 1800;   // Full fog at 1800m (beyond map boundary)

    // 1. Lobby Camera - Static view for lobby and countdown
    this.lobbyCamera = new FreeCamera('lobbyCamera', new Vector3(0, 700, -1800), scene);
    this.lobbyCamera.setTarget(new Vector3(0, 200, 0)); // Look at the volcano/center
    // Default to lobby camera initially
    scene.activeCamera = this.lobbyCamera;

    // 2. Game Camera - Follow camera for third-person view (will be activated on match start)
    this.camera = new FollowCamera('camera1', new Vector3(0, 500, -800), scene);
    this.camera.radius = 80;           // Distance from target (80 meters behind, scaled 10x)
    this.camera.heightOffset = 30;     // Height above target (30 meters up, scaled 3x)
    this.camera.rotationOffset = 0;    // Camera behind plane, looking forward
    this.camera.cameraAcceleration = 0.05;  // How fast camera moves to target
    this.camera.maxCameraSpeed = 20;   // Maximum camera movement speed
    // Note: Do NOT attachControl - we want camera to follow plane automatically without manual control

    // ===== SUN LIGHTING: Enhanced Directional Light =====
    // Ambient light - reduced for better contrast
    const ambientLight = new HemisphericLight('ambientLight', new Vector3(0, 1, 0), scene);
    ambientLight.intensity = 0.4; // Reduced from 0.5 for stronger sun contrast
    ambientLight.diffuse = new Color3(0.95, 0.95, 1.0); // Cooler ambient (sky tint)
    ambientLight.groundColor = new Color3(0.3, 0.35, 0.25); // Subtle green ground bounce

    // Directional sun light - stronger and from a clearer angle
    const sunLight = new DirectionalLight('sunLight', new Vector3(-1, -1.8, -0.5), scene);
    sunLight.intensity = 1.2; // Increased from 0.8 for better slope definition
    sunLight.diffuse = new Color3(1.0, 0.98, 0.9); // Bright warm sunlight
    sunLight.specular = new Color3(0.8, 0.8, 0.7); // Subtle specular (not too shiny)

    // Procedural terrain mesh using shared terrain function
    const terrainSize = 2000; // 2000m x 2000m terrain
    const terrainSubdivisions = 128; // High resolution for smooth mountains
    const terrain = this.createProceduralTerrain(scene, terrainSize, terrainSubdivisions);

    // Terrain material - StandardMaterial with zero reflections
    const terrainMat = new StandardMaterial('terrainMat', scene);
    terrainMat.diffuseColor = new Color3(0.25, 0.5, 0.2); // Terrain green
    terrainMat.specularColor = new Color3(0, 0, 0); // Completely black = zero specular reflection
    terrainMat.specularPower = 1; // Minimum power (rough surface)
    terrainMat.reflectionTexture = null; // Explicitly no reflection texture
    terrainMat.emissiveColor = new Color3(0, 0, 0); // No self-illumination
    // terrainMat.backFaceCulling = false; // Reverted: Normals fixed
    terrain.material = terrainMat;

    // Ocean plane - water around the island
    const ocean = MeshBuilder.CreateGround('ocean', {
      width: 4000,  // Larger than island
      height: 4000
    }, scene);
    ocean.position.y = 11; // 11m high to intersect island slopes and hide square edges

    // Ocean material - blue water
    const oceanMat = new StandardMaterial('oceanMat', scene);
    oceanMat.diffuseColor = new Color3(0.1, 0.3, 0.6); // Deep blue water
    oceanMat.specularColor = new Color3(0.3, 0.3, 0.4); // Some water reflection
    oceanMat.alpha = 1.0; // Completely opaque
    ocean.material = oceanMat;

    // Render ocean before terrain to prevent z-fighting
    // ocean.renderingGroupId = 0;
    // terrain.renderingGroupId = 1;

    // Scatter trees on terrain
    this.scatterTrees(scene, 400); // Add 400 trees (Increased for larger mountains)

    // Cloud Wall - visual indicator of soft boundary at 1200m radius
    const cloudWall = MeshBuilder.CreateCylinder('cloudWall', {
      diameter: 2700,      // 1350m radius × 2 (150m buffer beyond 1200m soft boundary)
      height: 5000,        // Tall wall from ground to sky
      tessellation: 64     // Smooth circle
    }, scene);
    cloudWall.position.y = 1000;  // Center at flight altitude (10x scale)

    // Cloud material - transparent white mist
    const cloudMat = new StandardMaterial('cloudMat', scene);
    cloudMat.diffuseColor = new Color3(1.0, 1.0, 1.0); // Pure white
    cloudMat.emissiveColor = new Color3(0.8, 0.8, 0.9); // Slight glow
    cloudMat.alpha = 0.2;  // 20% opacity (very transparent curtain)
    cloudMat.backFaceCulling = false; // Visible from both sides
    cloudWall.material = cloudMat;

    return scene;
  }

  /**
   * Create procedural terrain mesh using shared terrain height function
   */
  private createProceduralTerrain(scene: Scene, size: number, subdivisions: number): Mesh {
    const terrain = new Mesh('terrain', scene);

    // Calculate vertices
    const verticesPerSide = subdivisions + 1;
    const positions: number[] = [];
    const indices: number[] = [];
    const normals: number[] = [];

    // Generate vertices with height from shared terrain function
    for (let z = 0; z < verticesPerSide; z++) {
      for (let x = 0; x < verticesPerSide; x++) {
        // Map from grid coordinates to world coordinates
        const worldX = (x / subdivisions - 0.5) * size;
        const worldZ = (z / subdivisions - 0.5) * size;

        // Get height from shared terrain function
        const height = getTerrainHeight(worldX, worldZ);

        positions.push(worldX, height, worldZ);
      }
    }

    // Generate indices (triangles)
    for (let z = 0; z < subdivisions; z++) {
      for (let x = 0; x < subdivisions; x++) {
        const topLeft = z * verticesPerSide + x;
        const topRight = topLeft + 1;
        const bottomLeft = (z + 1) * verticesPerSide + x;
        const bottomRight = bottomLeft + 1;

        // Two triangles per quad - FLIPPED INDICES to fix winding order (Counter-Clockwise)
        indices.push(topLeft, topRight, bottomLeft);
        indices.push(topRight, bottomRight, bottomLeft);
      }
    }

    // Create vertex data
    const vertexData = new VertexData();
    vertexData.positions = positions;
    vertexData.indices = indices;

    // Compute normals for proper lighting
    VertexData.ComputeNormals(positions, indices, normals);
    vertexData.normals = normals;

    // Apply to mesh
    vertexData.applyToMesh(terrain);

    return terrain;
  }

  /**
   * Create a simple low-poly tree mesh
   */
  private createTreeMesh(scene: Scene): Mesh {
    // Tree trunk (cylinder) - much smaller
    const trunk = MeshBuilder.CreateCylinder('treeTrunk', {
      height: 5,
      diameter: 1,
      tessellation: 6
    }, scene);

    // Tree foliage (cone) - much smaller
    const foliage = MeshBuilder.CreateCylinder('treeFoliage', {
      height: 6,
      diameterTop: 0.5,
      diameterBottom: 4,
      tessellation: 6
    }, scene);
    foliage.position.y = 5; // Sit on top of trunk

    // Merge into single mesh
    const tree = Mesh.MergeMeshes([trunk, foliage], true, true, undefined, false, true);
    if (!tree) {
      return trunk; // Fallback if merge fails
    }

    // Tree material - brown trunk, green foliage
    const treeMat = new StandardMaterial('treeMat', scene);
    treeMat.diffuseColor = new Color3(0.05, 0.2, 0.05); // Much darker green
    treeMat.specularColor = new Color3(0.05, 0.05, 0.05); // Low specularity
    tree.material = treeMat;

    return tree;
  }

  /**
   * Scatter trees across the terrain
   */
  private scatterTrees(scene: Scene, count: number): void {
    // Create a single tree template
    const treeTemplate = this.createTreeMesh(scene);
    treeTemplate.isVisible = false; // Hide the template

    const SNOW_LEVEL = 220; // Allow trees up to 220m (Volcano is 250m)

    for (let i = 0; i < count; i++) {
      // Random position within terrain bounds (stay away from spawn at 1100m)
      const angle = Math.random() * Math.PI * 2;
      const distance = Math.random() * 500; // Within 500m of center (reduced from 800m)
      const x = Math.cos(angle) * distance;
      const z = Math.sin(angle) * distance;

      // Get terrain height at this position
      const terrainHeight = getTerrainHeight(x, z);

      // Only place trees above water and below snow line
      if (terrainHeight > TERRAIN_CONFIG.WATER_LEVEL + 10 && terrainHeight < SNOW_LEVEL) {
        // Create instance of tree
        const tree = treeTemplate.createInstance(`tree_${i}`);
        tree.position.x = x;
        tree.position.y = terrainHeight;
        tree.position.z = z;

        // Random rotation for variety
        tree.rotation.y = Math.random() * Math.PI * 2;

        // Random scale for variety (0.8 to 1.2)
        const scale = 0.8 + Math.random() * 0.4;
        tree.scaling = new Vector3(scale, scale, scale);
      }
    }
  }
}

// Start the game
new Game();
