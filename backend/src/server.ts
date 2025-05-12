import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import cors from 'cors';

const app = express();
const server = createServer(app);
const io = new Server(server);

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

interface Story {
  id: string;
  title: string;
  description: string;
  points: number | null;
  votes: { [userId: string]: string };
}

interface Session {
  id: string;
  stories: Story[];
  selectedStoryId: string | null;
  votes: { [userId: string]: string };
  revealed: boolean;
  members: string[];
  history: { title: string; average: number }[];
}

const sessions: { [key: string]: Session } = {};
const socketToSession: { [socketId: string]: string } = {};

app.post('/session', (req, res) => {
  const sessionId = uuidv4();
  sessions[sessionId] = {
    id: sessionId,
    stories: [],
    selectedStoryId: null,
    votes: {},
    revealed: false,
    members: [],
    history: [],
  };
  res.json({ sessionId });
});

app.get('/session/:id/stories', (req, res) => {
  const session = sessions[req.params.id];
  if (!session) return res.status(404).json({ message: 'Session not found' });
  res.json(session.stories);
});

app.post('/session/:id/story', (req, res) => {
  const session = sessions[req.params.id];
  if (!session) return res.status(404).json({ message: 'Session not found' });

  const { title, description } = req.body;
  if (!title || !description) return res.status(400).json({ message: 'Missing title or description' });

  if (session.stories.some(story => story.title === title)) {
    return res.status(409).json({ message: 'Story with this title already exists' });
  }

  const newStory: Story = {
    id: uuidv4(),
    title,
    description,
    points: null,
    votes: {},
  };

  session.stories.push(newStory);
  io.to(session.id).emit('storyListUpdate', session.stories);  // Emit update to all connected clients
  res.status(201).json(newStory);
});

app.delete('/session/:id/story/:storyId', (req, res) => {
  const session = sessions[req.params.id];
  if (!session) return res.status(404).json({ message: 'Session not found' });

  session.stories = session.stories.filter(s => s.id !== req.params.storyId);
  if (session.selectedStoryId === req.params.storyId) {
    session.selectedStoryId = null;
  }
  io.to(session.id).emit('storyListUpdate', session.stories);  // Emit update to all connected clients
  res.status(204).send();
});

io.on('connection', (socket) => {
  const sessionId = socket.handshake.query.sessionId as string;
  if (!sessionId || !sessions[sessionId]) {
    socket.disconnect();
    return;
  }

  socket.join(sessionId);
  socketToSession[socket.id] = sessionId;
  sessions[sessionId].members.push(socket.id);

  socket.emit('sessionID', sessionId);
  socket.emit('storyListUpdate', sessions[sessionId].stories);
  socket.emit('selectedStoryUpdate', sessions[sessionId].selectedStoryId);

  socket.on('vote', (value) => {
    const session = sessions[sessionId];
    if (!session) return;

    session.votes[socket.id] = value;
    io.to(sessionId).emit('update', { votes: Object.entries(session.votes).map(([user, value]) => ({ user, value })), revealed: session.revealed });
  });

  socket.on('selectStory', (storyId) => {
    const session = sessions[sessionId];
    if (!session) return;

    session.selectedStoryId = storyId;
    io.to(sessionId).emit('selectedStoryUpdate', storyId);  // Emit selected story update to all clients
  });

  socket.on('reveal', () => {
    const session = sessions[sessionId];
    if (!session) return;

    session.revealed = true;
    const values = Object.values(session.votes).map(v => parseInt(v)).filter(v => !isNaN(v));
    const average = values.reduce((a, b) => a + b, 0) / values.length;
    const selectedStory = session.stories.find(s => s.id === session.selectedStoryId);
    if (selectedStory) {
      session.history.push({ title: selectedStory.title, average: isNaN(average) ? 0 : average });
    }
    io.to(sessionId).emit('update', { votes: Object.entries(session.votes).map(([user, value]) => ({ user, value })), revealed: true });
    io.to(sessionId).emit('historyUpdate', session.history);
  });

  socket.on('resetme', () => {
    const session = sessions[sessionId];
    if (!session) return;

    delete session.votes[socket.id];
    socket.emit('update', { votes: Object.entries(session.votes).map(([user, value]) => ({ user, value })), revealed: false });
  });

  socket.on('resetall', () => {
    const session = sessions[sessionId];
    if (!session) return;

    session.votes = {};
    session.revealed = false;
    io.to(sessionId).emit('update', { votes: [], revealed: false });
  });

  socket.on('disconnect', () => {
    const session = sessions[sessionId];
    if (session) {
      session.members = session.members.filter(id => id !== socket.id);
      delete session.votes[socket.id];
    }
    delete socketToSession[socket.id];
  });
});

server.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
