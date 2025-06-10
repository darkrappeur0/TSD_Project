import express from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import cors from 'cors';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';

// Extended Socket interface with user property
interface AuthenticatedSocket extends Socket {
  user: {
    _id: string;
    username: string;
    email: string;
    password: string;
    createdAt: Date;
  };
}

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = 3000;
const JWT_SECRET ='f5896879ac8e35bb293578c4efd09b9f982f9f3fa522ed2494fcafd186dd8abe2ec0ade4066febbca696ae962006536eb4d2f36814ce96916660f80a64f84e4b';
const MONGODB_URI ='mongodb+srv://darksas7777:AgvOMCYrJS36z02G@cluster0.3jb4pcx.mongodb.net/Cluster0?retryWrites=true&w=majority&appName=Cluster0';

// MongoDB Connection
mongoose.connect(MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// User Schema
const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

// Session Schema
const SessionSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, unique: true },
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // Changé de userId à ownerId
  createdAt: { type: Date, default: Date.now },
  stories: [{
    id: String,
    title: String,
    description: String,
    finalEstimate: String,
    estimatedAt: Date
  }],
  participants: [String], // usernames
  isActive: { type: Boolean, default: true },
  isPublic: { type: Boolean, default: true } // Ajout pour sessions publiques
});

const User = mongoose.model('User', UserSchema);
const SessionModel = mongoose.model('Session', SessionSchema);

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files
const frontendPath = path.join(__dirname, '..', '..', 'frontend');
app.use(express.static(frontendPath));

// JWT Middleware
interface AuthRequest extends Request {
  user?: any;
}

function isSessionOwner(sessionId: string, userId: string): boolean {
  const session = sessions[sessionId];
  return session && session.userId === userId;
}

const authenticateToken = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }
    req.user = user;
    next();
  } catch (error) {
    return res.status(403).json({ message: 'Invalid token' });
  }
};

// Types
type Vote = { userId: string; userName?: string; value: string | null };
type Story = { id: string; title: string; description: string; votes: Vote[]; revealed: boolean };

const sessions: {
  [id: string]: {
    id: string;
    userId: string;
    members: Array<{socketId: string, userName?: string}>;
    stories: Story[];
    currentStoryId?: string; 
  };
} = {};

// Routes

// Main routes
app.get('/', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(frontendPath, 'login.html'));
});

app.get('/register', (req, res) => {
  res.sendFile(path.join(frontendPath, 'register.html'));
});

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(frontendPath, 'dashboard.html'));
});

app.get('/session', (req, res) => {
  res.sendFile(path.join(frontendPath, 'session.html'));
});

// Auth Routes
app.post('/api/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    const existingUser = await User.findOne({ 
      $or: [{ email }, { username }] 
    });

    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({
      username,
      email,
      password: hashedPassword
    });

    await user.save();

    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '24h' });
    
    res.status(201).json({
      message: 'User created successfully',
      token,
      user: { id: user._id, username: user.username, email: user.email }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '24h' });
    
    res.json({
      message: 'Login successful',
      token,
      user: { id: user._id, username: user.username, email: user.email }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Protected Routes
app.get('/api/profile', authenticateToken, async (req: AuthRequest, res) => {
  res.json({
    user: {
      id: req.user._id,
      username: req.user.username,
      email: req.user.email,
      createdAt: req.user.createdAt
    }
  });
});

app.get('/api/sessions', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userSessions = await SessionModel.find({ ownerId: req.user._id }) // Changé de userId à ownerId
      .sort({ createdAt: -1 })
      .limit(20);
    
    res.json(userSessions);
  } catch (error) {
    console.error('Error fetching sessions:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/session', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const sessionId = uuidv4();
    
    // Create session in memory
    sessions[sessionId] = { 
      id: sessionId, 
      userId: req.user._id.toString(), // Ceci reste pour le propriétaire en mémoire
      members: [], 
      stories: [],
      currentStoryId: undefined
    };

    // Create session in database avec ownerId
    const sessionDoc = new SessionModel({
      sessionId,
      ownerId: req.user._id, // Changé de userId à ownerId
      stories: [],
      participants: [],
      isPublic: true // Sessions publiques par défaut
    });
    await sessionDoc.save();

    console.log(`Session created: ${sessionId} for user: ${req.user.username}`);
    res.status(201).json({ sessionId });
  } catch (error) {
    console.error('Error creating session:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/session/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const sessionDoc = await SessionModel.findOne({ sessionId: req.params.id });
    
    if (!sessionDoc) {
      return res.status(404).json({ message: 'Session not found' });
    }

    const session = sessions[req.params.id];
    const isOwner = sessionDoc.ownerId.toString() === req.user._id.toString();
    
    res.json({ 
      id: req.params.id, 
      memberCount: session ? session.members.length : 0,
      storyCount: sessionDoc.stories.length,
      createdAt: sessionDoc.createdAt,
      isActive: sessionDoc.isActive,
      isOwner: isOwner,
      participants: sessionDoc.participants
    });
  } catch (error) {
    console.error('Error fetching session:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/session/:id/stories', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const sessionDoc = await SessionModel.findOne({ sessionId: req.params.id });
    
    if (!sessionDoc) {
      return res.status(404).json({ message: 'Session not found' });
    }

    res.json(sessionDoc.stories || []);
  } catch (error) {
    console.error('Error fetching session stories:', error);
    res.status(500).json({ message: 'Server error' });
  }
});
app.get('/api/session/:id/current', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const sessionDoc = await SessionModel.findOne({ 
      sessionId: req.params.id,
      userId: req.user._id 
    });
    
    if (!sessionDoc) {
      return res.status(404).json({ message: 'Session not found' });
    }

    const memorySession = sessions[req.params.id];
    
    res.json({ 
      id: req.params.id,
      stories: sessionDoc.stories || [],
      currentStoryId: memorySession?.currentStoryId || null,
      memberCount: memorySession ? memorySession.members.length : 0,
      isActive: sessionDoc.isActive
    });
  } catch (error) {
    console.error('Error fetching session:', error);
    res.status(500).json({ message: 'Server error' });
  }
});
app.get('/api/session/:id/join', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const sessionDoc = await SessionModel.findOne({ sessionId: req.params.id });
    
    if (!sessionDoc) {
      return res.status(404).json({ message: 'Session not found' });
    }

    if (!sessionDoc.isActive) {
      return res.status(403).json({ message: 'Session is not active' });
    }

    res.json({ 
      message: 'Session accessible',
      sessionId: req.params.id,
      canJoin: true
    });
  } catch (error) {
    console.error('Error checking session access:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Socket Authentication Middleware
const authenticateSocket = async (socket: Socket, next: (err?: Error) => void) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication error'));
    }

    const decoded = jwt.verify(token, JWT_SECRET) as any;
    const user = await User.findById(decoded.userId);
    if (!user) {
      return next(new Error('User not found'));
    }

    // Add user property to socket with proper typing
    (socket as any).user = {
      _id: user._id.toString(),
      username: user.username,
      email: user.email,
      password: user.password,
      createdAt: user.createdAt
    };
    
    next();
  } catch (error) {
    next(new Error('Authentication error'));
  }
};

// Apply socket authentication
io.use(authenticateSocket);

// Helper functions
function getSessionBySocket(socketId: string) {
  return Object.values(sessions).find(session =>
    session.members.some(member => member.socketId === socketId)
  );
}

async function saveSessionEstimate(sessionId: string, storyId: string, estimate: string) {
  try {
    await SessionModel.updateOne(
      { sessionId, 'stories.id': storyId },
      { 
        $set: { 
          'stories.$.finalEstimate': estimate,
          'stories.$.estimatedAt': new Date()
        }
      }
    );
  } catch (error) {
    console.error('Error saving estimate:', error);
  }
}

// Socket events
io.on('connection', (socket: Socket) => {
  // Type assertion after authentication middleware has run
  const authenticatedSocket = socket as AuthenticatedSocket;
  
  console.log(`User connected: ${socket.id} (${authenticatedSocket.user.username})`);

  socket.on('joinSession', async (data) => {
  const { sessionId } = data;
  const userName = authenticatedSocket.user.username;
  
  console.log(`User ${userName} (${socket.id}) trying to join session ${sessionId}`);

  try {
    // Chercher la session dans la DB (sans restriction d'utilisateur)
    const sessionDoc = await SessionModel.findOne({ sessionId });

    if (!sessionDoc) {
      socket.emit('error', { message: 'Session not found' });
      return;
    }

    // Vérifier si la session est active
    if (!sessionDoc.isActive) {
      socket.emit('error', { message: 'Session is not active' });
      return;
    }

    // Check if session exists in memory, create if not
    if (!sessions[sessionId]) {
  sessions[sessionId] = {
    id: sessionId,
    userId: sessionDoc.ownerId.toString(),
    members: [],
    stories: sessionDoc.stories.map(story => ({
      id: story.id,
      title: story.title || '', // Default to empty string if null/undefined
      description: story.description || '', // Default to empty string if null/undefined
      votes: [],
      revealed: false
    })) || [],
    currentStoryId: undefined
  };
}

    socket.join(sessionId);
    
    // Ajouter le membre s'il n'est pas déjà présent
    const existingMember = sessions[sessionId].members.find(m => m.socketId === socket.id);
    if (!existingMember) {
      sessions[sessionId].members.push({
        socketId: socket.id,
        userName: userName
      });
    }

    // Update participants in database
    if (!sessionDoc.participants.includes(userName)) {
      sessionDoc.participants.push(userName);
      await sessionDoc.save();
    }

    socket.emit('sessionJoined', { 
      sessionId, 
      userName,
      stories: sessions[sessionId].stories,
      isOwner: sessionDoc.ownerId.toString() === authenticatedSocket.user._id.toString()
    });

    const currentStory = sessions[sessionId].currentStoryId 
      ? sessions[sessionId].stories.find(s => s.id === sessions[sessionId].currentStoryId)
      : sessions[sessionId].stories[0];
      
    if (currentStory) {
      socket.emit('update', {
        votes: currentStory.votes,
        revealed: currentStory.revealed
      });
    }

    socket.to(sessionId).emit('memberJoined', { 
      userName,
      memberCount: sessions[sessionId].members.length 
    });

    console.log(`User ${userName} successfully joined session ${sessionId}`);

  } catch (error) {
    console.error('Error joining session:', error);
    socket.emit('error', { message: 'Server error' });
  }
});

  socket.on('vote', (value: string) => {
  const session = getSessionBySocket(socket.id);
  if (!session) {
    socket.emit('error', { message: 'Not in a session' });
    return;
  }

  // Utilisez currentStoryId au lieu de stories[0]
  const story = session.currentStoryId 
    ? session.stories.find(s => s.id === session.currentStoryId)
    : session.stories[0]; // Fallback pour compatibilité

  if (!story) {
    socket.emit('error', { message: 'No story selected for voting' });
    return;
  }

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

  io.to(session.id).emit('update', {
    votes: story.votes,
    revealed: story.revealed
  });

  console.log(`Vote received: ${value} from ${member?.userName || socket.id}`);
});

  socket.on('addStory', async (data) => {
  const { title, description } = data;
  const session = getSessionBySocket(socket.id);
  
  if (!session) {
    socket.emit('error', { message: 'Not in a session' });
    return;
  }

  // Seul le propriétaire peut ajouter des stories (optionnel)
  const sessionDoc = await SessionModel.findOne({ sessionId: session.id });
  if (sessionDoc && sessionDoc.ownerId.toString() !== authenticatedSocket.user._id.toString()) {
    socket.emit('error', { message: 'Only session owner can add stories' });
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
  
  // Save to database
  try {
    await SessionModel.updateOne(
      { sessionId: session.id },
      { 
        $push: { 
          stories: {
            id: newStory.id,
            title,
            description,
            finalEstimate: '',
            estimatedAt: null
          }
        }
      }
    );
  } catch (error) {
    console.error('Error saving story:', error);
  }
  
  io.to(session.id).emit('storiesUpdated', session.stories);
  console.log(`Story added: ${title} to session ${session.id}`);
});

  socket.on('selectStory', async (data) => {
  const { storyId } = data;
  const session = getSessionBySocket(socket.id);
  
  if (!session) {
    socket.emit('error', { message: 'Not in a session' });
    return;
  }

  const story = session.stories.find(s => s.id === storyId);
  if (!story) {
    socket.emit('error', { message: 'Story not found' });
    return;
  }

  // Set current story
  session.currentStoryId = storyId;
  
  // Reset votes for new story
  story.votes = [];
  story.revealed = false;
  
  io.to(session.id).emit('storySelected', {
    story: {
      id: story.id,
      title: story.title,
      description: story.description
    }
  });
  
  io.to(session.id).emit('update', {
    votes: story.votes,
    revealed: story.revealed
  });

  console.log(`Story selected: ${story.title} in session ${session.id}`);
});

  socket.on('reveal', async () => {
  const session = getSessionBySocket(socket.id);
  if (!session) return;
  
  const story = session.currentStoryId 
    ? session.stories.find(s => s.id === session.currentStoryId)
    : session.stories[0];
    
  if (!story) return;

  story.revealed = true;
  
  // Calculate final estimate (most common vote)
  const voteCounts = story.votes.reduce((acc: any, vote) => {
    if (vote.value) {
      acc[vote.value] = (acc[vote.value] || 0) + 1;
    }
    return acc;
  }, {});

  const finalEstimate = Object.keys(voteCounts).reduce((a, b) => 
    voteCounts[a] > voteCounts[b] ? a : b, '');

  if (finalEstimate) {
    await saveSessionEstimate(session.id, story.id, finalEstimate);
  }
  
  io.to(session.id).emit('update', {
    votes: story.votes,
    revealed: story.revealed,
    finalEstimate
  });
});

  socket.on('resetme', () => {
  const session = getSessionBySocket(socket.id);
  if (!session) return;
  
  const story = session.currentStoryId 
    ? session.stories.find(s => s.id === session.currentStoryId)
    : session.stories[0];
    
  if (!story) return;

  story.votes = story.votes.filter(v => v.userId !== socket.id);
  
  io.to(session.id).emit('update', {
    votes: story.votes,
    revealed: story.revealed
  });
});

  socket.on('resetall', () => {
  const session = getSessionBySocket(socket.id);
  if (!session) return;
  
  const story = session.currentStoryId 
    ? session.stories.find(s => s.id === session.currentStoryId)
    : session.stories[0];
    
  if (!story) return;

  story.votes = [];
  story.revealed = false;
  
  io.to(session.id).emit('update', {
    votes: story.votes,
    revealed: story.revealed
  });
});

  socket.on('disconnect', () => {
  const session = getSessionBySocket(socket.id);
  if (!session) return;

  console.log(`User disconnected: ${socket.id}`);

  const story = session.currentStoryId 
    ? session.stories.find(s => s.id === session.currentStoryId)
    : session.stories[0];
    
  if (story) {
    story.votes = story.votes.filter(v => v.userId !== socket.id);
    io.to(session.id).emit('update', {
      votes: story.votes,
      revealed: story.revealed
    });
  }

  const member = session.members.find(m => m.socketId === socket.id);
  session.members = session.members.filter(m => m.socketId !== socket.id);
  
  if (member) {
    socket.to(session.id).emit('memberLeft', { 
      userName: member.userName,
      memberCount: session.members.length 
    });
  }
});
});




server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});