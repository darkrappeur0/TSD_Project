import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import cors from 'cors';

const app = express();
const server = createServer(app);
const io = new Server(server);
app.use(cors());
app.use(express.json());

const PORT = 3000;

<<<<<<< HEAD
// CORS et JSON
app.use(cors());
app.use(express.json());

// Chemin vers le frontend
const frontendPath = path.join(__dirname, '..', '..', 'frontend');
app.use(express.static(frontendPath));  // Cela permet de servir les fichiers statiques du frontend

// Route principale vers index.html
=======
const frontendPath = path.join(__dirname, '..', '..', 'frontend');
app.use(express.static(frontendPath));

>>>>>>> temp-test
app.get('/', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});
interface Story {
  id: string;
  title: string;
  description: string;
  points: number | null;
  votes: { [userId: string]: string };
}

<<<<<<< HEAD
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
=======
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
function getSessionBySocket(socketId: string) {
  return Object.values(sessions).find(session =>
    session.members.includes(socketId)
  );
}



// Socket events
// Socket events
io.on('connection', (socket) => {
  const sessionId = uuidv4();  // Pour l'instant créer une nouvelle session pour chaque utilisateur, tu devras probablement le modifier
  if (!sessions[sessionId]) {
    sessions[sessionId] = {
      id: sessionId,
      members: [],
      stories: []
    };
  }
  sessions[sessionId].members.push(socket.id);

  // Initialiser l'histoire par défaut si aucune n'existe
  if (sessions[sessionId].stories.length === 0) {
    initializeDefaultStory(sessionId);
  }

  socket.emit('sessionID', sessionId);
  socket.emit('update', {
    votes: [],
    revealed: false
  });

  // Envoi des histoires à l'utilisateur
  socket.emit('storiesUpdated', sessions[sessionId].stories);

  // Gérer l'événement de vote
  socket.on('vote', (value: string) => {
    const session = getSessionBySocket(socket.id);
    if (!session) return;

    const story = session.stories[0];
    const userVote = story.votes.find(v => v.userId === socket.id);

    if (userVote) {
      userVote.value = value;
    } else {
      story.votes.push({ userId: socket.id, value });
    }

    updateVotes(session.id, story);  // Assurer que tous les clients reçoivent la mise à jour
  });

  // Ajouter une nouvelle histoire
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

  // Gérer la déconnexion
  socket.on('disconnect', () => {
    const session = getSessionBySocket(socket.id);
    if (!session) return;

    const story = session.stories[0]; // Tu peux gérer plus tard la sélection dynamique
    if (story) {
      story.votes = story.votes.filter(v => v.userId !== socket.id);
      updateVotes(session.id, story);
    }

    // Retirer l'utilisateur de la session
    session.members = session.members.filter(id => id !== socket.id);
  });

  socket.on('reveal', () => {
    const session = getSessionBySocket(socket.id);
    if (!session) return;
    const story = session.stories[0];
    story.revealed = true;
    updateVotes(session.id, story);
  });

  // Réinitialiser uniquement ce client
  socket.on('resetme', () => {
    const session = getSessionBySocket(socket.id);
    if (!session) return;
    const story = session.stories[0];
    story.votes = story.votes.filter(v => v.userId !== socket.id);
    updateVotes(session.id, story);
  });

  // Réinitialiser tous les votes
  socket.on('resetall', () => {
    const session = getSessionBySocket(socket.id);
    if (!session) return;
    const story = session.stories[0];
    story.votes = [];
    story.revealed = false;
    updateVotes(session.id, story);
  });
});

// Function to update votes
function updateVotes(sessionId: string, story: Story) {
  const session = sessions[sessionId];
  if (!session) return;

  // Envoie la mise à jour des votes à tous les membres de la session
  session.members.forEach(socketId => {
    io.to(socketId).emit('update', {
      votes: story.votes,
      revealed: story.revealed
    });
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
>>>>>>> temp-test
});
