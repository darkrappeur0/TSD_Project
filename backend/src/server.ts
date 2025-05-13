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
});
