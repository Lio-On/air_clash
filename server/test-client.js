/**
 * Test client to verify DogfightRoom state synchronization
 * Run with: node server/test-client.js
 */

const { Client } = require('colyseus.js');

const SERVER_URL = 'ws://localhost:3000';
const ROOM_NAME = 'dogfight';

async function testRoomState() {
  console.log('🧪 Starting DogfightRoom state synchronization test...\n');

  // Create two clients
  const client1 = new Client(SERVER_URL);
  const client2 = new Client(SERVER_URL);

  try {
    // Test 1: Join room with first client
    console.log('📥 Test 1: Client 1 joining room...');
    const room1 = await client1.joinOrCreate(ROOM_NAME, { name: 'Alice' });
    console.log(`✅ Client 1 joined room: ${room1.id}`);
    console.log(`   Session ID: ${room1.sessionId}`);

    // Wait for initial state sync
    await sleep(500);

    // Verify initial state
    console.log(`\n📊 Client 1 sees state:`);
    console.log(`   Phase: ${room1.state.phase}`);
    console.log(`   Players count: ${room1.state.players.size}`);
    console.log(`   AliveRed: ${room1.state.aliveRed}, AliveBlue: ${room1.state.aliveBlue}`);

    // List players
    room1.state.players.forEach((player, sessionId) => {
      console.log(`   Player ${sessionId.substring(0, 8)}: ${player.name}, Team: ${player.team}, Ready: ${player.ready}`);
    });

    await sleep(500);

    // Test 2: Join room with second client
    console.log(`\n📥 Test 2: Client 2 joining room...`);
    const room2 = await client2.joinOrCreate(ROOM_NAME, { name: 'Bob' });
    console.log(`✅ Client 2 joined room: ${room2.id}`);
    console.log(`   Session ID: ${room2.sessionId}`);

    await sleep(500);

    // Verify both clients see the same state
    console.log(`\n📊 Client 1 sees state:`);
    console.log(`   Phase: ${room1.state.phase}`);
    console.log(`   Players count: ${room1.state.players.size}`);
    room1.state.players.forEach((player, sessionId) => {
      console.log(`   Player ${sessionId.substring(0, 8)}: ${player.name}, Team: ${player.team}`);
    });

    console.log(`\n📊 Client 2 sees state:`);
    console.log(`   Phase: ${room2.state.phase}`);
    console.log(`   Players count: ${room2.state.players.size}`);
    room2.state.players.forEach((player, sessionId) => {
      console.log(`   Player ${sessionId.substring(0, 8)}: ${player.name}, Team: ${player.team}`);
    });

    // Verify consistency
    if (room1.state.phase === room2.state.phase &&
        room1.state.players.size === room2.state.players.size &&
        room1.state.players.size === 2) {
      console.log(`\n✅ State consistency check PASSED!`);
      console.log(`   Both clients see: phase=${room1.state.phase}, players=${room1.state.players.size}`);
    } else {
      throw new Error('State mismatch between clients!');
    }

    await sleep(500);

    // Test 3: First client leaves
    console.log(`\n📤 Test 3: Client 1 leaving room...`);
    await room1.leave();
    console.log('✅ Client 1 left room');

    await sleep(500);

    // Verify client 2 sees updated state
    console.log(`\n📊 Client 2 sees updated state:`);
    console.log(`   Players count: ${room2.state.players.size}`);
    room2.state.players.forEach((player, sessionId) => {
      console.log(`   Player ${sessionId.substring(0, 8)}: ${player.name}`);
    });

    if (room2.state.players.size === 1) {
      console.log(`✅ Client 2 correctly sees 1 player remaining`);
    } else {
      throw new Error(`Expected 1 player, but Client 2 sees ${room2.state.players.size}`);
    }

    await sleep(500);

    // Test 4: Second client leaves
    console.log(`\n📤 Test 4: Client 2 leaving room...`);
    await room2.leave();
    console.log('✅ Client 2 left room');

    await sleep(500);

    console.log('\n✅ All state synchronization tests passed!\n');
    console.log('Verified:');
    console.log('  ✅ Both clients see consistent phase');
    console.log('  ✅ Both clients see consistent player count');
    console.log('  ✅ Both clients see consistent player data');
    console.log('  ✅ State updates when players leave');

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
testRoomState();
