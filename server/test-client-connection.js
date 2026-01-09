/**
 * Test client connection to Colyseus server
 * Simulates two clients joining, choosing teams, and going ready
 */

import { Client } from 'colyseus.js';
import { CONFIG } from '@air-clash/common';

const SERVER_URL = 'ws://localhost:3000';

async function testClientConnection() {
  console.log('🧪 Testing client-server connection...\n');

  // Create two clients
  const client1 = new Client(SERVER_URL);
  const client2 = new Client(SERVER_URL);

  try {
    // Client 1 joins
    console.log('📡 Client 1: Connecting...');
    const room1 = await client1.joinOrCreate(CONFIG.ROOM_NAME, { name: 'Alice' });
    console.log(`✅ Client 1: Connected as ${room1.sessionId}`);
    console.log(`   Room ID: ${room1.id}`);

    // Wait for initial state
    await new Promise(resolve => setTimeout(resolve, 100));

    // Client 2 joins the same room
    console.log('\n📡 Client 2: Connecting...');
    const room2 = await client2.joinOrCreate(CONFIG.ROOM_NAME, { name: 'Bob' });
    console.log(`✅ Client 2: Connected as ${room2.sessionId}`);

    // Wait for state sync
    await new Promise(resolve => setTimeout(resolve, 100));

    // Verify both clients see each other
    console.log('\n👥 Verifying roster synchronization...');
    const players1 = Array.from(room1.state.players.values());
    const players2 = Array.from(room2.state.players.values());

    console.log(`   Client 1 sees ${players1.length} players: ${players1.map(p => p.name).join(', ')}`);
    console.log(`   Client 2 sees ${players2.length} players: ${players2.map(p => p.name).join(', ')}`);

    if (players1.length !== 2 || players2.length !== 2) {
      throw new Error('❌ Roster count mismatch!');
    }

    // Client 1 chooses RED team
    console.log('\n🔴 Client 1: Choosing RED team...');
    room1.send('chooseTeam', { team: 'RED' });
    await new Promise(resolve => setTimeout(resolve, 100));

    const alice1 = room1.state.players.get(room1.sessionId);
    const alice2 = room2.state.players.get(room1.sessionId);
    console.log(`   Client 1 sees Alice on team: ${alice1.team}`);
    console.log(`   Client 2 sees Alice on team: ${alice2.team}`);

    if (alice1.team !== 'RED' || alice2.team !== 'RED') {
      throw new Error('❌ Team selection not synchronized!');
    }

    // Client 2 chooses BLUE team
    console.log('\n🔵 Client 2: Choosing BLUE team...');
    room2.send('chooseTeam', { team: 'BLUE' });
    await new Promise(resolve => setTimeout(resolve, 100));

    const bob1 = room1.state.players.get(room2.sessionId);
    const bob2 = room2.state.players.get(room2.sessionId);
    console.log(`   Client 1 sees Bob on team: ${bob1.team}`);
    console.log(`   Client 2 sees Bob on team: ${bob2.team}`);

    if (bob1.team !== 'BLUE' || bob2.team !== 'BLUE') {
      throw new Error('❌ Team selection not synchronized!');
    }

    // Client 1 toggles ready
    console.log('\n✋ Client 1: Toggling ready...');
    room1.send('toggleReady');
    await new Promise(resolve => setTimeout(resolve, 100));

    const alice1Ready = room1.state.players.get(room1.sessionId).ready;
    const alice2Ready = room2.state.players.get(room1.sessionId).ready;
    console.log(`   Client 1 sees Alice ready: ${alice1Ready}`);
    console.log(`   Client 2 sees Alice ready: ${alice2Ready}`);

    if (!alice1Ready || !alice2Ready) {
      throw new Error('❌ Ready state not synchronized!');
    }

    // Client 2 toggles ready (should trigger countdown and bot filling)
    console.log('\n✋ Client 2: Toggling ready...');
    room2.send('toggleReady');
    await new Promise(resolve => setTimeout(resolve, 200));

    const phase1 = room1.state.phase;
    const phase2 = room2.state.phase;
    console.log(`   Client 1 sees phase: ${phase1}`);
    console.log(`   Client 2 sees phase: ${phase2}`);

    if (phase1 !== 'COUNTDOWN' || phase2 !== 'COUNTDOWN') {
      throw new Error('❌ Countdown not triggered!');
    }

    // Check bot filling
    const finalPlayers = Array.from(room1.state.players.values());
    const humanCount = finalPlayers.filter(p => !p.isBot).length;
    const botCount = finalPlayers.filter(p => p.isBot).length;
    console.log(`\n🤖 Bot filling verification:`);
    console.log(`   Total players: ${finalPlayers.length}`);
    console.log(`   Humans: ${humanCount}`);
    console.log(`   Bots: ${botCount}`);

    if (finalPlayers.length !== 10) {
      throw new Error(`❌ Expected 10 players, got ${finalPlayers.length}!`);
    }

    // Wait for countdown to complete
    console.log('\n⏱️  Waiting for countdown to complete...');
    await new Promise(resolve => setTimeout(resolve, 5500));

    const matchPhase1 = room1.state.phase;
    const matchPhase2 = room2.state.phase;
    console.log(`   Client 1 sees phase: ${matchPhase1}`);
    console.log(`   Client 2 sees phase: ${matchPhase2}`);

    if (matchPhase1 !== 'IN_MATCH' || matchPhase2 !== 'IN_MATCH') {
      throw new Error('❌ Match did not start after countdown!');
    }

    // Verify spawn positions are assigned
    const aliceWithSpawn = room1.state.players.get(room1.sessionId);
    const bobWithSpawn = room2.state.players.get(room2.sessionId);
    console.log(`\n✈️  Spawn position verification:`);
    console.log(`   Alice: (${aliceWithSpawn.posX.toFixed(1)}, ${aliceWithSpawn.posY.toFixed(1)}, ${aliceWithSpawn.posZ.toFixed(1)})`);
    console.log(`   Bob: (${bobWithSpawn.posX.toFixed(1)}, ${bobWithSpawn.posY.toFixed(1)}, ${bobWithSpawn.posZ.toFixed(1)})`);

    if (aliceWithSpawn.posY !== 100 || bobWithSpawn.posY !== 100) {
      throw new Error('❌ Spawn positions not assigned correctly!');
    }

    // Disconnect clients
    console.log('\n🔌 Disconnecting clients...');
    await room1.leave();
    await room2.leave();

    console.log('\n✅ All tests passed! Client-server integration working correctly.');
    console.log('\n📋 Summary:');
    console.log('   ✓ Both clients connected successfully');
    console.log('   ✓ Roster synchronized across clients');
    console.log('   ✓ Team selection synchronized');
    console.log('   ✓ Ready state synchronized');
    console.log('   ✓ Countdown triggered when all ready');
    console.log('   ✓ Bots filled to reach 5v5');
    console.log('   ✓ Match started after countdown');
    console.log('   ✓ Spawn positions assigned correctly');

    process.exit(0);

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run the test
testClientConnection();
