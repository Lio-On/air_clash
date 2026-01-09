import { Engine, Scene, HemisphericLight, DirectionalLight, Vector3, MeshBuilder, FreeCamera, StandardMaterial, Color3, Color4 } from '@babylonjs/core';
import { CONFIG, Team, GamePhase } from '@air-clash/common';
import { clientConfig } from './config';
import { UIManager } from './UIManager';
import { Client, Room } from 'colyseus.js';

class Game {
  private engine: Engine;
  private scene: Scene;
  private ui: UIManager;
  private client: Client;
  private room: Room | null = null;
  private sessionId: string = '';
  private currentTeam: string = 'RED';
  private isReady: boolean = false;
  private countdownInterval: any = null;

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
    this.engine.runRenderLoop(() => {
      this.scene.render();
    });

    // Handle window resize
    window.addEventListener('resize', () => {
      this.engine.resize();
    });

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

    // Listen to state changes
    this.room.onStateChange((state) => {
      console.log('Room state updated:', state.phase);
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
    console.log('Match started!');

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

  private createScene(): Scene {
    const scene = new Scene(this.engine);

    // Sky background - light blue sky
    scene.clearColor = new Color4(0.53, 0.81, 0.98, 1.0);

    // Camera - positioned above and behind to see the island
    const camera = new FreeCamera('camera', new Vector3(0, 150, -300), scene);
    camera.setTarget(new Vector3(0, 0, 0));
    camera.attachControl(this.engine.getRenderingCanvas(), true);

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
