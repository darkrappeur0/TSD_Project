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
const stories = [];
let currentStoryId = null;
// Sessions now include a list of user stories
const sessions = {};
// Initialize default story
function initializeDefaultStory() {
    const defaultStory = {
        id: (0, uuid_1.v4)(),
        title: "Default Story",
        votes: [],
        revealed: false
    };
    stories.push(defaultStory);
    currentStoryId = defaultStory.id;
    return defaultStory;
}
io.on('connection', (socket) => {
    var _a, _b;
    console.log(`User connected: ${socket.id}`);
    const sessionId = (0, uuid_1.v4)();
    if (!sessions[sessionId]) {
        sessions[sessionId] = {
            id: sessionId,
            members: [],
            stories: []
        };
    }
    sessions[sessionId].members.push(socket.id);
    if (stories.length === 0) {
        initializeDefaultStory();
    }
    socket.emit('sessionID', sessionId);
    socket.emit('update', {
        votes: ((_a = stories.find(s => s.id === currentStoryId)) === null || _a === void 0 ? void 0 : _a.votes) || [],
        revealed: ((_b = stories.find(s => s.id === currentStoryId)) === null || _b === void 0 ? void 0 : _b.revealed) || false
    });
    // Return stories
    socket.emit('storiesUpdated', sessions[sessionId].stories);
    // Vote
    socket.on('vote', (value) => {
        const story = stories.find(s => s.id === currentStoryId);
        if (!story)
            return;
        const userVote = story.votes.find(v => v.userId === socket.id);
        if (userVote) {
            userVote.value = value;
        }
        else {
            story.votes.push({ userId: socket.id, value });
        }
        updateVotes(story);
    });
    // Reveal votes
    socket.on('reveal', () => {
        const story = stories.find(s => s.id === currentStoryId);
        if (!story)
            return;
        story.revealed = true;
        updateVotes(story);
    });
    // Reset all
    socket.on('resetall', () => {
        const story = stories.find(s => s.id === currentStoryId);
        if (!story)
            return;
        story.votes = [];
        story.revealed = false;
        updateVotes(story);
    });
    // Reset me
    socket.on('resetme', () => {
        const story = stories.find(s => s.id === currentStoryId);
        if (!story)
            return;
        story.votes = story.votes.filter(v => v.userId !== socket.id);
        updateVotes(story);
    });
    // Add user story
    socket.on('addStory', (data) => {
        const { title, description } = data;
        const story = {
            id: (0, uuid_1.v4)(),
            title,
            description
        };
        const session = sessions[sessionId];
        if (session) {
            session.stories.push(story);
            io.emit('storiesUpdated', session.stories);
        }
    });
    socket.on('disconnect', () => {
        const story = stories.find(s => s.id === currentStoryId);
        if (story) {
            story.votes = story.votes.filter(v => v.userId !== socket.id);
            updateVotes(story);
        }
    });
});
// Update votes for all clients
function updateVotes(story) {
    io.emit('update', {
        votes: story.votes,
        revealed: story.revealed
    });
}
// REST API
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
