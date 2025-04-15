import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import path from 'path';

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Définir le chemin absolu vers le dossier 'frontend'
const frontendPath = path.join(__dirname, '..', '..', 'frontend');

// Servir les fichiers statiques du dossier 'frontend'
app.use(express.static(frontendPath));

// Route pour la racine
app.get('/', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

type Vote = { userId: string; value: string | null };
type Session = { votes: Vote[]; revealed: boolean };

let session: Session = { votes: [], revealed: false };

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on('vote', (value: string) => {
    let user = session.votes.find(v => v.userId === socket.id);
    if (!user) {
      session.votes.push({ userId: socket.id, value });
    } else {
      user.value = value;
    }
    updateVotes();
  });

   socket.on('resetall', () => {
    session.votes = [];
    session.revealed = false;
    updateVotes();
  }); 
  socket.on('resetme', () => {
    // On enlève uniquement le vote de l'utilisateur correspondant à ce socket
    session.votes = session.votes.filter(vote => vote.userId !== socket.id);
    session.revealed = false;
    updateVotes();
  });
  

  socket.on('reveal', () => {
    session.revealed = true;
    updateVotes();
  });

  socket.on('disconnect', () => {
    session.votes = session.votes.filter(v => v.userId !== socket.id);
    updateVotes();
  });

  socket.emit('update', session);
});

function updateVotes() {
  io.emit('update', session);
}

server.listen(3000, () => {
  console.log('Server is running on http://localhost:3000');
});