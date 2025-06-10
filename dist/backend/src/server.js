"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const ws_1 = __importDefault(require("ws")); // Keep this for the global WebSocket if you need the client side type, but not for Server
const ws_2 = require("ws"); // <-- CORRECT IMPORT FOR THE SERVER
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
const userRoutes_1 = __importDefault(require("./routes/userRoutes"));
const storyRoutes_1 = __importDefault(require("./routes/storyRoutes"));
const authMiddleware_1 = require("./middlewares/authMiddleware");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const path_1 = __importDefault(require("path")); // <-- ADDED: Path module for serving static files
// Importez les nouveaux modèles
const Session_1 = require("./models/Session");
const Story_1 = require("./models/Story");
dotenv_1.default.config();
const app = (0, express_1.default)();
const server = http_1.default.createServer(app);
const wss = new ws_2.WebSocketServer({ server }); // <-- FIXED: Use WebSocketServer from 'ws'
// Connexion à MongoDB
// Assurez-vous que votre .env a MONGODB_URI, ou utilisez MONGO_URI si c'est ce que vous avez configuré
mongoose_1.default.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/planning_poker_db')
    .then(() => console.log('Connecté à MongoDB'))
    .catch(err => console.error('Erreur de connexion à MongoDB:', err));
app.use(express_1.default.json());
// Routes d'authentification et utilisateurs
app.use('/api/users', userRoutes_1.default);
// Routes d'histoires existantes (protégées)
// Note: authenticateToken est appliqué ici pour toutes les routes de storyRoutes
app.use('/api/stories', authMiddleware_1.authenticateToken, storyRoutes_1.default);
// --- Nouvelles Routes API pour les sessions ---
// Créer une nouvelle session
app.post('/api/sessions', authMiddleware_1.authenticateToken, async (req, res) => {
    const { sessionId } = req.body;
    // req.user est disponible grâce à authenticateToken et la déclaration globale
    const userId = req.user?.userId;
    const username = req.user?.username;
    if (!userId || !username) {
        res.status(401).json({ message: 'Utilisateur non authentifié.' });
        return; // <-- ADDED
    }
    if (!sessionId) {
        res.status(400).json({ message: 'L\'ID de session est requis.' });
        return; // <-- ADDED
    }
    try {
        const existingSession = await Session_1.Session.findOne({ sessionId });
        if (existingSession) {
            res.status(409).json({ message: 'Une session avec cet ID existe déjà.' });
            return; // <-- ADDED
        }
        const newSession = new Session_1.Session({
            sessionId,
            owner: userId,
            ownerUsername: username,
            members: [{ userId, username }],
            stories: [],
            currentStoryId: null,
        });
        await newSession.save();
        res.status(201).json({ message: 'Session créée avec succès!', sessionId: newSession.sessionId });
        return; // <-- ADDED
    }
    catch (error) {
        res.status(500).json({ message: error.message });
        return; // <-- ADDED
    }
});
// Rejoindre une session existante
app.post('/api/sessions/join', authMiddleware_1.authenticateToken, async (req, res) => {
    const { sessionId } = req.body;
    const userId = req.user?.userId; // This is a string
    const username = req.user?.username;
    if (!userId || !username) {
        res.status(401).json({ message: 'Utilisateur non authentifié.' });
        return;
    }
    if (!sessionId) {
        res.status(400).json({ message: 'L\'ID de session est requis.' });
        return;
    }
    try {
        let session = await Session_1.Session.findOne({ sessionId });
        if (!session) {
            res.status(404).json({ message: 'Session introuvable.' });
            return;
        }
        // Convert userId string to mongoose.Types.ObjectId for comparison
        const objectIdUserId = new mongoose_1.default.Types.ObjectId(userId);
        // Ajouter le membre s'il n'est pas déjà présent
        const isMember = session.members.some(member => member.userId.equals(objectIdUserId)); // Use the converted ObjectId
        if (!isMember) {
            session.members.push({ userId: objectIdUserId, username }); // Use the converted ObjectId
            await session.save();
        }
        broadcastSessionUpdate(session);
        res.status(200).json({ message: 'Session rejointe avec succès!', sessionId: session.sessionId });
        return;
    }
    catch (error) {
        res.status(500).json({ message: error.message });
        return;
    }
});
// Récupérer l'état d'une session (utilisé pour l'initialisation du frontend)
app.get('/api/sessions/:sessionId', authMiddleware_1.authenticateToken, async (req, res) => {
    const { sessionId } = req.params;
    const userId = req.user?.userId; // This is a string
    if (!userId) {
        res.status(401).json({ message: 'Utilisateur non authentifié.' });
        return;
    }
    try {
        const session = await Session_1.Session.findOne({ sessionId });
        if (!session) {
            res.status(404).json({ message: 'Session introuvable.' });
            return;
        }
        // Convert userId string to mongoose.Types.ObjectId for comparison
        const objectIdUserId = new mongoose_1.default.Types.ObjectId(userId);
        // Check if the user is a member of this session
        const isMember = session.members.some(member => member.userId.equals(objectIdUserId)); // Use the converted ObjectId
        if (!isMember) {
            res.status(403).json({ message: 'Accès non autorisé à cette session.' });
            return;
        }
        // Pass the converted ObjectId to formatSessionForClient as well
        res.status(200).json(formatSessionForClient(session, objectIdUserId));
        return;
    }
    catch (error) {
        res.status(500).json({ message: error.message });
        return;
    }
});
// Ajouter une histoire à une session
app.post('/api/sessions/:sessionId/stories', authMiddleware_1.authenticateToken, async (req, res) => {
    const { sessionId } = req.params;
    const { title, description, tasks } = req.body;
    const userId = req.user?.userId;
    if (!userId) {
        res.status(401).json({ message: 'Utilisateur non authentifié.' });
        return; // <-- ADDED
    }
    if (!title) {
        res.status(400).json({ message: 'Le titre de l\'histoire est requis.' });
        return; // <-- ADDED
    }
    try {
        const session = await Session_1.Session.findOne({ sessionId });
        if (!session) {
            res.status(404).json({ message: 'Session introuvable.' });
            return; // <-- ADDED
        }
        const isMember = session.members.some(member => member.userId.equals(userId));
        if (!isMember) {
            res.status(403).json({ message: 'Accès non autorisé à cette session.' });
            return; // <-- ADDED
        }
        const newStory = new Story_1.Story({ title, description, tasks, createdBy: userId });
        await newStory.save();
        const newStoryInSession = {
            storyId: newStory._id,
            title: newStory.title,
            description: newStory.description,
            tasks: newStory.tasks,
            votes: [],
            revealed: false,
            active: false,
            order: session.stories.length,
        }; // Removed 'as IStoryInSession' - better to ensure type matches
        session.stories.push(newStoryInSession);
        await session.save();
        broadcastSessionUpdate(session);
        res.status(201).json({ message: 'Histoire ajoutée à la session.', story: newStoryInSession });
        return; // <-- ADDED
    }
    catch (error) {
        res.status(500).json({ message: error.message });
        return; // <-- ADDED
    }
});
// Sélectionner une histoire pour le vote
app.post('/api/sessions/:sessionId/selectStory', authMiddleware_1.authenticateToken, async (req, res) => {
    const { sessionId } = req.params;
    const { storyInSessionId } = req.body;
    const userId = req.user?.userId;
    if (!userId) {
        res.status(401).json({ message: 'Utilisateur non authentifié.' });
        return; // <-- ADDED
    }
    try {
        const session = await Session_1.Session.findOne({ sessionId });
        if (!session) {
            res.status(404).json({ message: 'Session introuvable.' });
            return; // <-- ADDED
        }
        const isMember = session.members.some(member => member.userId.equals(userId));
        if (!isMember) {
            res.status(403).json({ message: 'Accès non autorisé.' });
            return; // <-- ADDED
        }
        // `session.stories.id` est une méthode de Mongoose pour Subdocuments
        const selectedStory = session.stories.id(storyInSessionId);
        if (!selectedStory) {
            res.status(404).json({ message: 'Histoire dans la session introuvable.' });
            return; // <-- ADDED
        }
        session.stories.forEach(s => {
            s.active = false;
            s.revealed = false;
            s.votes = [];
        });
        selectedStory.active = true;
        session.currentStoryId = selectedStory.storyId;
        await session.save();
        broadcastSessionUpdate(session);
        res.status(200).json({ message: 'Histoire sélectionnée avec succès.', currentStory: selectedStory });
        return; // <-- ADDED
    }
    catch (error) {
        res.status(500).json({ message: error.message });
        return; // <-- ADDED
    }
});
// Supprimer une histoire d'une session
app.delete('/api/sessions/:sessionId/stories/:storyInSessionId', authMiddleware_1.authenticateToken, async (req, res) => {
    const { sessionId, storyInSessionId } = req.params;
    const userId = req.user?.userId;
    if (!userId) {
        res.status(401).json({ message: 'Utilisateur non authentifié.' });
        return; // <-- ADDED
    }
    try {
        const session = await Session_1.Session.findOne({ sessionId });
        if (!session) {
            res.status(404).json({ message: 'Session introuvable.' });
            return; // <-- ADDED
        }
        const isOwner = session.owner.equals(userId);
        if (!isOwner) {
            res.status(403).json({ message: 'Seul le propriétaire peut supprimer une histoire.' });
            return; // <-- ADDED
        }
        const storyIndex = session.stories.findIndex(s => s._id?.toString() === storyInSessionId);
        if (storyIndex === -1) {
            res.status(404).json({ message: 'Histoire dans la session introuvable.' });
            return; // <-- ADDED
        }
        if (session.stories[storyIndex].active) {
            session.currentStoryId = null;
        }
        session.stories.splice(storyIndex, 1);
        await session.save();
        broadcastSessionUpdate(session);
        res.status(200).json({ message: 'Histoire supprimée de la session.' });
        return; // <-- ADDED
    }
    catch (error) {
        res.status(500).json({ message: error.message });
        return; // <-- ADDED
    }
});
// Map pour stocker les clients WebSocket par SessionId
const sessionClients = new Map();
wss.on('connection', async (ws, req) => {
    const urlParams = new URLSearchParams(req.url?.split('?')[1]);
    const token = urlParams.get('token');
    const sessionId = urlParams.get('sessionId');
    if (!token || !sessionId) {
        ws.send(JSON.stringify({ type: 'error', payload: { text: 'Token ou Session ID manquant.', type: 'error' } }));
        ws.close();
        return;
    }
    try {
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
        ws.userId = new mongoose_1.default.Types.ObjectId(decoded.userId);
        ws.username = decoded.username;
        ws.sessionId = sessionId;
        let session = await Session_1.Session.findOne({ sessionId });
        if (!session) {
            ws.send(JSON.stringify({ type: 'error', payload: { text: 'Session introuvable.', type: 'error' } }));
            ws.close();
            return;
        }
        const isMember = session.members.some(member => member.userId.equals(ws.userId));
        if (!isMember) {
            session.members.push({ userId: ws.userId, username: ws.username });
            await session.save();
        }
        if (!sessionClients.has(sessionId)) {
            sessionClients.set(sessionId, []);
        }
        sessionClients.get(sessionId)?.push(ws);
        console.log(`Client ${ws.username} connecté à la session ${ws.sessionId}`);
        ws.send(JSON.stringify({ type: 'sessionUpdate', payload: formatSessionForClient(session, ws.userId) }));
        broadcastSessionUpdate(session);
    }
    catch (error) {
        console.error('Erreur d\'authentification WebSocket:', error);
        ws.send(JSON.stringify({ type: 'error', payload: { text: 'Authentification WebSocket échouée.', type: 'error' } }));
        ws.close();
        return;
    }
    ws.on('message', async (message) => {
        console.log(`Message reçu de ${ws.username} dans la session ${ws.sessionId}:`, message.toString()); // Convert Buffer to string
        try {
            const parsedMessage = JSON.parse(message.toString()); // Convert Buffer to string for parsing
            const { type, payload } = parsedMessage;
            const session = await Session_1.Session.findOne({ sessionId: ws.sessionId });
            if (!session)
                return;
            const currentStoryInSession = session.stories.find(s => s.active);
            // 'joinSession' case is not expected here; it's handled on connection.
            // If you have other message types that don't need a current story, add them.
            if (!currentStoryInSession && (type === 'vote' || type === 'reveal' || type === 'resetme' || type === 'resetall')) {
                ws.send(JSON.stringify({ type: 'message', payload: { text: 'Veuillez sélectionner une histoire à voter.', type: 'warning' } }));
                return;
            }
            switch (type) {
                case 'vote':
                    if (currentStoryInSession && !currentStoryInSession.revealed) {
                        const existingVoteIndex = currentStoryInSession.votes.findIndex(v => v.userId.equals(ws.userId));
                        if (existingVoteIndex !== -1) {
                            currentStoryInSession.votes[existingVoteIndex].value = payload.value;
                        }
                        else {
                            currentStoryInSession.votes.push({
                                userId: ws.userId,
                                username: ws.username,
                                value: payload.value,
                            });
                        }
                        await session.save();
                        broadcastSessionUpdate(session);
                    }
                    else if (currentStoryInSession && currentStoryInSession.revealed) {
                        ws.send(JSON.stringify({ type: 'message', payload: { text: 'Les votes ont déjà été révélés pour cette histoire.', type: 'warning' } }));
                    }
                    break;
                case 'reveal':
                    if (session.owner.equals(ws.userId) && currentStoryInSession) {
                        currentStoryInSession.revealed = true;
                        await session.save();
                        broadcastSessionUpdate(session);
                    }
                    else {
                        ws.send(JSON.stringify({ type: 'message', payload: { text: 'Seul le propriétaire peut révéler les votes.', type: 'error' } }));
                    }
                    break;
                case 'resetme':
                    if (currentStoryInSession) {
                        currentStoryInSession.votes = currentStoryInSession.votes.filter(v => !v.userId.equals(ws.userId));
                        await session.save();
                        broadcastSessionUpdate(session);
                    }
                    break;
                case 'resetall':
                    if (session.owner.equals(ws.userId) && currentStoryInSession) {
                        currentStoryInSession.votes = [];
                        currentStoryInSession.revealed = false;
                        await session.save();
                        broadcastSessionUpdate(session);
                    }
                    else {
                        ws.send(JSON.stringify({ type: 'message', payload: { text: 'Seul le propriétaire peut réinitialiser tous les votes.', type: 'error' } }));
                    }
                    break;
                default:
                    console.warn(`Type de message WebSocket inconnu: ${type}`);
            }
        }
        catch (error) {
            console.error('Erreur lors du traitement du message WebSocket:', error);
            ws.send(JSON.stringify({ type: 'error', payload: { text: 'Erreur interne du serveur.', type: 'error' } }));
        }
    });
    ws.on('close', async () => {
        console.log(`Client ${ws.username} déconnecté de la session ${ws.sessionId}`);
        const clients = sessionClients.get(ws.sessionId);
        if (clients) {
            sessionClients.set(ws.sessionId, clients.filter(client => client !== ws));
        }
        try {
            const session = await Session_1.Session.findOne({ sessionId: ws.sessionId });
            if (session) {
                broadcastSessionUpdate(session);
            }
        }
        catch (error) {
            console.error('Erreur lors de la mise à jour de la session après déconnexion:', error);
        }
    });
});
// Fonction utilitaire pour formater la session avant de l'envoyer au client
const formatSessionForClient = (session, requestingUserId) => {
    const sessionCopy = session.toObject({ getters: true });
    // Cacher les votes si l'histoire n'est pas révélée et si l'utilisateur n'est pas le propriétaire
    sessionCopy.stories = sessionCopy.stories.map((story) => {
        if (!story.revealed) {
            story.votes = story.votes.map((vote) => ({
                ...vote,
                value: vote.userId.equals(requestingUserId) ? vote.value : 'hidden',
            }));
        }
        return story;
    });
    return {
        sessionId: sessionCopy.sessionId,
        ownerUsername: sessionCopy.ownerUsername,
        members: sessionCopy.members.map((m) => ({
            username: m.username,
            userId: m.userId?.toString() // Use optional chaining just in case, though it should exist
        })),
        stories: sessionCopy.stories.map((story) => ({
            _id: story._id?.toString(), // Convert ObjectId to string
            storyId: story.storyId?.toString(), // Convert ObjectId to string
            title: story.title,
            description: story.description,
            tasks: story.tasks,
            votes: story.votes.map((vote) => ({
                username: vote.username,
                value: vote.value,
                userId: vote.userId?.toString()
            })),
            revealed: story.revealed,
            active: story.active,
            order: story.order
        })),
        currentStoryId: sessionCopy.currentStoryId?.toString(), // Convert ObjectId to string
        createdAt: sessionCopy.createdAt,
        updatedAt: sessionCopy.updatedAt,
    };
};
// Fonction pour diffuser les mises à jour de session aux clients concernés
const broadcastSessionUpdate = async (session) => {
    const clients = sessionClients.get(session.sessionId);
    if (clients) {
        for (const client of clients) {
            if (client.readyState === ws_1.default.OPEN) {
                client.send(JSON.stringify({ type: 'sessionUpdate', payload: formatSessionForClient(session, client.userId) }));
            }
        }
    }
};
// --- Service des fichiers statiques pour le frontend ---
app.use(express_1.default.static(path_1.default.join(__dirname, '../../frontend/dist'))); // Use path.join for robustness
// Rediriger la route racine vers la page d'accueil de l'application
app.get('/', (req, res) => {
    res.sendFile(path_1.default.join(__dirname, '../../frontend/dist/index.html')); // Assuming index.html is the entry
});
// Pour la page de session, si l'utilisateur est déjà authentifié et a une session
// Note: If you have client-side routing, this might not be needed for every route.
// Just serving index.html for all unhandled routes usually works for SPA.
app.get('/index.html', (req, res) => {
    res.sendFile(path_1.default.join(__dirname, '../../frontend/dist/index.html'));
});
// Fallback for client-side routing (if using React Router, Vue Router, etc.)
app.get('*', (req, res) => {
    res.sendFile(path_1.default.join(__dirname, '../../frontend/dist/index.html'));
});
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Serveur démarré sur le port ${PORT}`);
});
//# sourceMappingURL=server.js.map