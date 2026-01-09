import { GamePhase } from '@air-clash/common';

/**
 * Manages UI screens and transitions
 */
export class UIManager {
  private currentScreen: string = 'home';

  constructor() {
    this.initializeUI();
    this.setupEventListeners();
  }

  /**
   * Initialize UI HTML structure
   */
  private initializeUI(): void {
    const uiContainer = document.createElement('div');
    uiContainer.id = 'ui-container';
    uiContainer.innerHTML = `
      <!-- Home/Join Screen -->
      <div id="home-screen" class="ui-screen active">
        <div class="screen-content">
          <h1 class="game-title">AIR CLASH</h1>
          <div class="form-group">
            <label for="pilot-name">Pilot Name</label>
            <input
              type="text"
              id="pilot-name"
              placeholder="Enter your name"
              maxlength="20"
              autocomplete="off"
            />
          </div>
          <button id="join-button" class="btn btn-primary btn-large">
            Join Battle
          </button>
        </div>
      </div>

      <!-- Lobby Screen -->
      <div id="lobby-screen" class="ui-screen">
        <div class="screen-content">
          <h2 class="screen-title">Lobby</h2>

          <div class="team-selection">
            <button id="team-red-button" class="btn btn-team btn-team-red">
              Red Team
            </button>
            <button id="team-blue-button" class="btn btn-team btn-team-blue">
              Blue Team
            </button>
          </div>

          <button id="ready-button" class="btn btn-ready btn-large">
            Ready
          </button>

          <div class="roster">
            <div class="roster-column">
              <h3 class="roster-title red">Red Team</h3>
              <div id="roster-red" class="roster-list"></div>
            </div>
            <div class="roster-column">
              <h3 class="roster-title blue">Blue Team</h3>
              <div id="roster-blue" class="roster-list"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Match HUD -->
      <div id="match-hud" class="ui-screen">
        <div class="hud-top-left">
          <div class="hud-stat">
            <span class="hud-label">Speed</span>
            <span id="hud-speed" class="hud-value">0</span>
          </div>
          <div class="hud-stat">
            <span class="hud-label">Altitude</span>
            <span id="hud-altitude" class="hud-value">0</span>
          </div>
        </div>

        <div class="hud-top-right">
          <div class="hud-stat">
            <span class="hud-label">Ammo</span>
            <span id="hud-ammo" class="hud-value">100</span>
          </div>
        </div>

        <div class="hud-center">
          <div id="countdown-display" class="countdown-display"></div>
        </div>
      </div>

      <!-- Results Screen -->
      <div id="results-screen" class="ui-screen">
        <div class="screen-content">
          <h1 id="results-title" class="results-title">Red Team Wins!</h1>
          <div id="results-stats" class="results-stats">
            <div class="stat-row">
              <span>Red Team:</span>
              <span id="results-red-score">5</span>
            </div>
            <div class="stat-row">
              <span>Blue Team:</span>
              <span id="results-blue-score">3</span>
            </div>
          </div>
          <button id="return-lobby-button" class="btn btn-primary btn-large">
            Return to Lobby
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(uiContainer);
  }

  /**
   * Setup event listeners for UI elements
   */
  private setupEventListeners(): void {
    // Home screen - Join button
    const joinButton = document.getElementById('join-button');
    joinButton?.addEventListener('click', () => this.onJoinClick());

    // Lobby screen - Team selection
    const redTeamButton = document.getElementById('team-red-button');
    redTeamButton?.addEventListener('click', () => this.onTeamClick('RED'));

    const blueTeamButton = document.getElementById('team-blue-button');
    blueTeamButton?.addEventListener('click', () => this.onTeamClick('BLUE'));

    // Lobby screen - Ready toggle
    const readyButton = document.getElementById('ready-button');
    readyButton?.addEventListener('click', () => this.onReadyClick());

    // Results screen - Return to lobby
    const returnButton = document.getElementById('return-lobby-button');
    returnButton?.addEventListener('click', () => this.onReturnToLobbyClick());

    // Home screen - Enter key on name input
    const nameInput = document.getElementById('pilot-name') as HTMLInputElement;
    nameInput?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.onJoinClick();
      }
    });
  }

  /**
   * Show a specific screen
   */
  public showScreen(screenName: string): void {
    // Hide all screens
    const screens = document.querySelectorAll('.ui-screen');
    screens.forEach(screen => screen.classList.remove('active'));

    // Show requested screen
    const targetScreen = document.getElementById(`${screenName}-screen`);
    if (targetScreen) {
      targetScreen.classList.add('active');
      this.currentScreen = screenName;
    }

    // Special handling for match HUD
    if (screenName === 'match') {
      const matchHud = document.getElementById('match-hud');
      if (matchHud) {
        matchHud.classList.add('active');
        this.currentScreen = 'match';
      }
    }
  }

  /**
   * Get pilot name from input
   */
  public getPilotName(): string {
    const nameInput = document.getElementById('pilot-name') as HTMLInputElement;
    return nameInput?.value.trim() || 'Pilot';
  }

  /**
   * Update lobby roster display
   */
  public updateRoster(players: any[]): void {
    const redRoster = document.getElementById('roster-red');
    const blueRoster = document.getElementById('roster-blue');

    if (!redRoster || !blueRoster) return;

    // Clear existing roster
    redRoster.innerHTML = '';
    blueRoster.innerHTML = '';

    // Add players to appropriate roster
    players.forEach(player => {
      const playerElement = document.createElement('div');
      playerElement.className = 'roster-player';
      if (player.ready) {
        playerElement.classList.add('ready');
      }
      if (player.isBot) {
        playerElement.classList.add('bot');
      }

      playerElement.innerHTML = `
        <span class="player-name">${player.name}</span>
        ${player.ready ? '<span class="ready-indicator">✓</span>' : ''}
      `;

      if (player.team === 'RED') {
        redRoster.appendChild(playerElement);
      } else {
        blueRoster.appendChild(playerElement);
      }
    });
  }

  /**
   * Update ready button state
   */
  public setReadyButtonState(isReady: boolean): void {
    const readyButton = document.getElementById('ready-button');
    if (readyButton) {
      if (isReady) {
        readyButton.textContent = 'Not Ready';
        readyButton.classList.add('ready');
      } else {
        readyButton.textContent = 'Ready';
        readyButton.classList.remove('ready');
      }
    }
  }

  /**
   * Update HUD values
   */
  public updateHUD(speed: number, altitude: number, ammo: number): void {
    const speedElement = document.getElementById('hud-speed');
    const altitudeElement = document.getElementById('hud-altitude');
    const ammoElement = document.getElementById('hud-ammo');

    if (speedElement) speedElement.textContent = Math.round(speed).toString();
    if (altitudeElement) altitudeElement.textContent = Math.round(altitude).toString();
    if (ammoElement) ammoElement.textContent = ammo.toString();
  }

  /**
   * Show countdown display
   */
  public showCountdown(seconds: number): void {
    const countdownDisplay = document.getElementById('countdown-display');
    if (countdownDisplay) {
      countdownDisplay.textContent = seconds.toString();
      countdownDisplay.style.display = 'block';
    }
  }

  /**
   * Hide countdown display
   */
  public hideCountdown(): void {
    const countdownDisplay = document.getElementById('countdown-display');
    if (countdownDisplay) {
      countdownDisplay.style.display = 'none';
    }
  }

  /**
   * Update results screen
   */
  public showResults(winner: string, redScore: number, blueScore: number): void {
    const titleElement = document.getElementById('results-title');
    const redScoreElement = document.getElementById('results-red-score');
    const blueScoreElement = document.getElementById('results-blue-score');

    if (titleElement) {
      titleElement.textContent = `${winner} Team Wins!`;
      titleElement.className = `results-title ${winner.toLowerCase()}`;
    }

    if (redScoreElement) redScoreElement.textContent = redScore.toString();
    if (blueScoreElement) blueScoreElement.textContent = blueScore.toString();

    this.showScreen('results');
  }

  // Event handler callbacks (to be overridden by Game class)
  public onJoinClick = (): void => {
    console.log('Join button clicked');
  };

  public onTeamClick = (team: string): void => {
    console.log('Team clicked:', team);
  };

  public onReadyClick = (): void => {
    console.log('Ready button clicked');
  };

  public onReturnToLobbyClick = (): void => {
    console.log('Return to lobby clicked');
  };
}
