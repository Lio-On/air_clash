# Architecture Documentation

## Project Structure

Air Clash uses a **monorepo architecture** with NPM Workspaces, containing three packages that share code through the `@air-clash/common` package.

```
air_clash/
├── package.json              # Root workspace configuration
├── README.md                 # Setup instructions
├── .gitignore               # Git ignore rules
├── memory-bank/             # Design docs and implementation plan
├── common/                  # Shared types and constants
│   ├── package.json
│   ├── tsconfig.json
│   ├── src/
│   │   └── index.ts        # Shared exports
│   └── dist/               # Built output (CommonJS)
├── server/                  # Colyseus game server
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       └── index.ts        # Server entry point
└── client/                  # Babylon.js web client
    ├── package.json
    ├── tsconfig.json
    ├── vite.config.ts      # Vite configuration
    ├── index.html          # HTML entry point
    └── src/
        └── main.ts         # Client entry point
```

---

## Package Details

### `/common` - Shared Package

**Purpose**: Single source of truth for types, interfaces, and constants used by both client and server.

**Key Files:**

#### `common/package.json`
- Package name: `@air-clash/common`
- Main export: `./dist/index.js` (CommonJS)
- Types export: `./dist/index.d.ts`
- Build script uses `tsc` to compile TypeScript to CommonJS

#### `common/tsconfig.json`
- Target: ES2020
- Module: CommonJS (for Node.js compatibility)
- Outputs declaration files for TypeScript autocomplete
- Strict mode enabled

#### `common/src/index.ts`
Contains shared game constants and types:

**Exports:**
- `Team` enum: RED, BLUE
- `GamePhase` enum: LOBBY, COUNTDOWN, IN_MATCH, RESULTS
- `PlayerState` interface: Player data structure
- `CONFIG` object: Game configuration constants
  - `MAX_PLAYERS_PER_TEAM`: 5
  - `COUNTDOWN_DURATION`: 5000ms
  - `SPAWN_PROTECTION_DURATION`: 2000ms
  - `SERVER_TICK_RATE`: 30 Hz
  - `SNAPSHOT_RATE`: 15 Hz

**Why CommonJS?**
The server runs on Node.js, which traditionally uses CommonJS. The common package outputs CommonJS modules to ensure compatibility.

---

### `/server` - Game Server

**Purpose**: Authoritative multiplayer game server using Colyseus framework.

**Key Files:**

#### `server/package.json`
**Dependencies:**
- `colyseus`: Multiplayer framework with state synchronization
- `express`: HTTP server framework
- `cors`: Cross-origin resource sharing middleware
- `@air-clash/common`: Shared types/constants

**Dev Dependencies:**
- `tsx`: TypeScript execution with hot reload
- `typescript`: TypeScript compiler
- `@types/*`: Type definitions

**Scripts:**
- `dev`: Runs server with hot reload using `tsx watch`
- `build`: Compiles TypeScript to JavaScript
- `start`: Runs compiled JavaScript in production

#### `server/tsconfig.json`
- Target: ES2020
- Module: CommonJS (Node.js standard)
- `experimentalDecorators: true` (required by Colyseus)
- `emitDecoratorMetadata: true` (required by Colyseus)

#### `server/src/index.ts`
**Current Implementation:**
1. Creates Express app with CORS enabled
2. Initializes Colyseus Server with HTTP server
3. Defines `/health` endpoint for status checks
4. Starts server on port 3000 (or PORT env variable)
5. Logs server configuration on startup
6. Imports CONFIG from `@air-clash/common` to verify package linking

**Server Startup Flow:**
```
Express app → HTTP server → Colyseus Server → Listen on port 3000
```

---

### `/client` - Web Client

**Purpose**: Browser-based 3D game client using Babylon.js for rendering and Colyseus.js for multiplayer.

**Key Files:**

#### `client/package.json`
**Dependencies:**
- `@babylonjs/core`: 3D engine core
- `@babylonjs/loaders`: Asset loading (for future 3D models)
- `colyseus.js`: Client-side multiplayer library
- `@air-clash/common`: Shared types/constants

**Dev Dependencies:**
- `vite`: Build tool and dev server
- `typescript`: TypeScript compiler
- `@types/node`: Node.js type definitions

**Scripts:**
- `dev`: Starts Vite dev server with hot reload
- `build`: Compiles TypeScript and builds production bundle
- `preview`: Preview production build locally

**Module Type:**
- `"type": "module"` enables ES modules (required by Vite)

#### `client/vite.config.ts`
**Configuration:**
```typescript
resolve: {
  alias: {
    '@air-clash/common': resolve(__dirname, '../common/src')
  }
}
```
- **Alias**: Maps `@air-clash/common` to source files instead of built files
- **Why?**: Enables hot reload when editing common package during development
- **Dev vs Prod**: In production builds, Vite bundles the source directly

**Server Config:**
- Port: 5173
- Host: true (allows network access for mobile testing)

**Build Config:**
- Target: ES2020
- Output: `dist/`

#### `client/index.html`
**Structure:**
```html
<div id="app">
  <div class="loading">Loading...</div>
</div>
<script type="module" src="/src/main.ts"></script>
```

**Styling:**
- Full-screen canvas with no margins
- Dark background (#1a1a1a)
- Loading screen replaced by JavaScript on initialization
- Mobile-optimized: `user-scalable=no`, `touch-action: none` on canvas

#### `client/src/main.ts`
**Game Class:**
Main entry point that initializes the 3D engine and scene.

**Initialization Flow:**
1. Clear loading screen from HTML
2. Create `<canvas>` element and append to `#app`
3. Initialize Babylon.js Engine with canvas
4. Create 3D scene
5. Start render loop
6. Add window resize handler
7. Log common package imports to verify linking

**Scene Setup:**
```typescript
createScene(): Scene {
  // Sky blue background
  scene.clearColor = (0.53, 0.81, 0.92, 1)

  // Free camera at (0, 5, -10) looking at origin
  // Hemispheric light from above
  // Green ground plane (100x100)
  // White test sphere at (0, 1, 0)
}
```

**Babylon.js Components:**
- **Engine**: Manages rendering and canvas
- **Scene**: Container for all 3D objects
- **FreeCamera**: Basic camera (will be replaced with FollowCamera later)
- **HemisphericLight**: Simple ambient + directional light
- **MeshBuilder**: Creates primitive shapes (ground, sphere)
- **StandardMaterial**: Basic material with diffuse color

---

## Data Flow

### Development Mode

```
Client (localhost:5173)
  ↓ imports from
@air-clash/common/src (direct TypeScript)
  ↑ shared by
Server (localhost:3000)
  ↓ imports from
@air-clash/common/dist (compiled JavaScript)
```

**Client Side:**
- Vite alias points to `common/src` for hot reload
- Direct TypeScript imports, no build step needed

**Server Side:**
- Requires built `common/dist` files
- Must run `npm run build --workspace=common` after changes

### Production Mode

```
Built Client Bundle
  ↓ includes
Compiled @air-clash/common code
```

```
Built Server
  ↓ requires
@air-clash/common/dist (deployed alongside)
```

Both client and server use the compiled common package in production.

---

## NPM Workspace Benefits

1. **Single `node_modules`**: Shared dependencies at root level
2. **Cross-package imports**: Packages can import from each other using package names
3. **Unified scripts**: Run commands for specific workspaces from root
4. **Consistent versions**: Shared dependencies stay in sync

**Workspace Commands:**
```bash
# Install all dependencies
npm install

# Run script in specific workspace
npm run dev --workspace=client
npm run build --workspace=server

# Root-level scripts
npm run dev:client    # Shorthand for workspace command
npm run dev:server
npm run build:all     # Builds all packages
```

---

## Future Architecture Notes

As development progresses:

### Server Package
Will be expanded with:
- `/rooms` - Colyseus room definitions (DogfightRoom)
- `/schemas` - Colyseus state schemas
- `/systems` - Game logic systems (physics, combat, bots)
- `/config` - Environment-specific configuration

### Client Package
Will be expanded with:
- `/scenes` - Different game scenes (menu, game, results)
- `/entities` - Game entity classes (Plane, Bullet)
- `/ui` - UI components (HUD, lobby, menus)
- `/input` - Input handling (touch, keyboard)
- `/network` - Colyseus client connection and state sync

### Common Package
Will be expanded with:
- Network message types
- Input frame structures
- Game state interfaces
- Validation utilities
- Physics constants (plane stats, bullet speed, etc.)
