# Map Enhancements Request

**Goal:** Create a 3D island terrain with a large central mountain (800m high) and 4 smaller surrounding mountains, plus a river/lake and trees.

**Key Requirement:** The server calculates physics and collisions, so terrain height logic must be shared or synchronized between Client (visuals) and Server (physics).

## 1. Shared Terrain Logic (Crucial)

Create a shared utility function (e.g., in a new file `common/src/terrain.ts` or `server/src/utils/terrain.ts` if you can't touch common) that calculates height at any (x, z) coordinate.

**Function signature:** `getTerrainHeight(x: number, z: number): number`

**Math Implementation:**
- **Central Mountain**: Use a Gaussian or Cosine function centered at (0,0).
  - Peak: 800m
  - Radius: ~1000m
- **4 Smaller Mountains**: Use smaller peaks offset from center (e.g., at 600m distance in 4 directions).
  - Peak: ~300-500m
  - Radius: ~400m
- **Formula**: `Height = max(Central, Small1, Small2, Small3, Small4)` or `sum` combined with clamping.
- **Water/River**: Subtract from height or define a `WATER_LEVEL` (e.g., 50m).

## 2. Server Implementation (`DogfightRoom.ts`)

- **Import** `getTerrainHeight`.
- **Update Physics Loop**: 
  - Instead of `if (player.posY <= 0)`, check `if (player.posY <= getTerrainHeight(player.posX, player.posZ))`.
  - Collision logic remains the same (crash on impact).

## 3. Client Implementation (`main.ts`)

- **Visual Terrain**:
  - Instead of `MeshBuilder.CreateDisc`, use `MeshBuilder.CreateGroundFromHeightMap` (if you have a texture) OR `MeshBuilder.CreateGround` with `updatable: true`.
  - **Procedural Mesh**: Create a high-resolution ground mesh (e.g., 128x128 subdivisions). Loop through its vertices and set their `y` coordinate using the **same** `getTerrainHeight(x, z)` function.
  - **Material**: Use a mix of textures (grass for low, rock for high) if possible, or simple colors based on height.
- **Water**:
  - Add a large blue plane at `y = WATER_LEVEL`.
  - Ensure the terrain dips below this level in some areas (e.g., ring around center) to create a "river" or lake.
- **Trees**:
  - Create a simple low-poly tree mesh (cylinder + cone).
  - Use `SolidParticleSystem` or Instances for performance.
  - Scatter them on the terrain where `height > WATER_LEVEL` and `height < SNOW_LEVEL`.

## 4. Verification

- **Test**: Fly into the big mountain.
- **Expected**: Plane explodes/crashes when hitting the *visual* mountain slope, not just at y=0.
- **Test**: Fly over the river.
- **Expected**: Visual river exists, and you can crash into the water surface.
