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
type Story = { id: string; title: string; description: string; votes: Vote[]; revealed: boolean };

const sessions: {
  [id: string]: {
    id: string;
    members: string[];
    stories: Story[];
  };
} = {};

// Initialize default story for the session
function initializeDefaultStory(sessionId: string) {
  const defaultStory: Story = {
    id: uuidv4(),
    title: "Default Story",
    description: "This is a default story",
    votes: [],
    revealed: false
  };

  // Add the default story to the session
  if (sessions[sessionId]) {
    sessions[sessionId].stories.push(defaultStory);
  }
}

// Socket events
io.on('connection', (socket) => {
  const sessionId = uuidv4();  // For now creating a new session for each user, you may want to change this
  if (!sessions[sessionId]) {
    sessions[sessionId] = {
      id: sessionId,
      members: [],
      stories: []
    };
  }
  sessions[sessionId].members.push(socket.id);

  // Initialize default story if none exists
  if (sessions[sessionId].stories.length === 0) {
    initializeDefaultStory(sessionId);
  }

  socket.emit('sessionID', sessionId);
  socket.emit('update', {
    votes: [],
    revealed: false
  });

  // Send stories to the client
  socket.emit('storiesUpdated', sessions[sessionId].stories);

  // Handle voting event
  socket.on('vote', (value: string) => {
    const story = sessions[sessionId].stories[0]; // Assuming voting for the first story
    const userVote = story.votes.find(v => v.userId === socket.id);
    if (userVote) {
      userVote.value = value;
    } else {
      story.votes.push({ userId: socket.id, value });
    }
    updateVotes(story);
  });

  // Add new story
  socket.on('addStory', (data) => {
    const { title, description } = data;
    const newStory: Story = {
      id: uuidv4(),
      title,
      description,
      votes: [],
      revealed: false
    };

    const session = sessions[sessionId];
    if (session) {
      session.stories.push(newStory);
      io.emit('storiesUpdated', session.stories);
    }
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    const story = sessions[sessionId].stories[0]; // Assuming voting for the first story
    if (story) {
      story.votes = story.votes.filter(v => v.userId !== socket.id);
      updateVotes(story);
    }
  });
});

// Function to update votes
function updateVotes(story: Story) {
  io.emit('update', {
    votes: story.votes,
    revealed: story.revealed
  });
}

// REST endpoints
app.post('/session', (req, res) => {
  const sessionId = uuidv4();
  sessions[sessionId] = { id: sessionId, members: [], stories: [] };
  res.status(201).json({ sessionId });
});

app.get('/session/:id', (req, res) => {
  const session = sessions[req.params.id];
  res.json(session || { message: 'Session not found' });
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
