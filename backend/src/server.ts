import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import cors from 'cors';

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = 3000;

// CORS et JSON
app.use(cors());
app.use(express.json());

// Chemin vers le frontend
const frontendPath = path.join(__dirname, '..', '..', 'frontend');
app.use(express.static(frontendPath));

// Route principale vers index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

type Vote = { userId: string; userName?: string; value: string | null };
type Story = { id: string; title: string; description: string; votes: Vote[]; revealed: boolean };

const sessions: {
  [id: string]: {
    id: string;
    members: Array<{socketId: string, userName?: string}>;
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

  if (sessions[sessionId]) {
    sessions[sessionId].stories.push(defaultStory);
  }
}

function getSessionBySocket(socketId: string) {
  return Object.values(sessions).find(session =>
    session.members.some(member => member.socketId === socketId)
  );
}

// Socket events
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Écouter l'événement de jointure de session
  socket.on('joinSession', (data) => {
    const { sessionId, userName } = data;
    
    console.log(`User ${userName} (${socket.id}) trying to join session ${sessionId}`);

    // Vérifier si la session existe
    if (!sessions[sessionId]) {
      socket.emit('error', { message: 'Session not found' });
      return;
    }

    // Rejoindre la room de la session
    socket.join(sessionId);
    
    // Ajouter l'utilisateur à la session
    sessions[sessionId].members.push({
      socketId: socket.id,
      userName: userName
    });

    // Initialiser l'histoire par défaut si aucune n'existe
    if (sessions[sessionId].stories.length === 0) {
      initializeDefaultStory(sessionId);
    }

    // Confirmer la connexion
    socket.emit('sessionJoined', { 
      sessionId, 
      userName,
      stories: sessions[sessionId].stories 
    });

    // Envoyer l'état actuel des votes
    const currentStory = sessions[sessionId].stories[0];
    if (currentStory) {
      socket.emit('update', {
        votes: currentStory.votes,
        revealed: currentStory.revealed
      });
    }

    // Notifier les autres membres
    socket.to(sessionId).emit('memberJoined', { 
      userName,
      memberCount: sessions[sessionId].members.length 
    });

    console.log(`Session ${sessionId} now has ${sessions[sessionId].members.length} members`);
  });

  // Gérer l'événement de vote
  socket.on('vote', (value: string) => {
    const session = getSessionBySocket(socket.id);
    if (!session) {
      socket.emit('error', { message: 'Not in a session' });
      return;
    }

    const story = session.stories[0]; // Pour l'instant on utilise la première histoire
    const member = session.members.find(m => m.socketId === socket.id);
    const userVote = story.votes.find(v => v.userId === socket.id);

    if (userVote) {
      userVote.value = value;
    } else {
      story.votes.push({ 
        userId: socket.id, 
        userName: member?.userName,
        value 
      });
    }

    // Envoyer la mise à jour à tous les membres de la session
    io.to(session.id).emit('update', {
      votes: story.votes,
      revealed: story.revealed
    });

    console.log(`Vote received: ${value} from ${member?.userName || socket.id}`);
  });

  // Ajouter une nouvelle histoire
  socket.on('addStory', (data) => {
    const { title, description } = data;
    const session = getSessionBySocket(socket.id);
    
    if (!session) {
      socket.emit('error', { message: 'Not in a session' });
      return;
    }

    const newStory: Story = {
      id: uuidv4(),
      title,
      description,
      votes: [],
      revealed: false
    };

    session.stories.push(newStory);
    
    // Envoyer à tous les membres de la session
    io.to(session.id).emit('storiesUpdated', session.stories);
    console.log(`Story added: ${title} to session ${session.id}`);
  });

  // Révéler les votes
  socket.on('reveal', () => {
    const session = getSessionBySocket(socket.id);
    if (!session) return;
    
    const story = session.stories[0];
    story.revealed = true;
    
    io.to(session.id).emit('update', {
      votes: story.votes,
      revealed: story.revealed
    });
  });

  // Réinitialiser le vote de l'utilisateur
  socket.on('resetme', () => {
    const session = getSessionBySocket(socket.id);
    if (!session) return;
    
    const story = session.stories[0];
    story.votes = story.votes.filter(v => v.userId !== socket.id);
    
    io.to(session.id).emit('update', {
      votes: story.votes,
      revealed: story.revealed
    });
  });

  // Réinitialiser tous les votes
  socket.on('resetall', () => {
    const session = getSessionBySocket(socket.id);
    if (!session) return;
    
    const story = session.stories[0];
    story.votes = [];
    story.revealed = false;
    
    io.to(session.id).emit('update', {
      votes: story.votes,
      revealed: story.revealed
    });
  });

  // Gérer la déconnexion
  socket.on('disconnect', () => {
    const session = getSessionBySocket(socket.id);
    if (!session) return;

    console.log(`User disconnected: ${socket.id}`);

    // Retirer les votes de cet utilisateur
    const story = session.stories[0];
    if (story) {
      story.votes = story.votes.filter(v => v.userId !== socket.id);
      io.to(session.id).emit('update', {
        votes: story.votes,
        revealed: story.revealed
      });
    }

    // Retirer l'utilisateur de la session
    const member = session.members.find(m => m.socketId === socket.id);
    session.members = session.members.filter(m => m.socketId !== socket.id);
    
    // Notifier les autres membres
    if (member) {
      socket.to(session.id).emit('memberLeft', { 
        userName: member.userName,
        memberCount: session.members.length 
      });
    }
  });
});

// REST endpoints
app.post('/session', (req, res) => {
  const sessionId = uuidv4();
  sessions[sessionId] = { 
    id: sessionId, 
    members: [], 
    stories: [] 
  };
  console.log(`Session created: ${sessionId}`);
  res.status(201).json({ sessionId });
});

app.get('/session/:id', (req, res) => {
  const session = sessions[req.params.id];
  if (session) {
    res.json({ 
      id: session.id, 
      memberCount: session.members.length,
      storyCount: session.stories.length 
    });
  } else {
    res.status(404).json({ message: 'Session not found' });
  }
});

// Endpoint pour récupérer les histoires d'une session
app.get('/session/:id/stories', (req, res) => {
  const session = sessions[req.params.id];
  if (session) {
    res.json(session.stories);
  } else {
    res.status(404).json({ message: 'Session not found' });
  }
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});