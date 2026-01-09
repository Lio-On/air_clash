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

## Connecting Client to Server

By default:
- **Client**: `http://localhost:5173`
- **Server**: `http://localhost:3000`

The client will connect to the server via WebSocket. Server configuration will be added in future steps.

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
