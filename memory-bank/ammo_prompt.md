# Ammo System Implementation Requirements

**Context:** Limit player ammunition to 200 rounds. Shooting consumes 1 round. When ammo reaches 0, the player cannot shoot. The HUD must display the remaining ammo.

## 1. Server-Side Changes

### `server/src/schemas/PlayerState.ts`
- **Add Field**: Add a new synchronized field `ammo` of type `number`.
- **Initialization**: Initialize `ammo` to `200` in the constructor. (Or a constant `CONFIG.MAX_AMMO` if preferred, but 200 is sufficient).

### `server/src/rooms/DogfightRoom.ts`
- **Logic in `spawnProjectile` or `playerInput` handler**:
  - Before spawning a projectile, check: `if (player.ammo > 0)`.
  - If true: 
    - Decrement ammo: `player.ammo -= 1;`
    - Proceed with spawning the projectile.
  - If false:
    - Do nothing (prevent shooting).
    - Optional: Send a "no ammo" error message or play a click sound (not strictly required by MVP but good for UX).

## 2. Client-Side Changes

### `client/src/main.ts`
- **HUD Update**: Locate where `this.ui.updateHUD(...)` is called.
- **Pass Real Ammo**: Currently, the ammo value is hardcoded (likely `100`). Change this to pass `localPlayer.ammo`.
- **Continuous Updates**: Ensure `updateHUD` is called continuously (e.g., in the render loop or on every state change) so the player sees the ammo count decrease as they shoot. 
  - *Recommendation*: Add `this.ui.updateHUD(...)` to the `runRenderLoop` callback if it's not already updating frequently enough.

## Verification
- **Test**: Start the game.
- **Visual**: Verify HUD shows "200" ammo initially.
- **Action**: Shoot projectiles.
- **Observation**: Verify HUD counter decreases by 1 with each shot.
- **Limit**: Shoot 200 times. Verify that at 0, pressing shoot does nothing (no projectile spawns).
