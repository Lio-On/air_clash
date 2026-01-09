# Testing Follow Camera (Step 4.2)

## Manual Browser Test

### Prerequisites
- Server running: `npm run dev:server`
- Client running: `npm run dev:client`
- Open browser to: http://localhost:5173

### Test Steps

1. **Join the game**
   - Enter pilot name (e.g., "TestPilot")
   - Click "Join Battle"

2. **Select team and ready up**
   - Choose RED or BLUE team
   - Click "Ready" button

3. **Wait for countdown**
   - Match countdown: 5 seconds
   - Bots will be added automatically (total 10 players)

4. **Match starts - Camera should follow your plane**
   - ✅ Camera positioned behind and above your airplane
   - ✅ Camera follows your plane's position
   - ✅ Camera smoothly tracks your movements
   - ✅ You can see your own plane in front of camera
   - ✅ Other 9 planes visible in the scene

### Expected Camera Behavior

**Camera Position:**
- Distance behind plane: 30 meters
- Height above plane: 10 meters
- Rotation: Looking forward (180° from behind)

**Camera Movement:**
- Smooth acceleration: 0.05
- Max speed: 20 m/s
- Follows local player automatically
- No manual camera controls needed

**Visual Verification:**

```
Your View (Third-Person):

         Camera (30m behind, 10m up)
                    ↓
                   👁️
                    ↓
          [Your Airplane] ← You see this
               ↓
          Flying forward
               ↓
          [Other planes visible ahead/around]
```

### What You Should See

1. **Your plane** (RED or BLUE colored):
   - Visible in front of camera
   - Fuselage (body), wings, and tail
   - Semi-transparent if spawn protection active

2. **Other planes**:
   - 4 teammates in your color
   - 5 enemies in opposite color
   - All arranged in formation initially

3. **Environment**:
   - Green circular island below
   - Blue ocean around island
   - Sky blue background
   - Smooth camera following your plane

### Troubleshooting

**Camera not following?**
- Check browser console for errors
- Verify sessionId is set (should be set after joining)
- Verify player mesh exists in playerMeshes Map

**Camera too close/far?**
- Adjust `camera.radius` in createScene() (default: 30)
- Adjust `camera.heightOffset` (default: 10)

**Camera too fast/slow?**
- Adjust `camera.cameraAcceleration` (default: 0.05)
- Adjust `camera.maxCameraSpeed` (default: 20)

### Current Limitation (MVP)

- Planes are **stationary** (spawn positions don't change yet)
- Flight physics will be added in later steps
- Camera follows position only (planes don't move in MVP at this stage)

### Success Criteria

✅ Camera positioned behind local player's plane
✅ Camera 30m back and 10m up from plane
✅ Camera looking forward (rotationOffset = 180°)
✅ Camera smoothly follows player
✅ No camera controls interfering with view
✅ Local player mesh visible from camera
✅ Other 9 planes visible in scene
