# Implementation Plan (MVP) — Project Sky Clash
Target: Mobile/tablet-first web game
Stack: TypeScript + Vite + Babylon.js (client) + Colyseus (Node/TS server)
Goal: Deliver a playable 5v5 (players + bots) dogfight match on one island map with spectator mode (Option A)

## Key Implementation Decisions
- **Project Structure**: 3-package monorepo (`/client`, `/server`, `/common`) using NPM Workspaces
- **Physics**: Use Cannon.js for server-side flight simulation
- **Controls**: Roll + Pitch on left virtual joystick
- **Disconnect Handling**: Convert disconnected players into bots that take over their plane
- **Team Balancing**: Bots auto-fill to maintain exactly 5v5
- **Spectator Mode**: Cycle only through alive **teammates** (not enemies)
- **Plane Models**: Simple low-poly WWII fighter assets (search for free models)
- **Spawn Protection**: 2-second invulnerability with soft blinking visual effect
- **Collision Volumes**: Capsule-shaped hitboxes for planes
- **Bot Difficulty**: Single fixed difficulty tuned for average players
- **Hosting**: Vercel/Netlify (client), Railway/Render (server) - prioritize free/cheap tiers

## 0) Definition of Done (MVP)
A build is MVP-complete when:
- Players can open a URL on mobile/tablet/desktop and join a lobby
- Players can enter Pilot Name, select Pilot/Team, set Ready
- Lobby fills to 5v5 with bots, then starts a 5-second countdown
- Match starts with teams spawning on opposite sides of the island
- Players can fly, shoot projectiles, take damage, and be destroyed
- One team wins when the other is eliminated
- Dead players automatically spectate a living teammate and can cycle targets
- Basic stability: no crashes, no stuck lobbies, no infinite countdown loops

## 1) Project Setup & Workflow
### Step 1.1 — Create repository structure
**Instructions**
- Create a mono-repo with three top-level folders using NPM Workspaces:
    - `/client` (Babylon.js web app)
    - `/server` (Colyseus authoritative multiplayer)
    - `/common` (Shared TypeScript types, interfaces, and constants)
- Add a top-level README.md with:
    - how to run client + server locally
    - required Node version
    - how to connect client to server
**Test**
- A new developer can run one command per folder and see:
    - Client loads in browser
    - Server starts and logs that it's listening
    - Common package can be imported by both client and server

### Step 1.2 — Add “MVP config” and environment switching
**Instructions**
- Define a single source of truth for:
    - Server URL (local vs production)
    - Room name (e.g., “dogfight”)
    - Build mode flags (debug overlays on/off)
- Ensure mobile-friendly build output (minified, cache-busted assets)
**Test**
- Switching between local and production endpoints changes where the client connects (verified via logs on server)

## 2) Server Foundations (Colyseus)
### Step 2.1 — Create base Colyseus server
**Instructions**
- Create one Colyseus room type (e.g., `DogfightRoom`)
- Room must support:
    - `onCreate`: initialize room state
    - `onJoin`: add player to state
    - `onLeave`: remove player (or mark disconnected)
    - `onDispose`: cleanup
**Test**
- Using Colyseus dev tools or simple local clients:
    - Joining increases player count in server logs
    - Leaving decreases player count cleanly without errors

### Step 2.2 — Define minimal authoritative room state
**Instructions**
- Create room state fields (minimum):
    - lobby/match phase enum: `LOBBY`, `COUNTDOWN`, `IN_MATCH`, `RESULTS`
    - players list with: `id`, `name`, `team`, `ready`, `alive`, `isBot`
    - match timer fields: `countdownStart`, `matchStart`
    - team counters: `aliveRed`, `aliveBlue`
- Keep state minimal and deterministic (avoid random changes without seed)
**Test**
- Connect 2 clients and confirm:
    - Both clients see consistent team/ready/phase state values (no mismatch)

### Step 2.3 — Implement lobby actions (join, set name, choose team, ready)
**Instructions**
- Add server-validated messages:
    - set pilot name
    - choose team
    - toggle ready
- Validate constraints:
    - name not empty (trim)
    - team must be Red/Blue
    - cannot exceed 5 per team (except bots)
    - cannot change team when match already in countdown or in match
**Test**
- Try invalid inputs from client:
    - empty name rejected (client sees error or no change)
    - joining team beyond capacity rejected
    - attempting to swap teams during countdown rejected

### Step 2.4 — Fill remaining slots with bots when all humans ready
**Instructions**
- Condition to start countdown:
    - all connected human players are ready
    - at least 1 human exists
- When condition met:
    - add bot entries to reach 5v5 total
    - bots must have unique names (e.g., "BOT-1")
    - bots are assigned to teams to maintain 5 per team
    - **Example**: If 3 humans (2 Red, 1 Blue), add 3 Red bots + 4 Blue bots = 5v5
**Test**
- With 2 humans both ready:
    - room state becomes 10 total entries (2 humans + 8 bots)
    - teams become exactly 5 red, 5 blue
- With 3 humans (2 Red, 1 Blue):
    - bots fill to make it 5 Red vs 5 Blue total

### Step 2.5 — Countdown state machine (5 seconds)
**Instructions**
- Transition: `LOBBY` → `COUNTDOWN`
- Countdown lasts exactly 5 seconds (server time)
- Prevent re-entry: countdown must not restart unless room returns to lobby
- If a human disconnects during countdown:
    - MVP rule: continue countdown; convert disconnecting player's slot into a bot
    - ensure teams remain 5v5
**Test**
- Start countdown, disconnect one human:
    - countdown continues
    - match still starts 5v5 with that slot as bot

### Step 2.6 — Match start transition and spawn assignment
**Instructions**
- Transition: `COUNTDOWN` → `IN_MATCH`
- On match start, server assigns each plane:
    - spawn position based on team side (opposite sides of island)
    - initial heading toward island center
    - initial speed/throttle
- Apply short "spawn protection" (MVP: 2 seconds invulnerable)
- Add visual indicator for spawn protection (soft blinking effect on plane)
**Test**
- Start a match:
    - both teams spawn on opposite sides in consistent positions on all clients
    - no one can be damaged during first 2 seconds (verified with firing)
    - spawn-protected planes have visible soft blinking effect

## 3) Client Foundations (Babylon.js)
### Step 3.1 — Create Babylon scene + render loop
**Instructions**
- Initialize Babylon engine + scene
- Add:
    - sky/background
    - directional light
    - basic ground/island placeholder mesh (simple)
- Add a performance overlay toggle (FPS) for debugging
**Test**
- Scene renders on desktop + mobile
- FPS is visible when enabled and can be toggled off

### Step 3.2 — Implement responsive UI shell (menus + lobby)
**Instructions**
- UI screens:
    - Home/Join screen: Pilot Name input + Join button
    - Lobby screen: team selection + ready toggle + roster list
    - Match HUD: minimal counters + ammo + speed
    - Results screen: winner + return to lobby
- Ensure UI is mobile/touch friendly:
    - large buttons
    - safe margins
    - landscape orientation recommended (not forced for MVP)
**Test**
- On a mobile device (or browser mobile emulation):
    - all buttons are reachable
    - no overlapping UI
    - team selection + ready toggles update server state

### Step 3.3 — Connect client to server room
**Instructions**
- Connect to Colyseus endpoint
- Join/create a room
- Subscribe to room state updates and reflect in UI
**Test**
- Open two browsers:
    - both appear in the lobby roster
    - changes (team, ready) reflect on both clients within 1 second

## 4) Input & Controls (Mobile-first)
### Step 4.1 — Implement mobile controls (virtual joystick + fire)
**Instructions**
- Create touch controls:
    - Left virtual joystick controls **roll + pitch** for aircraft control
    - Fire button on right
    - Throttle control (two buttons up/down OR a slider)
- Add desktop controls as fallback:
    - keyboard + mouse mappings consistent with GDD
- Normalize input into a single “Input Frame” structure sent to server:
    - pitch, yaw, roll, throttle, fire (boolean)
**Test**
- On mobile:
    - moving joystick changes plane attitude (visible in camera and movement)
    - fire button triggers firing state
- On desktop:
    - keyboard controls also work without breaking touch UI

### Step 4.2 — Send input frames at fixed rate
**Instructions**
- Send input frames from client to server at a stable cadence (e.g., 30 Hz)
- Include a sequence number/timestamp for reconciliation later (even if not fully used in MVP)
**Test**
- Server logs show regular input messages
- No bursty spam or long gaps when holding controls

## 5) Plane Representation & Camera
### Step 5.1 — Create plane entity on client (visual only)
**Instructions**
- Create a lightweight plane mesh:
    - use simple low-poly plane models (search for free WWII fighter assets)
    - team coloring: red/blue materials
    - name tag over plane (optional but helpful)
- Planes are driven by server snapshots, not client authority (except optional local smoothing later)
**Test**
- When multiple clients join:
    - each sees all planes
    - team colors match server team assignment

### Step 5.2 — Implement behind-the-plane follow camera (local player)
**Instructions**
- Use a follow-style camera:
    - target local player plane
    - consistent distance and height offset
    - smooth damping (avoid motion sickness)
- Ensure camera does not clip into ground or inside plane mesh (simple minimum distance)
**Test**
- During flight:
    - camera stays behind the plane
    - rapid turns do not cause violent snapping
    - camera remains stable on mobile (no stutters)

## 6) Server-Side Flight Simulation (Authoritative)
### Step 6.1 — Implement deterministic flight update loop
**Instructions**
- On the server, run a fixed tick update (e.g., 30 Hz)
- Use a physics library (Cannon.js recommended for Node.js compatibility) for rigid body simulation
- For each active plane:
    - apply input to orientation change (pitch/yaw/roll)
    - update forward velocity based on throttle and drag
    - move plane forward based on heading and speed
- Keep physics simple and stable:
    - clamp max/min speed
    - clamp rotation rates per plane type (Hellcat vs Zero)
- Add bounds:
    - if plane leaves airspace, apply warning then force turn or soft boundary push (MVP: soft push)
**Test**
- With one player:
    - plane moves forward continuously
    - throttle changes speed
    - turning changes trajectory
- With two players:
    - movement stays consistent and doesn’t desync noticeably

### Step 6.2 — Broadcast snapshots to clients
**Instructions**
- Send periodic state snapshots containing:
    - plane position, rotation, speed
    - health, alive status
    - ammo count (if tracked server-side)
    - invulnerability flag/time remaining
- On client:
    - interpolate remote planes smoothly between snapshots
**Test**
- Two clients:
    - remote planes move smoothly (no teleporting every update)
    - packet delay simulation (browser throttling) still looks acceptable

## 7) Weapons & Projectiles (MVP “feels realistic”)
### Step 7.1 — Implement server-authoritative projectile spawning
**Instructions**
- When input fire=true:
    - server spawns bullets at gun points (or a single center gun for MVP)
    - bullets have speed, lifetime, and direction based on plane orientation
- Rate of fire:
    - consistent (e.g., X bullets/sec)
    - enforce on server (ignore client spam)
- Include bullet travel time (not hitscan)
**Test**
- Holding fire produces a consistent stream
- Firing rate remains stable even at low FPS clients

### Step 7.2 — Implement collision/hit detection on server
**Instructions**
- Use simplified collision volumes:
    - **capsule** around plane (better fits aircraft shape)
    - bullet as point or small sphere
- On collision:
    - apply damage (distance falloff optional; can be phase 1.5)
    - ignore hits if invulnerable timer active
- On 0 health:
    - set alive=false
    - mark plane destroyed
    - trigger spectator mode for that player (state change)
**Test**
- In a test match:
    - bullets can hit and reduce health
    - invulnerability prevents damage right after spawn
    - destruction sets alive=false and stops plane from firing/moving

## 8) Bots (Minimum viable AI)
### Step 8.1 — Implement basic bot controller on server
**Instructions**
- Bots generate their own input frames server-side (do not fake client connections)
- Bot logic (MVP - fixed difficulty tuned for average players):
    - pick nearest enemy target
    - steer toward target with imperfect aim (add small randomness)
    - fire when target is within distance and roughly in front
    - avoid boundaries (turn inward)
    - tune difficulty to challenge average players (not too easy, not too hard)
**Test**
- With 1 human + 9 bots:
    - bots move, engage, and shoot
    - bots do not freeze or fly away forever
    - match can end without human input (bots can win/lose)

## 9) Match Rules & Win Condition
### Step 9.1 — Track alive counts and end match
**Instructions**
- Server maintains alive counts per team
- When a team alive count reaches 0:
    - transition `IN_MATCH` → `RESULTS`
    - store winner team and end timestamp
- After short delay (e.g., 5 seconds):
    - return to `LOBBY`
    - clear bots
    - reset readiness and plane states
**Test**
- Force-kill all planes of one team:
    - results appear for all clients
    - after delay, lobby resets cleanly with humans still connected

## 10) Spectator Mode (Option A)
### Step 10.1 — Implement spectator state on server
**Instructions**
- On death:
    - set player state `SPECTATOR`
    - assign `spectateTargetId` to an alive **teammate only** (same team)
    - if no teammate alive, keep spectating last target or show "No teammates alive"
- If target dies/disconnects:
    - reassign automatically to another alive teammate
**Test**
- Kill a player:
    - their state becomes spectator
    - server assigns a valid spectate target that is alive

### Step 10.2 — Implement spectator camera behavior on client
**Instructions**
- If local player is spectator:
    - camera follows `spectateTargetId` plane
    - show "SPECTATING: Name"
- Add cycle controls:
    - desktop: Q/E
    - mobile: Prev/Next buttons
- Cycling sends a request to server, server validates and updates `spectateTargetId`
- **Spectating only cycles through alive teammates** (same team)
**Test**
- Die in match:
    - camera immediately attaches to teammate
    - cycling changes the viewed plane to other teammates only
    - cycling skips dead planes and never shows enemies

## 11) Performance & Mobile Hardening
### Step 11.1 — Add mobile performance defaults
**Instructions**
- Keep geometry low-poly
- Limit particle effects (MVP: minimal smoke/explosion)
- Cap bullet count via lifetime + max active bullets per plane
- Use simple materials (avoid heavy shaders)
**Test**
- On mid-range tablet/phone:
    - game remains playable without crashing
    - no runaway memory growth during a 5-minute match

### Step 11.2 — Add disconnect & reconnect handling (minimal)
**Instructions**
- If a human disconnects mid-match:
    - **convert their slot into a bot** that takes over their plane position and continues playing
    - maintain 5v5 team balance
- Client detects disconnect and shows a "Reconnecting…" overlay (MVP: retry join)
**Test**
- Turn off Wi-Fi mid-match:
    - client shows reconnect state
    - server continues match without breaking
    - reconnect returns user to lobby (acceptable for MVP)

## 12) Packaging & Deployment
### Step 12.1 — Production build for client
**Instructions**
- Ensure client builds into static assets
- Ensure server URL is correct for production
- Add cache-busting filenames
**Test**
- Build locally and serve static files:
    - game loads correctly
    - connects to server
    - no missing assets

### Step 12.2 — Deploy server + client
**Instructions**
- Deploy client to a static host (recommended: **Vercel** or **Netlify** - both have free tiers)
- Deploy server to a Node host with WebSocket support (recommended: **Railway** or **Render** - both offer free/cheap tiers)
- Confirm CORS / secure WebSocket (wss) works on mobile networks
**Test**
- Two real devices on different networks can:
    - join same room
    - start a match
    - fly and shoot with stable updates

## 13) MVP Acceptance Test Checklist (Final)
Run this checklist before calling MVP “done”:
1. **Lobby**: Names, teams, ready work. Bots fill to 5v5.
2. **Countdown**: Always 5 seconds, never loops.
3. **Match**: Opposite-side spawns. Flight controls responsive. Shooting works.
4. **Damage**: Bullets collide, health decreases, death triggers.
5. **Win condition**: Match ends when one team eliminated.
6. **Spectator**: Dead player auto-spectates teammate. Can cycle targets.
7. **Stability**: Disconnect doesn’t crash room. Return to lobby resets state.
