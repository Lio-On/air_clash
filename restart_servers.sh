#!/bin/bash
echo "Killing node and vite processes..."
killall -9 node vite 2>/dev/null

echo "Starting server..."
npm run dev:server > server.log 2>&1 &
SERVER_PID=$!
echo "Server started with PID $SERVER_PID"

echo "Starting client..."
npm run dev:client > client.log 2>&1 &
CLIENT_PID=$!
echo "Client started with PID $CLIENT_PID"

echo "Done! check server.log and client.log for output."
