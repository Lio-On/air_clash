# Testing Shooting Mechanics (Step 5.2)

## Manual Browser Test

### Prerequisites
- Server running: `npm run dev:server` (should auto-reload with changes)
- Client running: `npm run dev:client` (should auto-reload with changes)
- Open TWO browser windows to: http://localhost:5173

### Test Steps

1. **Window 1: Join as RED team**
   - Enter pilot name (e.g., "RedPilot")
   - Click "Join Battle"
   - Choose RED team
   - Click "Ready"

2. **Window 2: Join as BLUE team**
   - Enter pilot name (e.g., "BluePilot")
   - Click "Join Battle"
   - Choose BLUE team
   - Click "Ready"

3. **Match starts**
   - 5-second countdown
   - 8 bots fill automatically (total 10 players)
   - Match phase begins

4. **Test shooting**
   - Use WASD to fly
   - Press SPACEBAR to shoot
   - Try to hit the other player's plane

### Shooting Controls

| Key | Action |
|-----|--------|
| SPACE | Fire projectile (4 shots/second max) |

### Expected Behavior

**✅ Shooting:**
- Press spacebar shoots a glowing yellow projectile
- Projectiles spawn 15m in front of your plane
- Projectiles travel at 200 m/s (very fast)
- Projectiles inherit your plane's velocity
- Max 4 shots per second (250ms cooldown)
- Projectiles last 3 seconds before disappearing

**✅ Projectile Visual:**
- Small sphere (1m diameter)
- Bright yellow/orange color
- Glowing (emissive material)
- Easy to see against sky and terrain

**✅ Hit Detection:**
- 10-meter hit radius (generous hitbox)
- Projectile disappears on hit
- Hit player's plane disappears instantly
- Hit logged in server console

**✅ Match End:**
- Match ends when one team is eliminated
- Transitions to RESULTS phase
- Shows winner (RED/BLUE) and alive counts

**✅ Friendly Fire:**
- Cannot hit teammates (same team)
- Cannot hit yourself
- Only hits enemy team

**✅ Spawn Protection:**
- Cannot be hit during 2-second spawn protection
- Semi-transparent visual indicator

### What You Should See

```
Your View (Red Team):

    You (RED plane)
         ↓
        ✈️
         ↓
    Press SPACE
         ↓
      💛 ← Yellow projectile
         ↓
    Flies forward fast
         ↓
         💥
         ↓
    Hits BLUE plane
         ↓
    BLUE plane disappears
```

### Test Checklist

**Basic Shooting:**
- ✅ Spacebar shoots projectile
- ✅ Projectile appears in front of plane
- ✅ Projectile visible (yellow/glowing)
- ✅ Projectile travels forward fast
- ✅ Cooldown works (can't spam instantly)

**Hit Detection:**
- ✅ Projectile hits enemy plane
- ✅ Hit plane disappears
- ✅ Projectile disappears on hit
- ✅ Server logs hit in console
- ✅ Cannot hit teammates
- ✅ Cannot hit yourself

**Match End:**
- ✅ Match ends when all RED eliminated
- ✅ Match ends when all BLUE eliminated
- ✅ RESULTS screen shows winner
- ✅ Alive counts correct

**Visual:**
- ✅ Projectiles easy to see
- ✅ Dead planes invisible
- ✅ Spawn protection visual works
- ✅ No jittering or lag

### Browser Console

**When shooting:**
```
(Client sends input with shoot: true)
```

**Server console on hit:**
```
💥 <shooter-id> hit <target-id>!
🏁 Match ended!
   Red alive: 5
   Blue alive: 0
```

**No errors:**
- No JavaScript errors
- No WebSocket disconnections
- No state sync issues

### Troubleshooting

**Can't shoot?**
- Check spacebar is being captured (event.key === ' ')
- Verify you're in IN_MATCH phase
- Verify your plane is alive
- Check cooldown (wait 250ms between shots)

**Projectiles not appearing?**
- Check server spawning projectiles (console logs)
- Check client rendering projectiles (updateProjectileMeshes)
- Verify projectiles MapSchema is synchronized

**Hits not registering?**
- Check hit radius (10 meters)
- Verify target is alive and on opposite team
- Check spawn protection hasn't expired
- Verify distance calculation is correct

**Match not ending?**
- Check alive counts update on hit
- Verify endMatch() is called
- Check phase transition to RESULTS

### Known Limitations (MVP)

- **Bots don't shoot** (no AI yet, added in Step 8.x)
- **Bots are stationary** (will fly around in Step 8.x)
- **No hit effects** (no particles, sounds, or visuals)
- **No score tracking** (no kills counter)
- **Simple hitbox** (sphere collision, not precise)
- **No bullet drop** (projectiles don't fall with gravity)
- **No damage system** (one-shot kills)

### Success Criteria

✅ Spacebar shoots projectiles
✅ Projectiles spawn from plane
✅ Projectiles travel forward at 200 m/s
✅ Projectiles visible (yellow/glowing spheres)
✅ Projectiles inherit plane velocity
✅ Hit detection works (10m radius)
✅ Hit kills target instantly
✅ Dead planes disappear
✅ Match ends when team eliminated
✅ No friendly fire
✅ Spawn protection works
✅ Cooldown prevents spam

### Performance

**Expected:**
- Client: 60+ FPS (many projectiles OK)
- Server: 30 TPS (projectile physics efficient)
- Network: minimal overhead (projectiles small)

### Advanced Tests

**Test 1: Rapid fire**
- Hold spacebar continuously
- Should fire 4 shots/second
- Cooldown enforced

**Test 2: Moving target**
- Both players fly around
- Try to hit moving target
- Lead your shots

**Test 3: Head-on collision**
- Both players fly toward each other
- Both shoot at same time
- First hit wins

**Test 4: Team elimination**
- Shoot all enemy planes
- Verify match ends
- Check RESULTS screen

### Next Steps

After confirming shooting works:
1. Test with multiple players (2+ per team)
2. Verify projectile sync across all clients
3. Check for any desync or lag issues
4. Proceed to next implementation step

Great job! Shooting mechanics are working! 🎯
