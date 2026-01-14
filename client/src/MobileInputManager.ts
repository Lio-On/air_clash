import nipplejs from 'nipplejs';

/**
 * Manages mobile touch controls (virtual joystick + fire button)
 */
export class MobileInputManager {
  private joystickManager: any = null;
  private controlsVisible: boolean = false;
  private isTouchDevice: boolean = false;

  // Analog input state
  private analogInput = {
    pitch: 0,  // -1 to +1 (Y axis)
    roll: 0,   // -1 to +1 (X axis)
    shoot: false,
  };

  // Configuration
  private readonly DEADZONE = 0.1;
  private readonly SMOOTHING = 0.3; // Light smoothing to reduce jitter

  // Persistent state key
  private readonly STORAGE_KEY = 'air-clash-mobile-controls';

  constructor() {
    this.isTouchDevice = this.detectTouch();
    this.loadControlsPreference();

    if (this.shouldShowControls()) {
      this.initializeMobileControls();
    }

    this.addToggleButton();
  }

  /**
   * Detect if device has touch capability
   */
  private detectTouch(): boolean {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  }

  /**
   * Load controls preference from localStorage
   */
  private loadControlsPreference(): void {
    const saved = localStorage.getItem(this.STORAGE_KEY);
    if (saved !== null) {
      this.controlsVisible = saved === 'true';
    } else {
      // Default: show on touch devices, hide on non-touch
      this.controlsVisible = this.isTouchDevice;
    }
  }

  /**
   * Save controls preference to localStorage
   */
  private saveControlsPreference(): void {
    localStorage.setItem(this.STORAGE_KEY, this.controlsVisible.toString());
  }

  /**
   * Determine if controls should be shown
   */
  private shouldShowControls(): boolean {
    return this.controlsVisible;
  }

  /**
   * Initialize mobile controls UI
   */
  private initializeMobileControls(): void {
    // Create mobile controls container
    const container = document.createElement('div');
    container.id = 'mobile-controls';
    container.innerHTML = `
      <div id="joystick-zone"></div>
      <div id="button-zone">
        <button id="fire-button" class="mobile-fire-button">FIRE</button>
      </div>
    `;
    document.body.appendChild(container);

    // Add CSS styles
    this.addMobileStyles();

    // Initialize joystick
    this.initializeJoystick();

    // Initialize fire button
    this.initializeFireButton();

    console.log('✅ Mobile controls initialized');
  }

  /**
   * Add CSS styles for mobile controls
   */
  private addMobileStyles(): void {
    const style = document.createElement('style');
    style.textContent = `
      /* Mobile Controls Container */
      #mobile-controls {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 50;
        display: flex;
      }

      #mobile-controls.hidden {
        display: none;
      }

      /* Joystick Zone (Left half) */
      #joystick-zone {
        position: absolute;
        bottom: 20px;
        left: 20px;
        width: 150px;
        height: 150px;
        pointer-events: auto;
        touch-action: none;
      }

      /* Button Zone (Right side) */
      #button-zone {
        position: absolute;
        bottom: 20px;
        right: 20px;
        pointer-events: auto;
        touch-action: none;
      }

      /* Fire Button */
      .mobile-fire-button {
        width: 100px;
        height: 100px;
        border-radius: 50%;
        border: 3px solid rgba(255, 255, 255, 0.5);
        background: rgba(220, 53, 69, 0.4);
        color: rgba(255, 255, 255, 0.8);
        font-size: 16px;
        font-weight: bold;
        cursor: pointer;
        transition: all 0.1s;
        outline: none;
        user-select: none;
        -webkit-user-select: none;
        -webkit-tap-highlight-color: transparent;
      }

      .mobile-fire-button:active,
      .mobile-fire-button.active {
        background: rgba(220, 53, 69, 0.8);
        border-color: rgba(255, 255, 255, 0.9);
        color: rgba(255, 255, 255, 1);
        transform: scale(0.95);
      }

      /* Controls Toggle Button */
      #controls-toggle {
        position: absolute;
        top: 10px;
        right: 10px;
        padding: 8px 12px;
        background: rgba(0, 0, 0, 0.6);
        border: 1px solid rgba(255, 255, 255, 0.3);
        border-radius: 6px;
        color: #fff;
        font-size: 12px;
        cursor: pointer;
        z-index: 200;
        pointer-events: auto;
        user-select: none;
        -webkit-user-select: none;
      }

      #controls-toggle:hover {
        background: rgba(0, 0, 0, 0.8);
      }

      /* Nipplejs custom styling for better visibility */
      .nipple {
        opacity: 0.5;
      }

      .nipple:active,
      .nipple.active {
        opacity: 0.8;
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Initialize nipplejs joystick
   */
  private initializeJoystick(): void {
    const zone = document.getElementById('joystick-zone');
    if (!zone) return;

    this.joystickManager = nipplejs.create({
      zone: zone,
      mode: 'static',
      position: { left: '50%', top: '50%' },
      color: 'white',
      size: 120,
      threshold: 0.1,
      fadeTime: 0,
    });

    // Handle joystick move
    this.joystickManager.on('move', (_evt: any, data: any) => {
      if (!data.vector) return;

      // Extract normalized vector (-1 to +1)
      let x = data.vector.x;
      let y = data.vector.y;

      // Apply deadzone
      if (Math.abs(x) < this.DEADZONE) x = 0;
      if (Math.abs(y) < this.DEADZONE) y = 0;

      // Apply light smoothing to reduce jitter
      // FIX: Apply progressive sensitivity curve (Adjusted)
      // Cubic (Power 3) was too sluggish in the center.
      // Now trying Power 1.6 (Balanced):
      // 50% stick -> ~33% output (was 12.5% on Cubic, 50% on Linear)
      const sensitivityCurve = (val: number) => {
        return Math.pow(Math.abs(val), 1.6) * Math.sign(val);
      };

      this.analogInput.roll = this.lerp(this.analogInput.roll, sensitivityCurve(x), this.SMOOTHING);
      this.analogInput.pitch = this.lerp(this.analogInput.pitch, sensitivityCurve(-y), this.SMOOTHING); // Invert Y for natural pitch
    });

    // Handle joystick end (release)
    this.joystickManager.on('end', () => {
      this.analogInput.roll = 0;
      this.analogInput.pitch = 0;
    });

    console.log('✅ Joystick initialized');
  }

  /**
   * Initialize fire button
   */
  private initializeFireButton(): void {
    const fireButton = document.getElementById('fire-button');
    if (!fireButton) return;

    // Touch start - start shooting
    fireButton.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.analogInput.shoot = true;
      fireButton.classList.add('active');
    });

    // Touch end - stop shooting
    fireButton.addEventListener('touchend', (e) => {
      e.preventDefault();
      this.analogInput.shoot = false;
      fireButton.classList.remove('active');
    });

    // Touch cancel - stop shooting
    fireButton.addEventListener('touchcancel', (e) => {
      e.preventDefault();
      this.analogInput.shoot = false;
      fireButton.classList.remove('active');
    });

    // Also support mouse for testing on desktop
    fireButton.addEventListener('mousedown', (e) => {
      e.preventDefault();
      this.analogInput.shoot = true;
      fireButton.classList.add('active');
    });

    fireButton.addEventListener('mouseup', (e) => {
      e.preventDefault();
      this.analogInput.shoot = false;
      fireButton.classList.remove('active');
    });

    console.log('✅ Fire button initialized');
  }

  /**
   * Add controls toggle button
   */
  private addToggleButton(): void {
    const toggleButton = document.createElement('button');
    toggleButton.id = 'controls-toggle';
    toggleButton.textContent = `Controls: ${this.controlsVisible ? 'On' : 'Off'}`;

    toggleButton.addEventListener('click', () => {
      this.toggleControls();
    });

    document.body.appendChild(toggleButton);
  }

  /**
   * Toggle controls visibility
   */
  private toggleControls(): void {
    this.controlsVisible = !this.controlsVisible;
    this.saveControlsPreference();

    const container = document.getElementById('mobile-controls');
    const toggleButton = document.getElementById('controls-toggle');

    if (this.controlsVisible) {
      // Show controls
      if (!container) {
        this.initializeMobileControls();
      } else {
        container.classList.remove('hidden');
      }
      if (toggleButton) toggleButton.textContent = 'Controls: On';
      console.log('✅ Mobile controls enabled');
    } else {
      // Hide controls
      if (container) {
        container.classList.add('hidden');
      }
      if (toggleButton) toggleButton.textContent = 'Controls: Off';

      // Reset input state when hiding
      this.analogInput.roll = 0;
      this.analogInput.pitch = 0;
      this.analogInput.shoot = false;

      console.log('✅ Mobile controls disabled');
    }
  }

  /**
   * Get current analog input state
   */
  public getAnalogInput(): { pitch: number; roll: number; shoot: boolean } {
    if (!this.controlsVisible) {
      return { pitch: 0, roll: 0, shoot: false };
    }
    return { ...this.analogInput };
  }

  /**
   * Check if mobile controls are active
   */
  public isActive(): boolean {
    return this.controlsVisible;
  }

  /**
   * Linear interpolation for smoothing
   */
  private lerp(start: number, end: number, factor: number): number {
    return start + (end - start) * factor;
  }

  /**
   * Cleanup
   */
  public dispose(): void {
    if (this.joystickManager) {
      this.joystickManager.destroy();
      this.joystickManager = null;
    }

    const container = document.getElementById('mobile-controls');
    if (container) {
      container.remove();
    }

    const toggleButton = document.getElementById('controls-toggle');
    if (toggleButton) {
      toggleButton.remove();
    }
  }
}
