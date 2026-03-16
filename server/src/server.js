require('dotenv').config();
const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { loadPuzzles, getLeaderboard } = require('./game');
const registerSocketHandlers = require('./socket');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: '*' } });

// Serve static client files
app.use(express.static(path.join(__dirname, '../../client')));

// Load and validate all puzzles synchronously at startup
// CRITICAL: loadPuzzles() exits process if zero valid puzzles found
const puzzleMap = loadPuzzles();

// Register socket event handlers
io.on('connection', (socket) => {
  socket.emit('leaderboard:update', getLeaderboard()); // TIME-04: greet new socket with current leaderboard
  registerSocketHandlers(io, socket, puzzleMap);
});

const PORT = process.env.PORT || 8000;
httpServer.listen(PORT, () => {
  console.log(`[LogiBlock] Server running on http://141.72.176.152:${PORT}`);
  console.log(`[LogiBlock] ${puzzleMap.size} puzzle(s) loaded`);
});

module.exports = { io };
