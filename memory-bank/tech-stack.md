# Air Clash - Technical Stack

## Overview
This document outlines the chosen technical stack for **Project Air Clash**, focusing on a robust, mobile-friendly web multiplayer experience. The stack is selected to maximize iteration speed, performance, and "fun" factor while keeping the architecture simple.

## 1. Core Stack
| Component | Technology | Rationale |
| :--- | :--- | :--- |
| **Language** | **TypeScript** | Shared types between Client and Server (Single Source of Truth). |
| **Build Tool** | **Vite** | Fast development server, optimized builds for modern web. |
| **Monorepo** | **NPM Workspaces** | Simple code sharing (e.g., `common` folder for packets/types). |

## 2. Client (Mobile/Web)
### **Engine: Babylon.js**
*   **Why**: Full-featured 3D engine with excellent "out-of-the-box" camera systems and collision support.
*   **Camera**: `FollowCamera` or `ArcFollowCamera` (Third-person chase).
    *   *Config*: Slight spring smoothing for a cinematic "AAA" feel.
*   **Rendering**: WebGL2 (falling back to WebGL1).

### **Input Handling**
*   **Mobile**: Virtual Joystick (Left Thumb) + Touch Drag (Right Thumb).
*   **Desktop**: Keyboard + Mouse (as fallback/dev testing).

## 3. Server (Multiplayer)
### **Framework: Colyseus** (running on Node.js)
*   **Role**: Authoritative Game Server.
*   **Why**: Built-in state synchronization (Schema), room management, and matchmaking.
*   **Protocol**: WebSockets (TCP) / UDP (optional via Geckos.io if needed later, but TCP is fine for MVP).

### **Architecture**
*   **Authoritative Simulation**:
    *   Client sends **Inputs** (Throttle, Pitch, Roll, Fire).
    *   Server runs **Physics Loop** (at 30Hz or 60Hz).
    *   Server broadcasts **State Snapshots** (Position, Rotation, Velocity).
*   **Lag Compensation**:
    *   **Interpolation**: Clients smooth out remote entities by buffering snapshots (approx 100-150ms delay).
    *   **Prediction**: Local client predicts its own movement immediately, reconciling with server corrections.

## 4. MVP Network Settings
To ensure a smooth experience on mobile networks:
*   **Server Tick Rate**: 30 Hz (Good balance for CPU/Bandwidth).
*   **Snapshot Rate**: 15 Hz (Interpolated on client).
*   **Interpolation Buffer**: ~120ms.

## 5. Deployment Strategy (MVP)
*   **Web First**: Deploy to a static host (Vercel/Netlify for client) + PaaS (Render/Railway for server).
*   **Mobile App**: Optional future wrap via Capacitor.

## 6. Development Priorities
1.  **Shared Codebase**: Setup `client`, `server`, and `common` packages.
2.  **Basic Flight**: Implement Babylon.js flight physics on client (then move logic to server).
3.  **Sync**: Connect Colyseus, send inputs, sync positions.
4.  **Polish**: Add shooting and smoothing.
