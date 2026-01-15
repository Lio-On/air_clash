# Player Name Tags Implementation

To show player names above planes, we need to use Babylon.js GUI system.

## 1. Prerequisites (Install this first!)
Since we don't have the GUI package yet, you must install it in the client folder:
```bash
cd client
npm install @babylonjs/gui
```

## 2. Implementation Prompt for Claude Code
Use the following prompt to implement the feature:

---
**Prompt:**

I need to implement "Player Name Tags" that float above each airplane in the game `client/src/main.ts`.

**Context:**
- The server already syncs the `name` property in `PlayerState`.
- I have just installed `@babylonjs/gui`.

**Requirements:**
1.  **Import GUI:** Add `import * as GUI from '@babylonjs/gui';` to `client/src/main.ts`.
2.  **Update `createAirplaneMesh`:**
    - Update the function signature to accept `name: string` as an argument.
    - Inside the function, create a 3D UI Plane attached to the airplane mesh.
    - Use `GUI.AdvancedDynamicTexture.CreateForMesh(airplane)` to create a billboard texture. (Make it appropriate size, e.g., 1024x256).
    - Add a `GUI.TextBlock` with the `name`.
    - **Styling:**
        - White text with a black outline (stroke) for visibility against the sky.
        - Font size should be large enough to be readable.
        - Position it slightly above the plane (`uiPlane.position.y = 5` or similar).
3.  **Update `updatePlayerMeshes`:**
    - When calling `this.createAirplaneMesh(...)`, pass `player.name` from the state.
    - Ensure that if a name changes (unlikely during match, but possible), the label updates (optional, but creation is critical).

**Technical Tip:**
- Use `CreateForMesh` to automatically handle billboarding (text always faces the camera).
- Ensure the texture prevents z-fighting or lighting issues (set `hasAlpha = true`).
---
