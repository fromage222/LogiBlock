require('dotenv').config();
const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { loadPuzzles } = require('./game');
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
  registerSocketHandlers(io, socket, puzzleMap);
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`[LogiBlock] Server running on http://localhost:${PORT}`);
  console.log(`[LogiBlock] ${puzzleMap.size} puzzle(s) loaded`);
});

module.exports = { io };
