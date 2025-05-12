import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import cors from 'cors';

const app = express();
const server = http.createServer(app);
const io = new Server(server);
app.use(cors());
app.use(express.json());

const PORT = 3000;

const frontendPath = path.join(__dirname, '..', '..', 'frontend');
app.use(express.static(frontendPath));

app.get('/', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

type Vote = { userId: string; value: string | null };
type Story = { id: string; title: string; votes: Vote[]; revealed: boolean };

let stories: Story[] = [];
let currentStoryId: string | null = null;

const sessions: { [id: string]: { id: string, members: string[] } } = {};

// Initialize a default story
function initializeDefaultStory() {
  const defaultStory: Story = {
    id: uuidv4(),
    title: "Default Story",
    votes: [],
    revealed: false
  };
  stories.push(defaultStory);
  currentStoryId = defaultStory.id;
  return defaultStory;
}

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Create or reuse a session
  const sessionId = uuidv4();
  if (!sessions[sessionId]) {
    sessions[sessionId] = { id: sessionId, members: [] };
  }
  sessions[sessionId].members.push(socket.id);

  // Initialize a story if none exists
  if (stories.length === 0) {
    initializeDefaultStory();
  }

  // Send session and story data to the client
  socket.emit('sessionID', sessionId);
  socket.emit('update', {
    votes: stories.find(s => s.id === currentStoryId)?.votes || [],
    revealed: stories.find(s => s.id === currentStoryId)?.revealed || false
  });

  // Event handlers
  socket.on('vote', (value: string) => {
    const story = stories.find(s => s.id === currentStoryId);
    if (!story) return;

    const userVote = story.votes.find(v => v.userId === socket.id);
    if (userVote) {
      userVote.value = value;
    } else {
      story.votes.push({ userId: socket.id, value });
    }
    updateVotes(story);
  });

  socket.on('reveal', () => {
    const story = stories.find(s => s.id === currentStoryId);
    if (!story) return;

    story.revealed = true;
    updateVotes(story);
  });

  socket.on('resetall', () => {
    const story = stories.find(s => s.id === currentStoryId);
    if (!story) return;

    story.votes = [];
    story.revealed = false;
    updateVotes(story);
  });

  socket.on('resetme', () => {
    const story = stories.find(s => s.id === currentStoryId);
    if (!story) return;

    story.votes = story.votes.filter(v => v.userId !== socket.id);
    updateVotes(story);
  });

  socket.on('disconnect', () => {
    const story = stories.find(s => s.id === currentStoryId);
    if (story) {
      story.votes = story.votes.filter(v => v.userId !== socket.id);
      updateVotes(story);
    }
  });
});

function updateVotes(story: Story) {
  io.emit('update', {
    votes: story.votes,
    revealed: story.revealed
  });
}

// REST endpoints (unchanged)
app.post('/session', (req, res) => {
  const sessionId = uuidv4();
  sessions[sessionId] = { id: sessionId, members: [] };
  res.status(201).json({ sessionId });
});

app.get('/session/:id', (req, res) => {
  const session = sessions[req.params.id];
  res.json(session || { message: 'Session not found' });
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});