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
// Socket events
io.on('connection', (socket) => {
    const sessionId = (0, uuid_1.v4)(); // For now creating a new session for each user, you may want to change this
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
    socket.on('vote', (value) => {
        const story = sessions[sessionId].stories[0]; // Assuming voting for the first story
        const userVote = story.votes.find(v => v.userId === socket.id);
        if (userVote) {
            userVote.value = value;
        }
        else {
            story.votes.push({ userId: socket.id, value });
        }
        updateVotes(story);
    });
    // Add new story
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
function updateVotes(story) {
    io.emit('update', {
        votes: story.votes,
        revealed: story.revealed
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
