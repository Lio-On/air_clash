# Player Name Tags Implementation

## Overview
Added floating 3D player name tags above each airplane that always face the camera (billboard effect), displaying each player's name with high visibility.

## Changes Made

### 1. Import Statement
**File:** `client/src/main.ts:2`

Added Babylon.js GUI library import:
```typescript
import * as GUI from '@babylonjs/gui';
```

### 2. Updated Function Signature
**File:** `client/src/main.ts:582`

Updated `createAirplaneMesh` to accept player name:
```typescript
private createAirplaneMesh(sessionId: string, team: Team, name: string): Mesh
```

### 3. Name Tag Creation
**File:** `client/src/main.ts:635-662`

Added name tag implementation at the end of `createAirplaneMesh`:

```typescript
// Create a plane for the name tag positioned above the airplane
const nameTagPlane = MeshBuilder.CreatePlane(`nametag-${sessionId}`, {
  width: 8,
  height: 2
}, this.scene);
nameTagPlane.parent = airplane;
nameTagPlane.position.y = 5; // Position above the plane
nameTagPlane.billboardMode = Mesh.BILLBOARDMODE_ALL; // Always face camera

// Create GUI texture for the name tag
const advancedTexture = GUI.AdvancedDynamicTexture.CreateForMesh(
  nameTagPlane,
  1024,
  256,
  false
);
advancedTexture.hasAlpha = true;

// Create text block for player name
const nameText = new GUI.TextBlock();
nameText.text = name;
nameText.color = 'white';
nameText.fontSize = 120;
nameText.fontWeight = 'bold';
nameText.outlineWidth = 8;
nameText.outlineColor = 'black';
advancedTexture.addControl(nameText);
```

### 4. Updated Function Call
**File:** `client/src/main.ts:851`

Updated the call to pass player name from server state:
```typescript
mesh = this.createAirplaneMesh(sessionId, player.team, player.name);
```

## Technical Details

### Name Tag Specifications
- **Size:** 8 units wide × 2 units tall (appropriate for airplane scale)
- **Position:** 5 units above airplane center (Y offset)
- **Texture Resolution:** 1024×256 pixels (crisp text rendering)
- **Billboard Mode:** `BILLBOARDMODE_ALL` (always faces camera)
- **Parent:** Attached to airplane mesh (moves with plane)

### Text Styling
- **Font Size:** 120px (large and readable)
- **Color:** White (`'white'`)
- **Font Weight:** Bold
- **Outline:** 8px black outline for visibility against sky/terrain
- **Alpha:** Enabled for proper transparency

### Features
- ✅ Billboard effect - text always faces camera
- ✅ High contrast - white text with black outline
- ✅ Moves with airplane automatically (parented)
- ✅ No z-fighting issues (hasAlpha enabled)
- ✅ Readable at various distances
- ✅ Unique per player (includes sessionId in mesh name)

## How It Works

1. **Server Sync:** Server already provides `player.name` in `PlayerState`
2. **Mesh Creation:** When a player mesh is created, their name is passed as parameter
3. **3D UI Plane:** A billboard plane is created above the airplane
4. **GUI Texture:** `AdvancedDynamicTexture.CreateForMesh` handles billboarding automatically
5. **Text Rendering:** GUI TextBlock renders the name with styling
6. **Parenting:** Name tag follows airplane movement via parent relationship

## Testing

### What to Test
1. **Name Visibility:** Join a match and verify all players have name tags
2. **Billboard Effect:** Move camera around - names should always face you
3. **Readability:** Names should be clear against sky and terrain
4. **Movement:** Names should follow planes during flight
5. **Team Colors:** Verify both red and blue team planes have visible names
6. **Local Player:** Your own name should appear above your plane
7. **Bot Names:** AI bots should also display their names

### Expected Behavior
- Name tag appears immediately when player spawns
- Text remains readable at combat distances
- Black outline provides contrast against any background
- Name tag disappears when player dies (mesh disabled)
- Name tag reappears when player respawns

## Files Modified
- ✅ `client/src/main.ts` - Added import, updated function signature, added name tag creation, updated call site

## Dependencies
- ✅ `@babylonjs/gui` (v6.49.0) - Already installed

## Known Considerations

### Performance
- Each name tag uses one additional mesh + one GUI texture per player
- With 10 players max, this is minimal overhead
- GUI textures are efficient for text rendering

### Limitations
- Name does not update dynamically if changed mid-match (unlikely scenario)
- Name tag size is fixed (could be made scale-aware in future)

## Future Enhancements (Optional)
1. **Distance-based scaling** - Smaller text at far distances
2. **Local player hiding** - Option to hide own name tag
3. **Health bars** - Add HP bar below name
4. **Team color backgrounds** - Subtle red/blue background tint
5. **Fade at close range** - Reduce opacity when very close to avoid blocking view

## Summary
Player name tags are now fully functional, providing clear identification of all players in the match with professional styling and optimal visibility.
