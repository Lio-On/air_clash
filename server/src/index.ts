import 'dotenv/config';
import { Server } from 'colyseus';
import { createServer } from 'http';
import express from 'express';
import cors from 'cors';
import { CONFIG, Environment } from '@air-clash/common';
import { DogfightRoom } from './rooms/DogfightRoom';

// Load environment configuration
const NODE_ENV = (process.env.NODE_ENV || 'development') as Environment;
const PORT = parseInt(process.env.PORT || '3000', 10);
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';
const VERBOSE_LOGGING = process.env.VERBOSE_LOGGING === 'true';

// Initialize Express app
const app = express();

// CORS configuration
app.use(cors({
  origin: CORS_ORIGIN,
  credentials: true,
}));

app.use(express.json());

// Initialize Colyseus server
const gameServer = new Server({
  server: createServer(app),
});

// Register game rooms
gameServer.define(CONFIG.ROOM_NAME, DogfightRoom);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: Date.now(),
    environment: NODE_ENV,
    room: CONFIG.ROOM_NAME,
  });
});

// Start server
gameServer.listen(PORT).then(() => {
  console.log('🚀 Air Clash Server is listening on port', PORT);
  console.log(`🌍 Environment: ${NODE_ENV}`);
  console.log(`🔗 CORS Origin: ${CORS_ORIGIN}`);
  console.log(`🎮 Room "${CONFIG.ROOM_NAME}" registered (DogfightRoom)`);

  if (VERBOSE_LOGGING) {
    console.log(`📊 Server Tick Rate: ${CONFIG.SERVER_TICK_RATE} Hz`);
    console.log(`📡 Snapshot Rate: ${CONFIG.SNAPSHOT_RATE} Hz`);
    console.log(`👥 Max Players Per Team: ${CONFIG.MAX_PLAYERS_PER_TEAM}`);
    console.log(`⏱️  Countdown Duration: ${CONFIG.COUNTDOWN_DURATION}ms`);
    console.log(`🛡️  Spawn Protection: ${CONFIG.SPAWN_PROTECTION_DURATION}ms`);
  }

  console.log(`✅ Server ready to accept connections`);
}).catch((error) => {
  console.error('❌ Failed to start server:', error);
  process.exit(1);
});
