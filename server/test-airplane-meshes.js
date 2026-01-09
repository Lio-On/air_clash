/**
 * Test airplane mesh rendering
 * This test verifies that:
 * 1. Players spawn at correct positions
 * 2. All 10 players (2 humans + 8 bots) have spawn data
 * 3. Teams are on opposite sides (RED at X=-800, BLUE at X=+800)
 *
 * Visual verification should be done in browser at http://localhost:5173
 */

import { Client } from 'colyseus.js';
import { CONFIG } from '@air-clash/common';

const SERVER_URL = 'ws://localhost:3000';

async function testAirplaneMeshes() {
  console.log('🧪 Testing airplane mesh spawn data...\n');

  const client1 = new Client(SERVER_URL);
  const client2 = new Client(SERVER_URL);

  try {
    // Connect two clients
    console.log('📡 Connecting two clients...');
    const room1 = await client1.joinOrCreate(CONFIG.ROOM_NAME, { name: 'TestPilot1' });
    const room2 = await client2.joinOrCreate(CONFIG.ROOM_NAME, { name: 'TestPilot2' });
    console.log('✅ Both clients connected\n');

    await new Promise(resolve => setTimeout(resolve, 100));

    // Choose teams
    console.log('🔴 TestPilot1 choosing RED team...');
    room1.send('chooseTeam', { team: 'RED' });
    await new Promise(resolve => setTimeout(resolve, 100));

    console.log('🔵 TestPilot2 choosing BLUE team...');
    room2.send('chooseTeam', { team: 'BLUE' });
    await new Promise(resolve => setTimeout(resolve, 100));

    // Both ready up
    console.log('✋ Both pilots readying up...');
    room1.send('toggleReady');
    room2.send('toggleReady');
    await new Promise(resolve => setTimeout(resolve, 300));

    // Verify countdown started and bots filled
    console.log(`\n📊 Phase: ${room1.state.phase}`);
    const totalPlayers = room1.state.players.size;
    console.log(`📊 Total players: ${totalPlayers}`);

    if (totalPlayers !== 10) {
      throw new Error(`Expected 10 players, got ${totalPlayers}`);
    }

    // Wait for countdown
    console.log('\n⏱️  Waiting for countdown (5 seconds)...');
    await new Promise(resolve => setTimeout(resolve, 5500));

    // Verify match started
    console.log(`📊 Phase: ${room1.state.phase}`);
    if (room1.state.phase !== 'IN_MATCH') {
      throw new Error(`Expected IN_MATCH phase, got ${room1.state.phase}`);
    }

    // Verify all players have spawn positions
    console.log('\n✈️  Verifying spawn positions for all players:\n');

    let redCount = 0;
    let blueCount = 0;

    room1.state.players.forEach((player, sessionId) => {
      const pos = `(${player.posX}, ${player.posY}, ${player.posZ})`;
      const vel = `(${player.velocityX.toFixed(1)}, ${player.velocityY.toFixed(1)}, ${player.velocityZ.toFixed(1)})`;
      const invuln = player.invulnerable ? '🛡️' : '  ';

      console.log(`${invuln} ${player.name.padEnd(15)} [${player.team}] pos=${pos} vel=${vel}`);

      // Verify position is not zero (spawned)
      if (player.posY === 0 && player.posX === 0 && player.posZ === 0) {
        throw new Error(`Player ${player.name} has zero position!`);
      }

      // Verify altitude is correct
      if (player.posY !== CONFIG.SPAWN_ALTITUDE) {
        throw new Error(`Player ${player.name} has wrong altitude: ${player.posY}`);
      }

      // Count team positions
      if (player.team === 'RED') {
        redCount++;
        if (player.posX !== -CONFIG.SPAWN_DISTANCE_FROM_CENTER) {
          throw new Error(`RED player ${player.name} has wrong X position: ${player.posX}`);
        }
        if (player.velocityX !== CONFIG.SPAWN_INITIAL_SPEED) {
          throw new Error(`RED player ${player.name} has wrong velocity`);
        }
      } else {
        blueCount++;
        if (player.posX !== CONFIG.SPAWN_DISTANCE_FROM_CENTER) {
          throw new Error(`BLUE player ${player.name} has wrong X position: ${player.posX}`);
        }
        if (player.velocityX !== -CONFIG.SPAWN_INITIAL_SPEED) {
          throw new Error(`BLUE player ${player.name} has wrong velocity`);
        }
      }
    });

    console.log(`\n📊 Team counts: RED=${redCount}, BLUE=${blueCount}`);

    if (redCount !== 5 || blueCount !== 5) {
      throw new Error(`Expected 5v5, got ${redCount}v${blueCount}`);
    }

    // Verify spawn protection is active
    let invulnerableCount = 0;
    room1.state.players.forEach((player) => {
      if (player.invulnerable) invulnerableCount++;
    });
    console.log(`🛡️  Invulnerable players: ${invulnerableCount}/10`);

    if (invulnerableCount !== 10) {
      throw new Error(`Expected all 10 players invulnerable, got ${invulnerableCount}`);
    }

    // Disconnect
    console.log('\n🔌 Disconnecting clients...');
    await room1.leave();
    await room2.leave();

    console.log('\n✅ All airplane mesh data tests passed!');
    console.log('\n📋 Summary:');
    console.log('   ✓ 10 players spawned (5v5)');
    console.log('   ✓ All at correct altitude (100m)');
    console.log('   ✓ RED team at X=-800, facing +X');
    console.log('   ✓ BLUE team at X=+800, facing -X');
    console.log('   ✓ All have correct velocity vectors');
    console.log('   ✓ All have spawn protection active');
    console.log('\n🌐 Open browser to http://localhost:5173 to see visual rendering!');
    console.log('   Expected: 5 RED planes on left, 5 BLUE planes on right');
    console.log('   Teams should face each other across the island');

    process.exit(0);

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run the test
testAirplaneMeshes();
