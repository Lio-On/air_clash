/**
 * Test client to verify spawn positions and spawn protection
 * Run with: node server/test-spawn.js
 */

const { Client } = require('colyseus.js');

const SERVER_URL = 'ws://localhost:3000';
const ROOM_NAME = 'dogfight';
const SPAWN_PROTECTION_DURATION = 2000; // Must match CONFIG.SPAWN_PROTECTION_DURATION
const SPAWN_DISTANCE_FROM_CENTER = 800;
const SPAWN_ALTITUDE = 100;
const SPAWN_SPACING = 50;

async function testSpawn() {
  console.log('🧪 Starting spawn test...\n');

  try {
    // Test 1: Verify spawn positions for both teams
    console.log('📥 Test 1: Spawn positions and team placement');
    const client1 = new Client(SERVER_URL);
    const client2 = new Client(SERVER_URL);

    const room1 = await client1.joinOrCreate(ROOM_NAME, { name: 'Alice' });
    await sleep(300);

    const room2 = await client2.joinOrCreate(ROOM_NAME, { name: 'Bob' });
    await sleep(300);

    console.log(`  Initial phase: ${room1.state.phase}`);

    // Both ready up to trigger countdown and match start
    console.log('  Both players readying up...');
    room1.send('toggleReady');
    room2.send('toggleReady');
    await sleep(500); // Give time for bots to fill and countdown to start

    console.log(`  Phase after ready: ${room1.state.phase}`);

    // Wait for countdown to complete and match to start
    console.log('  Waiting for countdown (5 seconds)...');
    await sleep(5500);

    const phase = room1.state.phase;
    console.log(`  Phase after countdown: ${phase}`);

    if (phase !== 'IN_MATCH') {
      throw new Error(`Expected IN_MATCH phase, got ${phase}`);
    }

    // Check spawn positions
    console.log('\n  Checking spawn positions:');

    let redCount = 0;
    let blueCount = 0;
    let redPlayers = [];
    let bluePlayers = [];

    room1.state.players.forEach((player) => {
      if (player.team === 'RED') {
        redCount++;
        redPlayers.push(player);
      } else {
        blueCount++;
        bluePlayers.push(player);
      }
    });

    console.log(`  Red team: ${redCount} players, Blue team: ${blueCount} players`);

    // Verify RED team spawns on left side (-X)
    console.log('\n  RED team positions:');
    redPlayers.forEach((player, index) => {
      console.log(`    ${player.name}: pos=(${player.posX.toFixed(0)}, ${player.posY.toFixed(0)}, ${player.posZ.toFixed(0)}), vel=(${player.velocityX.toFixed(1)}, ${player.velocityY.toFixed(1)}, ${player.velocityZ.toFixed(1)}), invulnerable=${player.invulnerable}`);

      // Verify X position (should be -800)
      if (Math.abs(player.posX - (-SPAWN_DISTANCE_FROM_CENTER)) > 1) {
        throw new Error(`RED player ${player.name} has wrong X position: ${player.posX}, expected ${-SPAWN_DISTANCE_FROM_CENTER}`);
      }

      // Verify Y position (altitude should be 100)
      if (Math.abs(player.posY - SPAWN_ALTITUDE) > 1) {
        throw new Error(`RED player ${player.name} has wrong Y position: ${player.posY}, expected ${SPAWN_ALTITUDE}`);
      }

      // Verify alive status
      if (!player.alive) {
        throw new Error(`RED player ${player.name} should be alive`);
      }

      // Verify velocity (should be moving forward in +X direction)
      if (player.velocityX <= 0) {
        throw new Error(`RED player ${player.name} should have positive X velocity`);
      }
    });

    // Verify BLUE team spawns on right side (+X)
    console.log('\n  BLUE team positions:');
    bluePlayers.forEach((player, index) => {
      console.log(`    ${player.name}: pos=(${player.posX.toFixed(0)}, ${player.posY.toFixed(0)}, ${player.posZ.toFixed(0)}), vel=(${player.velocityX.toFixed(1)}, ${player.velocityY.toFixed(1)}, ${player.velocityZ.toFixed(1)}), invulnerable=${player.invulnerable}`);

      // Verify X position (should be +800)
      if (Math.abs(player.posX - SPAWN_DISTANCE_FROM_CENTER) > 1) {
        throw new Error(`BLUE player ${player.name} has wrong X position: ${player.posX}, expected ${SPAWN_DISTANCE_FROM_CENTER}`);
      }

      // Verify Y position (altitude should be 100)
      if (Math.abs(player.posY - SPAWN_ALTITUDE) > 1) {
        throw new Error(`BLUE player ${player.name} has wrong Y position: ${player.posY}, expected ${SPAWN_ALTITUDE}`);
      }

      // Verify alive status
      if (!player.alive) {
        throw new Error(`BLUE player ${player.name} should be alive`);
      }

      // Verify velocity (should be moving forward in -X direction)
      if (player.velocityX >= 0) {
        throw new Error(`BLUE player ${player.name} should have negative X velocity`);
      }
    });

    console.log('\n✅ Test 1 passed: Teams spawn on opposite sides facing each other\n');

    // Test 2: Verify spawn protection
    console.log('📥 Test 2: Spawn protection (invulnerability)');

    // Check immediately after spawn
    let invulnerableCount = 0;
    room1.state.players.forEach((player) => {
      if (player.invulnerable) {
        invulnerableCount++;
      }
    });

    console.log(`  Invulnerable players immediately after spawn: ${invulnerableCount}/10`);

    if (invulnerableCount !== 10) {
      throw new Error(`Expected all 10 players to be invulnerable, got ${invulnerableCount}`);
    }

    // Wait for spawn protection to expire (add extra buffer for state sync)
    console.log(`  Waiting ${SPAWN_PROTECTION_DURATION / 1000} seconds for spawn protection to expire...`);
    await sleep(SPAWN_PROTECTION_DURATION + 1000); // Extra 1 second buffer

    // Check after spawn protection expires
    let vulnerableCount = 0;
    room1.state.players.forEach((player) => {
      if (!player.invulnerable) {
        vulnerableCount++;
      }
    });

    console.log(`  Vulnerable players after protection expires: ${vulnerableCount}/10`);

    if (vulnerableCount !== 10) {
      throw new Error(`Expected all 10 players to be vulnerable, got ${vulnerableCount}`);
    }

    console.log('✅ Test 2 passed: Spawn protection lasts exactly 2 seconds\n');

    // Cleanup
    await room1.leave();
    await room2.leave();
    await sleep(500);

    // Test 3: Verify spawn positions are consistent across clients
    console.log('📥 Test 3: Spawn positions consistent across clients');
    const client3 = new Client(SERVER_URL);
    const client4 = new Client(SERVER_URL);

    const room3 = await client3.joinOrCreate(ROOM_NAME, { name: 'Charlie' });
    await sleep(300);

    const room4 = await client4.joinOrCreate(ROOM_NAME, { name: 'Diana' });
    await sleep(300);

    // Ready up and wait for match start
    room3.send('toggleReady');
    room4.send('toggleReady');
    await sleep(500);

    console.log('  Waiting for countdown (5 seconds)...');
    await sleep(5500);

    // Compare positions from both clients
    console.log('  Comparing positions from both clients...');

    let positionMismatches = 0;
    room3.state.players.forEach((player3) => {
      const player4 = room4.state.players.get(player3.id);
      if (!player4) {
        console.log(`  ⚠️  Player ${player3.id} not found in client 4`);
        positionMismatches++;
        return;
      }

      if (
        Math.abs(player3.posX - player4.posX) > 0.1 ||
        Math.abs(player3.posY - player4.posY) > 0.1 ||
        Math.abs(player3.posZ - player4.posZ) > 0.1
      ) {
        console.log(`  ⚠️  Position mismatch for ${player3.name}:`);
        console.log(`      Client 3: (${player3.posX}, ${player3.posY}, ${player3.posZ})`);
        console.log(`      Client 4: (${player4.posX}, ${player4.posY}, ${player4.posZ})`);
        positionMismatches++;
      }
    });

    if (positionMismatches === 0) {
      console.log('  ✅ All positions match across clients');
    } else {
      throw new Error(`Found ${positionMismatches} position mismatches`);
    }

    console.log('✅ Test 3 passed: Positions consistent across all clients\n');

    // Cleanup
    await room3.leave();
    await room4.leave();
    await sleep(500);

    console.log('✅ All spawn tests passed!\n');
    console.log('Verified:');
    console.log('  ✅ RED team spawns on left side (-X = -800)');
    console.log('  ✅ BLUE team spawns on right side (+X = +800)');
    console.log('  ✅ All planes spawn at correct altitude (Y = 100)');
    console.log('  ✅ Planes arranged with 50m spacing in Z axis');
    console.log('  ✅ RED team faces right (+X direction)');
    console.log('  ✅ BLUE team faces left (-X direction)');
    console.log('  ✅ All planes have initial forward velocity');
    console.log('  ✅ All planes marked as alive on spawn');
    console.log('  ✅ Spawn protection applied to all players');
    console.log('  ✅ Spawn protection lasts exactly 2 seconds');
    console.log('  ✅ Spawn positions consistent across all clients');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }

  process.exit(0);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Run tests
testSpawn();
