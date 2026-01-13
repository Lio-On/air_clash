# Realistic Plane Crash Mechanics - Implementation Requirements

**Objective**: Replace the current "instant disappearance" upon death with a realistic engaging crash sequence. When a plane is hit (fatal damage) or collides, it should spiral/fall to the ground with smoke effects before finally exploding on impact.

## 1. Conceptual Overview
- **Current Behavior**: Player HP <= 0 -> `alive = false` -> Plane disappears immediately.
- **New Behavior**: Player HP <= 0 -> `isCrashing = true` (still `alive`) -> Plane loses control, emits smoke, falls due to gravity -> Hits Ground -> `alive = false` -> Explosion & Respawn logic.

## 2. Server-Side Implementation

### A. Shared Types (`common/src/index.ts`)
- Update `PlayerState` interface to include `isCrashing: boolean`.
- Alternatively, introduce a `PlayerStatus` enum if you prefer a stricter state machine.

### B. Schema Update (`server/src/schemas/PlayerState.ts`)
- Add `@type("boolean") isCrashing: boolean = false;` to the `PlayerState` schema.

### C. Physics Updates for `CRASHING` Planes (`server/src/rooms/DogfightRoom.ts`)
In the `updatePhysics` method:
1.  **Check Status**: Iterate players. If `player.isCrashing`:
2.  **Disable Input**: Ignore user inputs (throttle, pitch, roll).
3.  **Force Trajectory**:
    - **Gravity**: Apply stronger downward acceleration.
    - **Pitch**: Interpolate `rotation.x` towards a dive (e.g., -80 to -90 degrees).
    - **Roll**: Apply constant roll to simulate loss of control (spin).
    - **Velocity**: Damping x/z velocity, ensuring y velocity increases downwards.
4.  **Ground Collision**:
    - Use `getTerrainHeight(x, z)` (from `common/src/terrain.ts`) to check for impact.
    - If `y <= terrainHeight`:
        - Set `alive = false` (triggers current death logic).
        - Set `isCrashing = false`.
        - Broadcast/Spawn explosion effect.

### D. Damage Handler
In the damage/collision logic:
- If `health <= 0`:
    - **Do NOT** set `alive = false`.
    - Set `isCrashing = true`.
    - Set `health = 0`.
    - Ensure invulnerability to further damage while crashing?

## 3. Client-Side Implementation (`client/src/main.ts`)

### A. Visual Effects (Smoke)
- Watch for changes in `player.isCrashing`.
- **Smoke System**:
    - When `isCrashing` becomes `true`, attach a particle system to the plane mesh.
    - **Style**: Dark grey smoke, high emission, trailing behind.
    - Use Babylon.js `ParticleSystem` or `GPUParticleSystem`.
- **Cleanup**: When `alive` becomes `false` (impact), stop/dispose the smoke particles immediately.

### B. Rendering
- Interpolation should naturally handle the crashing movement since the server updates position/rotation.
- Ensure the specific "death spiral" rotation looks smooth.

### C. Transition to Dead
- Existing logic for `alive = false` should handle the explosion and hiding the mesh.

## 4. Prompt for Code Generation

```markdown
**Task**: Implement realistic plane crash mechanics with "death spiral" and smoke.

**Context**: 
Currently, planes disappear instantly when health hits 0. We want a cinematic crash sequence where the plane loses control, smokes, and falls to the ground before exploding.

**Files to Modify**:
1.  `common/src/index.ts`: Add `isCrashing` to `PlayerState` interface.
2.  `server/src/schemas/PlayerState.ts`: Add `isCrashing` schema field.
3.  `server/src/rooms/DogfightRoom.ts`:
    - In `updatePhysics`: Add logic to handle `isCrashing` players (gravity, forced dive pitch, spin, ground collision check).
    - In damage logic: Set `isCrashing = true` instead of `alive = false` when HP <= 0.
4.  `client/src/main.ts`:
    - Add particle smoke effect when `isCrashing` is true.
    - Ensure smoke is removed when plane dies (hits ground).

**Requirements**:
- **Physics**: The crash should look like a loss of lift/control. Nose dives down, plane spins.
- **Visuals**: Dense black smoke trail.
- **Termination**: The plane only "dies" (disappears/explodes) when it physically hits the terrain height.
```
