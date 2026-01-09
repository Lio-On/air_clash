# Project Air Clash - Game Design Document

## 1. High-Level Overview
**Project Air Clash** is a fast-paced multiplayer airplane dogfight game set above a small island. Two teams (Red vs Blue), up to 5 vs 5, battle for air superiority using WWII-era fighter planes. The game focuses on skill-based aerial combat, realistic shooting physics, and clean, minimalistic visuals.

Players join a lobby, select a pilot name, choose a team, and ready up. Missing players are filled with AI bots. Once all slots are filled, a countdown begins and the battle starts.

## 2. Design Pillars
*   **Simple to Learn, Hard to Master**: Intuitive controls but deep combat mechanics.
*   **Skill-Based Combat**: Victory depends on maneuvering and aim, not stats.
*   **Clean & Readable Visuals**: Immediate clarity on who is friend or foe.
*   **Short, Intense Matches**: 3-6 minute rounds perfect for quick sessions.
*   **Multiplayer-First, Bots as Support**: Always a full match, even with low player counts.
*   **Simplified Physics**: Fun over absolute realism (constant forward motion, forgiving stalls).

## 3. Target Platform
*   **Primary**: Web (Desktop & Mobile browsers) via HTML5/WebGL.
*   **Secondary**: Desktop (Electron/Steam) as a future expansion.

## 4. Player Experience Goals
*   **Speed**: Jump into a match in under 30 seconds.
*   **Clarity**: Immediate visual recognition of enemies vs allies.
*   **Feedback**: Satisfying audio-visual feedback for hits and kills.
*   **Flow**: Continuous action with minimal downtime between matches.

## 5. Core Game Loop
1.  **Lobby**: Enter Pilot Name -> Choose Team -> Ready Up.
2.  **Fill**: Empty slots auto-filled with bots.
3.  **Start**: 5-second countdown -> Teams spawn.
4.  **Combat**: Aerial dogfights -> Destroy enemies.
5.  **End**: Last team standing wins -> Results Screen -> Return to Lobby.

## 6. Game Modes (MVP)
### 6.1 Standard Battle (5v5)
*   **Type**: Team Deathmatch (Elimination).
*   **Capacity**: 10 Players (Mixed human/bot).
*   **Winning Condition**: Last team with planes remaining.

## 7. World & Environment
### 7.1 Map: "Island Airspace"
*   **Bounds**: Circular or square arena with soft boundaries (fog/warning).
*   **Terrain**: Visual-only island below. Water collision = Destruction.
*   **Atmosphere**: Bright day, specific sun position for lighting, non-obtrusive clouds for altitude reference.

## 8. Aircraft
### 8.1 Classes
| Plane | Role | Characteristics |
| :--- | :--- | :--- |
| **Hellcat** | Balanced | Stable, good armor, forgiving handling. |
| **Zero** | Agile | Tight turn radius, fragile, high skill ceiling. |

*Note: Differences are balanced by physics/handling, not RPG stats.*

## 9. Flight Model
**Simplified Realism**:
*   **Constant Forward Motion**: No stopping mid-air.
*   **Throttle**: Controls speed (trade-off with turning tightness).
*   **Energy Management**: Diving gains speed; climbing loses speed.
*   **Stalls**: Loss of control at critically low speeds (forgiving recovery).

## 10. Controls
### 10.1 Desktop (Mouse & Keyboard)
*   **Mouse**: Pitch/Yaw (Aiming).
*   **W/S**: Throttle Control.
*   **A/D**: Roll (essential for tight turns).
*   **Space / Click**: Fire.

### 10.2 Mobile (Touch)
*   **Left Stick**: Virtual Joystick for movement.
*   **Right Side**: Drag to aim/fine-tune.
*   **Button**: Fire.
*   **Assists**: Auto-leveling when not inputting.

## 11. Combat System
### 11.1 Weapons
*   **Type**: Fixed forward-firing machine guns.
*   **System**: Overheat or limited ammo with reload timer. No lock-on missiles.

### 11.2 Ballistics
*   **Projectile-based**: Bullets have travel time and drop.
*   **Deflection Shooting**: Players must "lead" their targets.
*   **Damage**: Based on proximity and angle (glancing hits deal less).

### 11.3 Health & Damage
*   **Visual Damage**: Smoke trails at <50% HP, Fire at <20% HP.
*   **Criticals**: Rare chance for engine/wing damage affecting performance.
*   **Death**: Spectacular explosion and immediate transition to Spectator.

## 12. Bots (AI)
*   **Goal**: Fill servers and provide target practice.
*   **Behavior**:
    *   Patrol center when idle.
    *   Engage nearest threat within range.
    *   "Intentional Error": Aim is imperfect to allow player evasion.

## 13. Match Flow & UI
### 13.1 HUD
*   Minimalistic design.
*   **Center**: Crosshair + Lead Indicator (optional, maybe distinct for arcade feel).
*   **Corners**: Vital stats (Speed, Alt, Ammo, HP) and Team Lives count.
*   **Indicators**: Off-screen enemy pointers.

### 13.2 Spectator Mode
*   **Trigger**: On death.
*   **Behavior**: Auto-follow nearest living teammate.
*   **Controls**: Cycle targets (Q/E or Arrows).
*   **Utility**: Keeps player engaged until the round ends.

## 14. Art Style
*   **Aesthetic**: "Low Poly" or "Flat Shaded". Vibrant colors.
*   **Readability**: High contrast. Red planes vs Blue planes.
*   **VFX**: Stylized muzzle flashes, tracers, and fluffy explosions.

## 15. Technical Stack
(See `tech-stack.md` for full implementation details)

*   **Frontend**: Babylon.js + Vite (TypeScript).
*   **Backend**: Node.js + Colyseus (Authoritative Server).
*   **Architecture**: Authoritative Server with Client-side Prediction and Interpolation.
*   **Language**: TypeScript (Monorepo with shared types).

## 16. Networking Strategy
*   **Architecture**: Authoritative Server.
*   **Client**: Client-side prediction for immediate input response.
*   **Server**: Validates positions and hits (prevents basic cheating).
*   **Interpolation**: Smooths out movement of other players.

## 17. Success Metrics
*   **Performance**: 60 FPS on mid-range devices.
*   **Network**: Playable up to 150ms ping.
*   **Fun**: Players return for "one more round".

## 18. Future Roadmap (Post-MVP)
*   **Progression**: Pilot ranks, skins.
*   **Modes**: Capture the Flag, Battle Royale (Circle closing).
*   **Social**: Squads, Friends list.
