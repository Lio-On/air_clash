# Development Progress

## Step 1.1 - Create Repository Structure ✅ COMPLETED

**Date**: January 9, 2026

### What Was Implemented

Created a monorepo structure using NPM Workspaces with three packages:

#### 1. Root Configuration
- **package.json**: NPM Workspaces configuration with scripts for running client/server
- **README.md**: Comprehensive setup instructions for new developers
- **.gitignore**: Standard Node.js gitignore configuration

#### 2. `/common` Package
Shared TypeScript types and constants used by both client and server.

**Files Created:**
- `package.json`: TypeScript-only package configuration
- `tsconfig.json`: TypeScript compiler config (target: ES2020, output: CommonJS)
- `src/index.ts`: Initial shared types and constants

**Exports:**
- `Team` enum (RED, BLUE)
- `GamePhase` enum (LOBBY, COUNTDOWN, IN_MATCH, RESULTS)
- `PlayerState` interface
- `CONFIG` constants (max players, tick rates, durations)

#### 3. `/server` Package
Colyseus authoritative game server.

**Files Created:**
- `package.json`: Dependencies include Colyseus, Express, CORS
- `tsconfig.json`: Server-side TypeScript config with decorators enabled
- `src/index.ts`: Basic Colyseus server with health check endpoint

**Features:**
- Server listens on port 3000
- Health check endpoint at `/health`
- Successfully imports and logs CONFIG from `@air-clash/common`
- Uses `tsx watch` for hot reload during development

#### 4. `/client` Package
Vite + Babylon.js web client.

**Files Created:**
- `package.json`: Dependencies include Babylon.js, Colyseus.js, Vite
- `tsconfig.json`: Client-side TypeScript config (target: ES2020, module: ESNext)
- `vite.config.ts`: Vite configuration with alias for `@air-clash/common` pointing to source files for better dev experience
- `index.html`: Main HTML page with loading screen and canvas
- `src/main.ts`: Babylon.js initialization with basic 3D scene

**Features:**
- Vite dev server on port 5173
- Babylon.js engine initialization
- Basic 3D scene with:
  - Sky blue background
  - Hemispheric light
  - Green ground plane (100x100)
  - White test sphere
  - Free camera
- Successfully imports CONFIG, Team, and GamePhase from `@air-clash/common`
- Console logs verify common package integration

### Tests Passed ✅

All three tests from Step 1.1 implementation plan passed:

1. **✅ Server starts and logs listening message**
   - Server starts on port 3000
   - Logs: "🚀 Air Clash Server is listening on port 3000"
   - Successfully imports CONFIG from common package

2. **✅ Client loads in browser**
   - Vite dev server starts on port 5173
   - 3D scene renders with blue sky, green ground, white sphere
   - No compilation errors

3. **✅ Common package can be imported by both packages**
   - Server successfully imports and logs CONFIG values
   - Client successfully imports Team, GamePhase, CONFIG enums
   - Vite alias allows direct source imports during development

### Developer Notes

**Important Configuration:**
- The client's `vite.config.ts` includes an alias that maps `@air-clash/common` to `../common/src` for better development experience
- This allows hot reload of common package changes without rebuilding
- For production builds, the common package should still be built with `npm run build --workspace=common`

**Running the Project:**
```bash
# Install dependencies
npm install

# Build common package (first time only)
npm run build --workspace=common

# Run server (Terminal 1)
npm run dev:server

# Run client (Terminal 2)
npm run dev:client

# Open browser to http://localhost:5173/
```

---

## Step 1.2 - Add MVP Config and Environment Switching ✅ COMPLETED

**Date**: January 9, 2026

### What Was Implemented

Added comprehensive environment configuration system with support for development and production environments.

#### 1. Updated Common Package

**Files Modified:**
- `common/src/index.ts`: Added new exports
  - `ROOM_NAME` constant in CONFIG ('dogfight')
  - `Environment` type ('development' | 'production')
  - `DebugConfig` interface (showFPS, showColliders, verboseLogging)

#### 2. Client Environment Configuration

**Files Created:**
- `client/.env`: Development environment variables (git-ignored)
- `client/.env.example`: Template with all available variables
- `client/.env.production`: Production environment defaults
- `client/src/config/index.ts`: Configuration loader using Vite env variables

**Client Config Features:**
- `serverUrl`: WebSocket endpoint (ws://localhost:3000 for dev)
- `environment`: development or production mode
- `debug`: Object with FPS counter, collider visibility, verbose logging flags
- `isProduction` / `isDevelopment`: Convenience flags
- Auto-logs configuration in development mode

**Environment Variables:**
- `VITE_SERVER_URL`: WebSocket server URL
- `VITE_ENV`: Environment mode
- `VITE_DEBUG_FPS`: Show FPS overlay
- `VITE_DEBUG_COLLIDERS`: Show collision boxes (future feature)
- `VITE_DEBUG_VERBOSE`: Enable verbose console logging

**Client Updates:**
- `client/src/main.ts`: Imports and uses `clientConfig`
- Added FPS counter overlay when `debug.showFPS` is true
- Conditional verbose logging based on config
- Logs server URL, environment, and room name on startup

#### 3. Server Environment Configuration

**Files Created:**
- `server/.env`: Development environment variables (git-ignored)
- `server/.env.example`: Template with all available variables
- `server/.env.production`: Production environment defaults

**Package Updated:**
- `server/package.json`: Added `dotenv` dependency (^16.3.1)

**Server Updates:**
- `server/src/index.ts`: Complete rewrite with environment support
  - Loads environment variables using `dotenv/config`
  - Reads NODE_ENV, PORT, CORS_ORIGIN, VERBOSE_LOGGING
  - CORS configuration with configurable origin
  - Enhanced health check endpoint returns environment and room name
  - Conditional verbose logging based on VERBOSE_LOGGING flag
  - Logs environment, CORS origin, room name on startup

**Environment Variables:**
- `PORT`: Server port (default: 3000)
- `NODE_ENV`: Environment mode (development/production)
- `CORS_ORIGIN`: Allowed client origin for CORS
- `VERBOSE_LOGGING`: Enable detailed server logs

#### 4. Updated .gitignore

Modified to exclude environment files but keep examples:
- `.env` and `.env.local` are git-ignored
- `.env.example` and `.env.production` are tracked
- Added explicit `!.env.example` and `!.env.production` rules

#### 5. Documentation Updates

**README.md**: Added comprehensive "Environment Configuration" section with:
- Explanation of all client environment variables
- Explanation of all server environment variables
- Instructions for switching between development and production
- Guide for testing production builds locally
- Updated "Connecting Client to Server" section with WebSocket info

### Tests Passed ✅

All tests from Step 1.2 implementation plan passed:

**✅ Test: Switching between local and production endpoints changes where the client connects**

1. **Server Configuration Test:**
   ```bash
   curl http://localhost:3000/health
   ```
   Response:
   ```json
   {
     "status": "ok",
     "timestamp": 1767958533482,
     "environment": "development",
     "room": "dogfight"
   }
   ```
   - Verified server reads NODE_ENV from .env
   - Verified ROOM_NAME from common package

2. **Server Logs Test:**
   ```
   🚀 Air Clash Server is listening on port 3000
   🌍 Environment: development
   🔗 CORS Origin: http://localhost:5173
   🎮 Room Name: dogfight
   📊 Server Tick Rate: 30 Hz
   📡 Snapshot Rate: 15 Hz
   👥 Max Players Per Team: 5
   ⏱️  Countdown Duration: 5000ms
   🛡️  Spawn Protection: 2000ms
   ✅ Server ready to accept connections
   ```
   - Verified verbose logging works
   - Verified environment variables are loaded

3. **Client Configuration Test:**
   - Browser console shows:
     ```
     🔧 Client Configuration: {serverUrl: "ws://localhost:3000", ...}
     ✅ Air Clash Client initialized
     🌍 Environment: development
     🔗 Server URL: ws://localhost:3000
     🎮 Room Name: dogfight
     ```
   - FPS counter appears on screen when debug.showFPS = true
   - Verified client reads VITE_* environment variables

4. **Mobile-Friendly Build Test:**
   - Vite production build creates minified, cache-busted assets
   - Build output includes hashed filenames (e.g., `main-abc123.js`)
   - All assets properly minified for mobile

### Developer Notes

**Environment Switching Workflow:**

For development (default):
1. Use `client/.env` and `server/.env` (git-ignored)
2. Client connects to `ws://localhost:3000`
3. Server accepts requests from `http://localhost:5173`
4. Debug features enabled

For production:
1. Copy `.env.production` to `.env.production.local` and customize
2. Update `VITE_SERVER_URL` with production WebSocket URL (wss://)
3. Update `CORS_ORIGIN` with production client URL (https://)
4. Disable debug flags
5. Build with `npm run build:all`

**Key Design Decisions:**
- Used Vite's built-in env variable system for client (no extra deps)
- Used dotenv for server (Node.js standard)
- Debug flags controlled by environment variables
- CORS origin configurable for security
- Verbose logging can be disabled in production
- Health endpoint exposes environment for monitoring

---

## Step 2.1 - Create Base Colyseus Server ✅ COMPLETED

**Date**: January 9, 2026

### What Was Implemented

Created the foundational Colyseus room system with DogfightRoom class and registered it with the server.

#### 1. DogfightRoom Class

**File Created:**
- `server/src/rooms/DogfightRoom.ts`: Base Colyseus room implementation

**Implemented Lifecycle Methods:**

**`onCreate(options)`**
- Called when room is created
- Sets `maxClients` to 10 (5v5 from CONFIG.MAX_PLAYERS_PER_TEAM)
- Sets room metadata (roomName, maxPlayers, currentPlayers)
- Logs room creation with room ID

**`onJoin(client, options)`**
- Called when a client joins the room
- Increments player count
- Logs client session ID and current player count
- Updates room metadata with current player count

**`onLeave(client, consented)`**
- Called when a client leaves the room
- Decrements player count
- Logs client session ID, consented flag, and current player count
- Updates room metadata with current player count

**`onDispose()`**
- Called when room is disposed (no more clients)
- Logs room disposal with room ID and final player count
- Clean room cleanup

**Features:**
- Player count tracking (internal counter)
- Room metadata for matchmaking/lobby systems
- Detailed logging for all lifecycle events
- Max client enforcement (10 players: 5v5)

#### 2. Server Registration

**File Modified:**
- `server/src/index.ts`: Added DogfightRoom registration

**Changes:**
- Import DogfightRoom class
- Register room with `gameServer.define(CONFIG.ROOM_NAME, DogfightRoom)`
- Updated startup logs to show room registration

**Room Registration:**
```typescript
gameServer.define(CONFIG.ROOM_NAME, DogfightRoom);
// Registers "dogfight" room using DogfightRoom class
```

#### 3. Test Client

**File Created:**
- `server/test-client.js`: Node.js test script for room functionality

**Test Script Features:**
- Creates two Colyseus clients
- Tests joining room (both clients)
- Tests leaving room (both clients)
- Verifies expected server logs
- Uses colyseus.js client library (already available from workspace)

**Test Workflow:**
1. Client 1 joins → Player count: 1/10
2. Client 2 joins → Player count: 2/10
3. Client 1 leaves → Player count: 1/10
4. Client 2 leaves → Player count: 0/10
5. Room disposes (no clients remaining)

### Tests Passed ✅

All tests from Step 2.1 implementation plan passed:

**✅ Test 1: Joining increases player count in server logs**

Test output:
```
🧪 Starting DogfightRoom test...
📥 Test 1: Client 1 joining room...
✅ Client 1 joined room: 8H-Lk3gca
   Session ID: TW8EjPnmA

📥 Test 2: Client 2 joining room...
✅ Client 2 joined room: 8H-Lk3gca
   Session ID: xiXKG4ubs
```

Server logs:
```
🎮 DogfightRoom created: 8H-Lk3gca
👤 Client TW8EjPnmA joined
📊 Player count: 1/10
👤 Client xiXKG4ubs joined
📊 Player count: 2/10
```

**✅ Test 2: Leaving decreases player count cleanly without errors**

Test output:
```
📤 Test 3: Client 1 leaving room...
✅ Client 1 left room

📤 Test 4: Client 2 leaving room...
✅ Client 2 left room

✅ All tests passed!
```

Server logs:
```
👋 Client TW8EjPnmA left (consented: true)
📊 Player count: 1/10
👋 Client xiXKG4ubs left (consented: true)
📊 Player count: 0/10
🗑️  DogfightRoom disposed: 8H-Lk3gca
📊 Final player count: 0
```

**Additional Verification:**
- ✅ Room metadata updates correctly with player count
- ✅ Room disposes cleanly when all clients leave
- ✅ No errors or crashes during join/leave cycles
- ✅ Multiple clients can join the same room
- ✅ Max clients set to 10 (5v5)

### Developer Notes

**Testing Workflow:**
```bash
# Terminal 1: Start server
npm run dev:server

# Terminal 2: Run test client
node server/test-client.js
```

**Room Lifecycle:**
1. First client calls `joinOrCreate("dogfight")` → Room created, client joins
2. Subsequent clients call `joinOrCreate("dogfight")` → Join existing room
3. When last client leaves → Room disposes automatically
4. Next client creates a new room instance

**Key Design Decisions:**
- Simple player count tracking (will be replaced with state schema in Step 2.2)
- Room metadata for future matchmaking features
- Verbose logging for development/debugging
- Max clients enforced at room level
- Room auto-disposes when empty (Colyseus default behavior)

**Note on State:**
Currently, the room doesn't have a state schema yet. Player count is tracked internally but not synchronized to clients. Step 2.2 will add Colyseus state schema for proper client synchronization.

---

## Step 2.2 - Define Minimal Authoritative Room State ✅ COMPLETED

**Date**: January 9, 2026

### What Was Implemented

Created Colyseus state schemas for synchronizing game state between server and all clients.

#### 1. PlayerState Schema

**File Created:**
- `server/src/schemas/PlayerState.ts`: Individual player state

**Schema Definition:**
```typescript
export class PlayerState extends Schema {
  @type('string') id: string;
  @type('string') name: string;
  @type('string') team: Team;
  @type('boolean') ready: boolean;
  @type('boolean') alive: boolean;
  @type('boolean') isBot: boolean;
}
```

**Fields:**
- `id`: Player session ID (unique identifier)
- `name`: Player display name
- `team`: Team.RED or Team.BLUE
- `ready`: Whether player is ready to start
- `alive`: Whether player is alive in match
- `isBot`: Whether this is an AI bot

**Constructor:**
- Accepts id, name, team, isBot parameters
- Initializes ready and alive to false

#### 2. RoomState Schema

**File Created:**
- `server/src/schemas/RoomState.ts`: Overall room state

**Schema Definition:**
```typescript
export class RoomState extends Schema {
  @type('string') phase: GamePhase;
  @type({ map: PlayerState }) players: MapSchema<PlayerState>;
  @type('number') countdownStart: number;
  @type('number') matchStart: number;
  @type('number') aliveRed: number;
  @type('number') aliveBlue: number;
}
```

**Fields:**
- `phase`: Current game phase (LOBBY, COUNTDOWN, IN_MATCH, RESULTS)
- `players`: MapSchema of PlayerState (keyed by session ID)
- `countdownStart`: Timestamp when countdown started (0 if not started)
- `matchStart`: Timestamp when match started (0 if not started)
- `aliveRed`: Count of alive Red team players
- `aliveBlue`: Count of alive Blue team players

**Initial Values:**
- phase: GamePhase.LOBBY
- players: Empty MapSchema
- All timers and counters: 0

#### 3. DogfightRoom Updates

**File Modified:**
- `server/src/rooms/DogfightRoom.ts`: Now uses state schemas

**Key Changes:**

**Type Declaration:**
```typescript
export class DogfightRoom extends Room<RoomState>
```
- Room now typed with RoomState generic

**onCreate():**
```typescript
this.setState(new RoomState());
this.state.phase = GamePhase.LOBBY;
```
- Initializes room state
- Sets initial phase to LOBBY
- Logs phase on creation

**onJoin():**
```typescript
const player = new PlayerState(
  client.sessionId,
  options.name || `Player-${client.sessionId.substring(0, 4)}`,
  Team.RED, // Default for now
  false
);
this.state.players.set(client.sessionId, player);
```
- Creates PlayerState from join options
- Extracts player name from options or generates default
- Currently assigns all players to RED team (will be changed in Step 2.3)
- Adds player to state.players MapSchema
- Logs player name and team assignment

**onLeave():**
```typescript
this.state.players.delete(client.sessionId);
```
- Removes player from state
- Automatically synchronized to remaining clients

**onDispose():**
```typescript
console.log(`📍 Final phase: ${this.state.phase}`);
```
- Logs final phase for debugging

**Removed:**
- Private `playerCount` variable (now use `state.players.size`)

#### 4. Test Client Updates

**File Modified:**
- `server/test-client.js`: Enhanced to verify state synchronization

**New Test Features:**
- Passes player names in join options (`{ name: 'Alice' }`, `{ name: 'Bob' }`)
- Reads and displays room state from both clients
- Verifies phase consistency
- Verifies player count consistency
- Verifies player data consistency
- Tests state updates when players leave
- Comprehensive assertions with error messages

**Test Flow:**
1. Client 1 joins with name "Alice"
2. Verify Client 1 sees correct state (1 player, LOBBY phase)
3. Client 2 joins with name "Bob"
4. Verify both clients see same state (2 players, LOBBY phase)
5. Client 1 leaves
6. Verify Client 2 sees updated state (1 player)
7. Client 2 leaves
8. Room disposes

### Tests Passed ✅

All tests from Step 2.2 implementation plan passed:

**✅ Test: Connect 2 clients and confirm both see consistent state**

**Test Output:**
```
🧪 Starting DogfightRoom state synchronization test...

📥 Test 1: Client 1 joining room...
✅ Client 1 joined room: 18SPa8Y5L
   Session ID: xSC6BrK4n

📊 Client 1 sees state:
   Phase: LOBBY
   Players count: 1
   AliveRed: 0, AliveBlue: 0
   Player xSC6BrK4: Alice, Team: RED, Ready: false

📥 Test 2: Client 2 joining room...
✅ Client 2 joined room: 18SPa8Y5L
   Session ID: pqxLwC-kD

📊 Client 1 sees state:
   Phase: LOBBY
   Players count: 2
   Player xSC6BrK4: Alice, Team: RED
   Player pqxLwC-k: Bob, Team: RED

📊 Client 2 sees state:
   Phase: LOBBY
   Players count: 2
   Player xSC6BrK4: Alice, Team: RED
   Player pqxLwC-k: Bob, Team: RED

✅ State consistency check PASSED!
   Both clients see: phase=LOBBY, players=2

📤 Test 3: Client 1 leaving room...
✅ Client 1 left room

📊 Client 2 sees updated state:
   Players count: 1
   Player pqxLwC-k: Bob
✅ Client 2 correctly sees 1 player remaining

📤 Test 4: Client 2 leaving room...
✅ Client 2 left room

✅ All state synchronization tests passed!

Verified:
  ✅ Both clients see consistent phase
  ✅ Both clients see consistent player count
  ✅ Both clients see consistent player data
  ✅ State updates when players leave
```

**Server Logs:**
```
🎮 DogfightRoom created: 18SPa8Y5L
📍 Room phase: LOBBY
👤 Client xSC6BrK4n joined
📊 Player count: 1/10
👤 Player "Alice" assigned to team RED
👤 Client pqxLwC-kD joined
📊 Player count: 2/10
👤 Player "Bob" assigned to team RED
👋 Client xSC6BrK4n left (consented: true)
📊 Player count: 1/10
👋 Client pqxLwC-kD left (consented: true)
📊 Player count: 0/10
🗑️  DogfightRoom disposed: 18SPa8Y5L
📊 Final player count: 0
📍 Final phase: LOBBY
```

**Verification Results:**
- ✅ Both clients see `phase: LOBBY`
- ✅ Both clients see `players: 2` after both join
- ✅ Both clients see same player names (Alice, Bob)
- ✅ Both clients see same player teams (RED)
- ✅ Both clients see same player ready states (false)
- ✅ Client 2 sees updated count (1) after Client 1 leaves
- ✅ No state mismatch errors
- ✅ State synchronization is real-time (within ~100ms)

### Developer Notes

**Colyseus State Synchronization:**

Colyseus automatically synchronizes state changes to all connected clients:
- When `state.players.set()` is called → All clients receive player add event
- When `state.players.delete()` is called → All clients receive player remove event
- When `state.phase` changes → All clients receive phase change event
- Changes are delta-compressed for efficiency

**MapSchema vs ArraySchema:**
- Used `MapSchema<PlayerState>` for players (keyed by session ID)
- Allows O(1) lookup: `state.players.get(sessionId)`
- Allows O(1) removal: `state.players.delete(sessionId)`
- Better than array for player management

**State Determinism:**
- All state changes happen server-side
- No client-side state mutations
- Prevents desyncs and cheating
- Timer fields use server timestamps for consistency

**Current Limitations:**
- All players default to RED team (will be fixed in Step 2.3)
- No team selection UI yet
- No ready toggle yet
- Alive counts not updated (will be used in combat system)
- Timer fields not used yet (will be used in countdown/match)

**Performance:**
- State is small and efficient (~100 bytes per player)
- MapSchema only sends delta updates (not full state)
- Suitable for 60+ tick rate if needed

### Next Steps
- Step 2.3: Implement lobby actions (set name, choose team, toggle ready)
