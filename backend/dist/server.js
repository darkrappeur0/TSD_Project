"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const socket_io_1 = require("socket.io");
const path_1 = __importDefault(require("path"));
const uuid_1 = require("uuid");
const cors_1 = __importDefault(require("cors"));
const app = (0, express_1.default)();
const server = http_1.default.createServer(app);
const io = new socket_io_1.Server(server);
app.use((0, cors_1.default)());
app.use(express_1.default.json());
const PORT = 3000;
const frontendPath = path_1.default.join(__dirname, '..', '..', 'frontend');
app.use(express_1.default.static(frontendPath));
app.get('/', (req, res) => {
    res.sendFile(path_1.default.join(frontendPath, 'index.html'));
});
const sessions = {};
// Initialize default story for the session
function initializeDefaultStory(sessionId) {
    const defaultStory = {
        id: (0, uuid_1.v4)(),
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
function getSessionBySocket(socketId) {
    return Object.values(sessions).find(session => session.members.includes(socketId));
}
// Socket events
// Socket events
io.on('connection', (socket) => {
    const sessionId = (0, uuid_1.v4)(); // Pour l'instant créer une nouvelle session pour chaque utilisateur, tu devras probablement le modifier
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
    socket.on('vote', (value) => {
        const session = getSessionBySocket(socket.id);
        if (!session)
            return;
        const story = session.stories[0];
        const userVote = story.votes.find(v => v.userId === socket.id);
        if (userVote) {
            userVote.value = value;
        }
        else {
            story.votes.push({ userId: socket.id, value });
        }
        updateVotes(session.id, story); // Assurer que tous les clients reçoivent la mise à jour
    });
    // Ajouter une nouvelle histoire
    socket.on('addStory', (data) => {
        const { title, description } = data;
        const newStory = {
            id: (0, uuid_1.v4)(),
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
        if (!session)
            return;
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
        if (!session)
            return;
        const story = session.stories[0];
        story.revealed = true;
        updateVotes(session.id, story);
    });
    // Réinitialiser uniquement ce client
    socket.on('resetme', () => {
        const session = getSessionBySocket(socket.id);
        if (!session)
            return;
        const story = session.stories[0];
        story.votes = story.votes.filter(v => v.userId !== socket.id);
        updateVotes(session.id, story);
    });
    // Réinitialiser tous les votes
    socket.on('resetall', () => {
        const session = getSessionBySocket(socket.id);
        if (!session)
            return;
        const story = session.stories[0];
        story.votes = [];
        story.revealed = false;
        updateVotes(session.id, story);
    });
});
// Function to update votes
function updateVotes(sessionId, story) {
    const session = sessions[sessionId];
    if (!session)
        return;
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
    const sessionId = (0, uuid_1.v4)();
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
