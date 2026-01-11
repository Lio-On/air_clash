# Plane-to-Plane Collision Implementation Requirements

**Context:** The goal is to enforce that when two planes collide in mid-air, both are destroyed.

**Implementation Instructions for `server/src/rooms/DogfightRoom.ts`:**

1.  **Locate Physics Loop**: Inside the `updatePhysics(deltaTime)` method.
2.  **Collision Logic**:
    - Iterate through all unique pairs of players (`i` from 0 to N, `j` from `i+1` to N).
    - Skip any players who are already dead (`!alive`) or invulnerable (`invulnerable`).
    - Calculate the squared 3D distance between the two players (`distSq`).
    - Define a `COLLISION_RADIUS` (e.g., 15 meters) and check if `distSq < (COLLISION_RADIUS * 2)^2`.
3.  **On Collision**:
    - Mark **BOTH** players as dead: `player1.alive = false; player2.alive = false;`.
    - Log the event: `console.log("💥 MIDAIR CRASH: " + p1.name + " collided with " + p2.name);`.
    - Broadcast the event to clients (optional but recommended): `this.broadcast("message", ...);`.
    - Ensure `updateAliveCounts()` is triggered to check for match end conditions.

**Verification:**
- Fly two planes into each other.
- Verify both disappear (client-side) and match stats update (server-side).
