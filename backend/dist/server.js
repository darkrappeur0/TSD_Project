"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const path_1 = __importDefault(require("path"));
const uuid_1 = require("uuid");
const cors_1 = __importDefault(require("cors"));
const app = (0, express_1.default)();
const server = (0, http_1.createServer)(app);
const io = new socket_io_1.Server(server);
// CORS et JSON
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Chemin vers le frontend
const frontendPath = path_1.default.join(__dirname, '..', '..', 'frontend');
app.use(express_1.default.static(frontendPath)); // Cela permet de servir les fichiers statiques du frontend
// Route principale vers index.html
app.get('/', (req, res) => {
    res.sendFile(path_1.default.join(frontendPath, 'index.html'));
});
const sessions = {};
const socketToSession = {};
app.post('/session', (req, res) => {
    const sessionId = (0, uuid_1.v4)();
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
    if (!session)
        return res.status(404).json({ message: 'Session not found' });
    res.json(session.stories);
});
app.post('/session/:id/story', (req, res) => {
    const session = sessions[req.params.id];
    if (!session)
        return res.status(404).json({ message: 'Session not found' });
    const { title, description } = req.body;
    if (!title || !description)
        return res.status(400).json({ message: 'Missing title or description' });
    if (session.stories.some(story => story.title === title)) {
        return res.status(409).json({ message: 'Story with this title already exists' });
    }
    const newStory = {
        id: (0, uuid_1.v4)(),
        title,
        description,
        points: null,
        votes: {},
    };
    session.stories.push(newStory);
    io.to(session.id).emit('storyListUpdate', session.stories); // Emit update to all connected clients
    res.status(201).json(newStory);
});
app.delete('/session/:id/story/:storyId', (req, res) => {
    const session = sessions[req.params.id];
    if (!session)
        return res.status(404).json({ message: 'Session not found' });
    session.stories = session.stories.filter(s => s.id !== req.params.storyId);
    if (session.selectedStoryId === req.params.storyId) {
        session.selectedStoryId = null;
    }
    io.to(session.id).emit('storyListUpdate', session.stories); // Emit update to all connected clients
    res.status(204).send();
});
io.on('connection', (socket) => {
    const sessionId = socket.handshake.query.sessionId;
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
        if (!session)
            return;
        session.votes[socket.id] = value;
        io.to(sessionId).emit('update', { votes: Object.entries(session.votes).map(([user, value]) => ({ user, value })), revealed: session.revealed });
    });
    socket.on('selectStory', (storyId) => {
        const session = sessions[sessionId];
        if (!session)
            return;
        session.selectedStoryId = storyId;
        io.to(sessionId).emit('selectedStoryUpdate', storyId); // Emit selected story update to all clients
    });
    socket.on('reveal', () => {
        const session = sessions[sessionId];
        if (!session)
            return;
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
        if (!session)
            return;
        delete session.votes[socket.id];
        socket.emit('update', { votes: Object.entries(session.votes).map(([user, value]) => ({ user, value })), revealed: false });
    });
    socket.on('resetall', () => {
        const session = sessions[sessionId];
        if (!session)
            return;
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
