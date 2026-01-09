# Testing Flight Controls (Step 5.1)

## Manual Browser Test

### Prerequisites
- Server running: `npm run dev:server` (should auto-reload with changes)
- Client running: `npm run dev:client` (should auto-reload with changes)
- Open browser to: http://localhost:5173

### Test Steps

1. **Join the game**
   - Enter pilot name
   - Click "Join Battle"

2. **Select team and ready up**
   - Choose RED or BLUE team
   - Click "Ready" button

3. **Wait for countdown**
   - Match countdown: 5 seconds
   - Bots will fill automatically (10 total players)

4. **Match starts - Test flight controls**
   - Your plane spawns with camera following from behind
   - Use keyboard controls to fly

### Keyboard Controls

| Key | Action |
|-----|--------|
| W or ↑ | Pitch up (nose up) |
| S or ↓ | Pitch down (nose down) |
| A or ← | Yaw left (turn left) |
| D or → | Yaw right (turn right) |

### Expected Behavior

**✅ Movement:**
- Plane should move forward automatically (constant forward thrust)
- W/↑: Nose pitches up, plane climbs
- S/↓: Nose pitches down, plane descends
- A/←: Plane turns left
- D/→: Plane turns right

**✅ Physics:**
- Gravity pulls plane down
- Air resistance slows plane over time
- Min speed: 30 m/s (plane won't slow below this)
- Max speed: 100 m/s (plane won't exceed this)
- Pitch limited to ±60° (prevents loop-de-loops)

**✅ Boundaries:**
- Ground collision at 10m altitude (bounces up)
- Arena wraps at 1000m from center (teleports to other side)
- 2000m × 2000m playable area

**✅ Camera:**
- Camera follows your plane smoothly
- Third-person view from behind and above
- You see your own plane in front of camera

**✅ Other Planes:**
- Other 9 planes visible (bots are stationary for now)
- Your plane moves independently
- No collisions with other planes yet

### What You Should See

```
Your View (Third-Person, Behind Plane):

         Camera (following)
                👁️
                 ↓
            [Your Plane] ← You control this
                 ↓
        (Flying through the air)
                 ↓
    [Other planes - stationary bots]
         ✈️  ✈️  ✈️

            Island below
               🏝️
```

### Test Checklist

**Basic Movement:**
- ✅ Plane moves forward automatically
- ✅ W key pitches nose up
- ✅ S key pitches nose down
- ✅ A key turns left
- ✅ D key turns right
- ✅ Camera follows plane smoothly

**Physics:**
- ✅ Plane affected by gravity (pulls down)
- ✅ Speed stays between 30-100 m/s
- ✅ Pitch limited to ±60°
- ✅ Air resistance slows plane

**Boundaries:**
- ✅ Plane bounces off ground (< 10m altitude)
- ✅ Plane wraps at arena edges (±1000m)
- ✅ No escape from playable area

**Visual:**
- ✅ Plane rotates when pitching/yawing
- ✅ Position updates smoothly
- ✅ No jittering or lag
- ✅ Other planes visible but stationary

### Browser Console

**Expected Console Output:**
```
✅ Air Clash Client initialized
🌍 Environment: development
🔗 Server URL: ws://localhost:3000
✅ Joined room <roomId> as <sessionId>
✈️  Created mesh for <your name> (RED/BLUE)
✈️  Created mesh for BOT-1 (RED)
... (more meshes)
```

**No Errors:**
- No JavaScript errors
- No WebSocket disconnections
- No state sync issues

### Troubleshooting

**Controls not working?**
- Check browser console for errors
- Verify you're in IN_MATCH phase (not LOBBY or COUNTDOWN)
- Verify your plane is alive (player.alive = true)
- Make sure browser window has focus (click on canvas)

**Plane not moving?**
- Check server logs for physics updates
- Verify setSimulationInterval is running (30Hz)
- Check deltaTime is correct (~0.033 seconds)

**Camera not following?**
- Verify sessionId is set
- Check playerMeshes Map has your mesh
- Ensure camera.lockedTarget is set

**Plane moves too fast/slow?**
- Check FORWARD_ACCELERATION (default: 20 m/s²)
- Check AIR_RESISTANCE (default: 0.5)
- Check MIN_SPEED (30 m/s) and MAX_SPEED (100 m/s)

### Known Limitations (MVP)

- **Bots are stationary** (no AI yet, added in Step 8.x)
- **No collision detection** between planes (added in Step 7.x)
- **No shooting** yet (added in Step 6.x)
- **Simple physics** (no advanced aerodynamics)
- **No roll control** (would need Q/E keys, not MVP)

### Success Criteria

✅ Keyboard input captured on client
✅ Input sent to server every frame
✅ Server processes input and updates physics
✅ Player plane moves based on keyboard input
✅ Camera follows player smoothly
✅ Physics feels responsive and smooth
✅ No lag or jittering
✅ Arena boundaries work correctly

### Performance

**Expected Frame Rate:**
- Client: 60+ FPS
- Server: 30 TPS (ticks per second)
- Network: <100ms latency (local)

**Console FPS Counter:**
- Shows in top-left if VITE_DEBUG_FPS=true
- Should stay above 60 FPS

### Next Steps

After confirming controls work:
1. Test with multiple players (open 2+ browser windows)
2. Verify each player controls their own plane
3. Verify other players' planes move on your screen
4. Check for any sync issues

Then proceed to Step 5.2 or beyond!
