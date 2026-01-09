import { Engine, Scene, HemisphericLight, DirectionalLight, Vector3, MeshBuilder, FreeCamera, StandardMaterial, Color3, Color4 } from '@babylonjs/core';
import { CONFIG, Team, GamePhase } from '@air-clash/common';
import { clientConfig } from './config';

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
