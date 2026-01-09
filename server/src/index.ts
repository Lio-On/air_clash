import { Server } from 'colyseus';
import { createServer } from 'http';
import express from 'express';
import cors from 'cors';
import { CONFIG } from '@air-clash/common';

const app = express();
app.use(cors());
app.use(express.json());

const gameServer = new Server({
  server: createServer(app),
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

const PORT = process.env.PORT || 3000;

gameServer.listen(PORT).then(() => {
  console.log('🚀 Air Clash Server is listening on port', PORT);
  console.log(`📊 Server Tick Rate: ${CONFIG.SERVER_TICK_RATE} Hz`);
  console.log(`📡 Snapshot Rate: ${CONFIG.SNAPSHOT_RATE} Hz`);
  console.log(`✅ Successfully imported CONFIG from @air-clash/common`);
}).catch((error) => {
  console.error('❌ Failed to start server:', error);
  process.exit(1);
});
