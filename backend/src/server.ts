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

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on('vote', (value: string) => {
    if (!currentStoryId) return;
    const story = stories.find(s => s.id === currentStoryId);
    if (!story) return;

    let user = story.votes.find(v => v.userId === socket.id);
    if (!user) {
      story.votes.push({ userId: socket.id, value });
    } else {
      user.value = value;
    }
    updateVotes(story);
  });

  socket.on('resetall', () => {
    if (!currentStoryId) return;
    const story = stories.find(s => s.id === currentStoryId);
    if (!story) return;

    story.votes = [];
    story.revealed = false;
    updateVotes(story);
  });

  socket.on('resetme', () => {
    if (!currentStoryId) return;
    const story = stories.find(s => s.id === currentStoryId);
    if (!story) return;

    story.votes = story.votes.filter(vote => vote.userId !== socket.id);
    story.revealed = false;
    updateVotes(story);
  });

  socket.on('reveal', () => {
    if (!currentStoryId) return;
    const story = stories.find(s => s.id === currentStoryId);
    if (!story) return;

    story.revealed = true;
    updateVotes(story);
  });

  socket.on('disconnect', () => {
    if (!currentStoryId) return;
    const story = stories.find(s => s.id === currentStoryId);
    if (!story) return;

    story.votes = story.votes.filter(v => v.userId !== socket.id);
    updateVotes(story);
  });

  socket.emit('stories', stories);
});

function updateVotes(story: Story) {
  io.emit('update', { storyId: story.id, votes: story.votes, revealed: story.revealed });
}

server.listen(3000, () => {
  console.log('Server is running on http://localhost:3000');
});

const sessions: { [id: string]: { id: string, members: string[] } } = {};

app.post('/session', (req, res) => {
  const sessionId = uuidv4();
  sessions[sessionId] = { id: sessionId, members: [] };
  res.status(201).json({ sessionId });
});

app.get('/session/:id', (req, res) => {
  const session = sessions[req.params.id];
  if (!session) {
    return res.status(404).json({ message: 'Session not found' });
  }
  res.json(session);
});

app.post('/story', (req, res) => {
  const { title } = req.body;
  const id = uuidv4();
  const story: Story = { id, title, votes: [], revealed: false };
  stories.push(story);
  currentStoryId = id;
  io.emit('stories', stories);
  res.status(201).json(story);
});

app.get('/stories', (req, res) => {
  res.json(stories);
});

app.post('/selectStory', (req, res) => {
  const { id } = req.body;
  const exists = stories.find(story => story.id === id);
  if (!exists) return res.status(404).json({ message: 'Story not found' });
  currentStoryId = id;
  io.emit('stories', stories);
  res.status(200).json({ selected: id });
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
