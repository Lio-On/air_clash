import { Engine, Scene, HemisphericLight, Vector3, MeshBuilder, FreeCamera, StandardMaterial, Color3, Color4 } from '@babylonjs/core';
import { CONFIG, Team, GamePhase } from '@air-clash/common';

class Game {
  private engine: Engine;
  private scene: Scene;

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

    // Run render loop
    this.engine.runRenderLoop(() => {
      this.scene.render();
    });

    // Handle window resize
    window.addEventListener('resize', () => {
      this.engine.resize();
    });

    console.log('✅ Air Clash Client initialized');
    console.log('✅ Successfully imported CONFIG from @air-clash/common');
    console.log(`📊 Max Players Per Team: ${CONFIG.MAX_PLAYERS_PER_TEAM}`);
    console.log(`⏱️  Countdown Duration: ${CONFIG.COUNTDOWN_DURATION}ms`);
    console.log(`🛡️  Spawn Protection: ${CONFIG.SPAWN_PROTECTION_DURATION}ms`);
    console.log(`🔵 Team.BLUE = ${Team.BLUE}`);
    console.log(`🔴 Team.RED = ${Team.RED}`);
    console.log(`📍 GamePhase.LOBBY = ${GamePhase.LOBBY}`);
  }

  private createScene(): Scene {
    const scene = new Scene(this.engine);
    scene.clearColor.set(0.53, 0.81, 0.92, 1); // Sky blue

    // Camera
    const camera = new FreeCamera('camera', new Vector3(0, 5, -10), scene);
    camera.setTarget(Vector3.Zero());
    camera.attachControl(this.engine.getRenderingCanvas(), true);

    // Light
    const light = new HemisphericLight('light', new Vector3(0, 1, 0), scene);
    light.intensity = 0.7;

    // Ground (temporary placeholder)
    const ground = MeshBuilder.CreateGround('ground', { width: 100, height: 100 }, scene);

    // Material for ground
    const groundMat = new StandardMaterial('groundMat', scene);
    groundMat.diffuseColor = new Color3(0.2, 0.6, 0.2); // Green
    ground.material = groundMat;

    // Test sphere
    const sphere = MeshBuilder.CreateSphere('sphere', { diameter: 2 }, scene);
    sphere.position.y = 1;
    const sphereMat = new StandardMaterial('sphereMat', scene);
    sphereMat.diffuseColor = new Color3(1, 1, 1); // White
    sphere.material = sphereMat;

    return scene;
  }
}

// Start the game
new Game();
