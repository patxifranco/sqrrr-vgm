# Server Handlers

This directory is prepared for future modularization of the server code.

## Current Structure

The main `server.js` file contains all socket handlers inline. For a full refactor, handlers should be extracted into:

- `vgm.js` - VGM (Video Game Music) guessing game handlers
- `typing.js` - Tikitiki typing game handlers
- `drawing.js` - SQRRRILLO drawing game handlers

## Handler Template

Each handler file should follow this pattern:

```javascript
const { log, warn } = require('../utils');

// Game state
const gameState = {
  players: {},
  // ... game-specific state
};

// Helper functions
function getPlayerList() {
  return Object.values(gameState.players).map(p => ({
    id: p.id,
    name: p.name,
    score: p.score
  }));
}

// Socket event handlers
function setupHandlers(io, socket, { getUserData }) {
  const playerName = null;
  const roomCode = null;

  socket.on('joinGame', (data) => {
    // Handle join
  });

  socket.on('leaveGame', () => {
    // Handle leave
  });

  socket.on('disconnect', () => {
    // Handle disconnect
  });
}

module.exports = {
  setupHandlers,
  gameState
};
```

## Integration with server.js

```javascript
const vgmHandler = require('./handlers/vgm');
const typingHandler = require('./handlers/typing');
const drawingHandler = require('./handlers/drawing');

io.on('connection', (socket) => {
  const userData = { /* shared user data */ };

  vgmHandler.setupHandlers(io, socket, userData);
  typingHandler.setupHandlers(io, socket, userData);
  drawingHandler.setupHandlers(io, socket, userData);
});
```

## Migration Priority

1. **Drawing** - Most self-contained, good first candidate
2. **Typing** - Has VS and Coop modes, medium complexity
3. **VGM** - Core game, most complex, migrate last
