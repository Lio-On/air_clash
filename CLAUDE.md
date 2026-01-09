# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Air Clash** is a fast-paced multiplayer airplane dogfight game (5v5 team deathmatch) featuring WWII-era fighter planes in web browsers. The game emphasizes skill-based aerial combat with simplified physics and clean, minimalistic visuals.

## Architecture

### Monorepo Structure
The project uses **NPM Workspaces** with a three-package structure:
- **`client/`**: Babylon.js-based 3D client (WebGL, TypeScript, Vite)
- **`server/`**: Colyseus authoritative game server (Node.js, TypeScript)
- **`common/`**: Shared TypeScript types, interfaces, and constants used by both client and server

### Network Architecture
- **Authoritative Server**: All game logic and physics simulation runs server-side
- **Client-Side Prediction**: Local player movement is predicted immediately for responsive controls
- **Interpolation**: Remote entities are smoothed using ~120ms buffered snapshots
- **Input Protocol**: Clients send inputs (Throttle, Pitch, Roll, Fire); server broadcasts state snapshots (Position, Rotation, Velocity)
- **Server Tick Rate**: 30 Hz for physics simulation
- **Snapshot Rate**: 15 Hz for state broadcasts

### Technology Choices
- **3D Engine**: Babylon.js with `FollowCamera` or `ArcFollowCamera` for third-person chase view
- **Multiplayer**: Colyseus framework with Schema-based state synchronization
- **Language**: TypeScript throughout (shared types between client/server)
- **Build**: Vite for fast development and optimized production builds

## Game Mechanics

### Flight Model
- **Constant forward motion**: Planes cannot stop mid-air
- **Energy management**: Diving gains speed, climbing loses speed
- **Throttle affects turn radius**: Slower = tighter turns
- **Forgiving stalls**: Loss of control at low speed but easy recovery

### Combat
- **Projectile-based ballistics**: Bullets have travel time and drop (no hitscan)
- **Deflection shooting**: Players must lead moving targets
- **Visual damage states**: Smoke <50% HP, Fire <20% HP
- **Health system**: Damage based on hit proximity and angle

### Aircraft Types
- **Hellcat**: Balanced, stable, good armor, forgiving handling
- **Zero**: Agile, tight turns, fragile, high skill ceiling

Differences are implemented through physics/handling parameters, not RPG-style stats.

## Development Workflow

### Planned Package Structure
When implementing, maintain strict separation:
- Place network message schemas and shared game constants in `common/`
- Keep rendering, input handling, and client prediction in `client/`
- Keep authoritative physics, hit validation, and AI bots in `server/`

### Network Sync Pattern
1. Client captures input state each frame
2. Client sends input packets to server via WebSocket
3. Server simulates physics at 30 Hz using received inputs
4. Server broadcasts state snapshots at 15 Hz
5. Client interpolates remote entities, reconciles local prediction

### Performance Targets
- **60 FPS** on mid-range devices
- **Playable up to 150ms ping**
- Mobile-first optimization (touch controls, virtual joystick)

## Key Design Constraints

- **Match duration**: 3-6 minute rounds
- **Player capacity**: 5v5 (10 total, human + AI bots)
- **Map bounds**: Circular/square arena with soft boundaries
- **Water collision = instant destruction**
- **Spectator mode**: Auto-follow teammate on death, cycle with Q/E

## Art & UX Principles

- **High contrast team colors**: Red vs Blue for instant readability
- **Low poly / flat shaded aesthetic**: Clean, vibrant visuals
- **Minimalistic HUD**: Crosshair, vital stats (Speed/Alt/Ammo/HP), off-screen enemy indicators
- **No lock-on missiles**: Skill-based manual aiming only
