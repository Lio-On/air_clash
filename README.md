# Air Clash

A fast-paced multiplayer airplane dogfight game. Two teams (Red vs Blue), up to 5v5, battle for air superiority using WWII-era fighter planes.

## Requirements

- **Node.js**: >= 18.0.0
- **npm**: >= 9.0.0

Check your versions:
```bash
node --version
npm --version
```

## Project Structure

This is a monorepo using NPM Workspaces:

- `/client` - Babylon.js web client (Vite + TypeScript)
- `/server` - Colyseus authoritative game server (Node.js + TypeScript)
- `/common` - Shared TypeScript types, interfaces, and constants

## Setup

### 1. Install all dependencies

From the root directory:

```bash
npm install
```

This will install dependencies for all workspaces (client, server, and common).

### 2. Build the common package

The common package must be built first as both client and server depend on it:

```bash
npm run build --workspace=common
```

## Running Locally

### Option 1: Run both client and server separately

**Terminal 1 - Start the server:**
```bash
npm run dev:server
```

The server will start on `http://localhost:3000`

**Terminal 2 - Start the client:**
```bash
npm run dev:client
```

The client will start on `http://localhost:5173`

### Option 2: Use npm scripts from root

```bash
# Run server
npm run dev:server

# Run client (in another terminal)
npm run dev:client
```

## Development

### Building for production

```bash
# Build everything
npm run build:all

# Or build individually
npm run build:client
npm run build:server
```

### Working with the common package

If you modify types in `/common/src`, rebuild it:

```bash
npm run build --workspace=common
```

Or run in watch mode during development:

```bash
npm run dev --workspace=common
```

### Environment Configuration

Both client and server use environment variables for configuration.

#### Client Environment Variables (`client/.env`)

```bash
VITE_SERVER_URL=ws://localhost:3000    # WebSocket server URL
VITE_ENV=development                    # Environment mode
VITE_DEBUG_FPS=true                     # Show FPS counter
VITE_DEBUG_COLLIDERS=false              # Show collision boxes (future)
VITE_DEBUG_VERBOSE=true                 # Verbose console logging
```

**Files:**
- `.env` - Development settings (git-ignored, auto-used by Vite)
- `.env.example` - Template with all available variables
- `.env.production` - Production defaults (for deployment)

#### Server Environment Variables (`server/.env`)

```bash
PORT=3000                               # Server port
NODE_ENV=development                    # Environment mode
CORS_ORIGIN=http://localhost:5173       # Allowed client origin
VERBOSE_LOGGING=true                    # Detailed server logs
```

**Files:**
- `.env` - Development settings (git-ignored, auto-loaded by dotenv)
- `.env.example` - Template with all available variables
- `.env.production` - Production defaults (for deployment)

#### Switching Environments

**Local Development** (default):
- Client connects to `ws://localhost:3000`
- Server accepts requests from `http://localhost:5173`
- Debug features enabled

**Production**:
1. Update `client/.env.production` with your production server URL
2. Update `server/.env.production` with your production client URL
3. Build with `npm run build:all`
4. Deploy client and server to their respective hosts

**Testing Production Locally:**
```bash
# Server: Create .env.production.local
PORT=3000
NODE_ENV=production
CORS_ORIGIN=http://localhost:4173
VERBOSE_LOGGING=false

# Client: Build and preview
npm run build --workspace=client
npm run preview --workspace=client  # Runs on port 4173
```

## Connecting Client to Server

By default:
- **Client**: `http://localhost:5173`
- **Server**: `http://localhost:3000` (WebSocket at `ws://localhost:3000`)

The client will connect to the server via WebSocket using the URL specified in `VITE_SERVER_URL`.

## Troubleshooting

### "Cannot find module '@air-clash/common'"

Make sure you've built the common package:
```bash
npm run build --workspace=common
```

### Port already in use

Change the port in:
- **Server**: Edit `PORT` environment variable or modify `server/src/index.ts`
- **Client**: Edit `client/vite.config.ts`

### Dependencies not installing

Try clearing node_modules and reinstalling:
```bash
rm -rf node_modules client/node_modules server/node_modules common/node_modules
npm install
```

## Next Steps

See `memory-bank/implementation-plan.md` for the full MVP implementation roadmap.
