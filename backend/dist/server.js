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
let stories = [];
let currentStoryId = null;
const sessions = {};
io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);
    // Create a new session or use an existing one
    const sessionId = (0, uuid_1.v4)(); // Generate a new session ID for each new connection
    if (!sessions[sessionId]) {
        sessions[sessionId] = { id: sessionId, members: [] };
    }
    // Add the user to the session
    sessions[sessionId].members.push(socket.id);
    // Emit the session ID to the frontend
    socket.emit('sessionID', sessionId);
    socket.on('vote', (value) => {
        if (!currentStoryId)
            return;
        const story = stories.find(s => s.id === currentStoryId);
        if (!story)
            return;
        let user = story.votes.find(v => v.userId === socket.id);
        if (!user) {
            story.votes.push({ userId: socket.id, value });
        }
        else {
            user.value = value;
        }
        updateVotes(story);
    });
    socket.on('resetall', () => {
        if (!currentStoryId)
            return;
        const story = stories.find(s => s.id === currentStoryId);
        if (!story)
            return;
        story.votes = [];
        story.revealed = false;
        updateVotes(story);
    });
    socket.on('resetme', () => {
        if (!currentStoryId)
            return;
        const story = stories.find(s => s.id === currentStoryId);
        if (!story)
            return;
        story.votes = story.votes.filter(vote => vote.userId !== socket.id);
        story.revealed = false;
        updateVotes(story);
    });
    socket.on('reveal', () => {
        if (!currentStoryId)
            return;
        const story = stories.find(s => s.id === currentStoryId);
        if (!story)
            return;
        story.revealed = true;
        updateVotes(story);
    });
    socket.on('disconnect', () => {
        if (!currentStoryId)
            return;
        const story = stories.find(s => s.id === currentStoryId);
        if (!story)
            return;
        story.votes = story.votes.filter(v => v.userId !== socket.id);
        updateVotes(story);
        // Remove the user from the session
        const session = Object.values(sessions).find(s => s.members.includes(socket.id));
        if (session) {
            session.members = session.members.filter(id => id !== socket.id);
        }
    });
    socket.emit('stories', stories);
});
function updateVotes(story) {
    io.emit('update', { storyId: story.id, votes: story.votes, revealed: story.revealed });
}
app.post('/session', (req, res) => {
    const sessionId = (0, uuid_1.v4)();
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
    const id = (0, uuid_1.v4)();
    const story = { id, title, votes: [], revealed: false };
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
    if (!exists)
        return res.status(404).json({ message: 'Story not found' });
    currentStoryId = id;
    io.emit('stories', stories);
    res.status(200).json({ selected: id });
});
server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
