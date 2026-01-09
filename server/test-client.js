/**
 * Simple test client to verify DogfightRoom functionality
 * Run with: node server/test-client.js
 */

const { Client } = require('colyseus.js');

const SERVER_URL = 'ws://localhost:3000';
const ROOM_NAME = 'dogfight';

async function testRoomJoinLeave() {
  console.log('🧪 Starting DogfightRoom test...\n');

  // Create two clients
  const client1 = new Client(SERVER_URL);
  const client2 = new Client(SERVER_URL);

  try {
    // Test 1: Join room with first client
    console.log('📥 Test 1: Client 1 joining room...');
    const room1 = await client1.joinOrCreate(ROOM_NAME);
    console.log(`✅ Client 1 joined room: ${room1.id}`);
    console.log(`   Session ID: ${room1.sessionId}\n`);

    await sleep(1000);

    // Test 2: Join room with second client
    console.log('📥 Test 2: Client 2 joining room...');
    const room2 = await client2.joinOrCreate(ROOM_NAME);
    console.log(`✅ Client 2 joined room: ${room2.id}`);
    console.log(`   Session ID: ${room2.sessionId}\n`);

    await sleep(1000);

    // Test 3: First client leaves
    console.log('📤 Test 3: Client 1 leaving room...');
    await room1.leave();
    console.log('✅ Client 1 left room\n');

    await sleep(1000);

    // Test 4: Second client leaves
    console.log('📤 Test 4: Client 2 leaving room...');
    await room2.leave();
    console.log('✅ Client 2 left room\n');

    await sleep(1000);

    console.log('✅ All tests passed!\n');
    console.log('Expected server logs:');
    console.log('  - "Client [id] joined" × 2');
    console.log('  - "Player count: 1/10" then "2/10"');
    console.log('  - "Client [id] left" × 2');
    console.log('  - "Player count: 1/10" then "0/10"');
    console.log('  - "DogfightRoom disposed" (when empty)');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }

  process.exit(0);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Run tests
testRoomJoinLeave();
