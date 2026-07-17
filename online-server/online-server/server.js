import 'dotenv/config';
import express from 'express';
import http from 'http';
import cors from 'cors';
import { Server } from 'socket.io';

const app = express();
const httpServer = http.createServer(app);
const allowedOrigin = process.env.CLIENT_ORIGIN || '*';
const io = new Server(httpServer, {
  cors: { origin: allowedOrigin === '*' ? true : allowedOrigin, methods: ['GET', 'POST'] }
});

app.use(cors({ origin: allowedOrigin === '*' ? true : allowedOrigin }));
app.use(express.json());
app.get('/', (_req, res) => res.json({ service: 'Ludo 8D online server', status: 'ok' }));
app.get('/health', (_req, res) => res.json({ ok: true, rooms: rooms.size }));

const colors = ['red', 'green', 'yellow', 'blue'];
const rooms = new Map();

function publicRoom(room) {
  return {
    code: room.code,
    host: room.host,
    players: [...room.players.values()].map(({ id, name, color }) => ({ id, name, color })),
    createdAt: room.createdAt
  };
}
function newCode() {
  let code;
  do { code = `LUDO-${Math.floor(1000 + Math.random() * 9000)}`; } while (rooms.has(code));
  return code;
}
function emitRoom(room) { io.to(room.code).emit('room:state', publicRoom(room)); }
function removePlayer(socket) {
  const code = socket.data.roomCode;
  if (!code || !rooms.has(code)) return;
  const room = rooms.get(code);
  room.players.delete(socket.id);
  socket.leave(code);
  socket.data.roomCode = null;
  if (!room.players.size) rooms.delete(code);
  else {
    if (room.host === socket.id) room.host = room.players.keys().next().value;
    emitRoom(room);
  }
}

io.on('connection', (socket) => {
  socket.emit('server:ready', { message: 'Connected to Ludo 8D room server' });

  socket.on('room:create', ({ name } = {}, callback = () => {}) => {
    removePlayer(socket);
    const code = newCode();
    const room = { code, host: socket.id, players: new Map(), createdAt: Date.now() };
    const player = { id: socket.id, name: String(name || 'Player').slice(0, 18), color: 'red' };
    room.players.set(socket.id, player);
    rooms.set(code, room);
    socket.join(code);
    socket.data.roomCode = code;
    callback({ ok: true, room: publicRoom(room), player });
    emitRoom(room);
  });

  socket.on('room:join', ({ code, name } = {}, callback = () => {}) => {
    removePlayer(socket);
    const room = rooms.get(String(code || '').trim().toUpperCase());
    if (!room) return callback({ ok: false, error: 'Room not found. Check the room code.' });
    if (room.players.size >= 4) return callback({ ok: false, error: 'This room is full.' });
    const used = new Set([...room.players.values()].map((player) => player.color));
    const color = colors.find((item) => !used.has(item));
    const player = { id: socket.id, name: String(name || 'Player').slice(0, 18), color };
    room.players.set(socket.id, player);
    socket.join(room.code);
    socket.data.roomCode = room.code;
    callback({ ok: true, room: publicRoom(room), player });
    emitRoom(room);
  });

  socket.on('room:chat', ({ text } = {}) => {
    const room = rooms.get(socket.data.roomCode);
    const player = room?.players.get(socket.id);
    const message = String(text || '').trim().slice(0, 160);
    if (room && player && message) io.to(room.code).emit('room:chat', { name: player.name, color: player.color, text: message, at: Date.now() });
  });

  socket.on('room:leave', () => removePlayer(socket));
  socket.on('disconnect', () => removePlayer(socket));
});

const port = Number(process.env.PORT || 3000);
httpServer.listen(port, () => console.log(`Ludo 8D server listening on port ${port}`));
