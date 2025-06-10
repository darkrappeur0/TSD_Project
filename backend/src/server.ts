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
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/planningpoker';

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
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now },
  stories: [{
    id: String,
    title: String,
    description: String,
    finalEstimate: String,
    estimatedAt: Date
  }],
  participants: [String], // usernames
  isActive: { type: Boolean, default: true }
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
    const userSessions = await SessionModel.find({ userId: req.user._id })
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
      userId: req.user._id.toString(),
      members: [], 
      stories: [] 
    };

    // Create session in database
    const sessionDoc = new SessionModel({
      sessionId,
      userId: req.user._id,
      stories: [],
      participants: []
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
    const sessionDoc = await SessionModel.findOne({ 
      sessionId: req.params.id,
      userId: req.user._id 
    });
    
    if (!sessionDoc) {
      return res.status(404).json({ message: 'Session not found' });
    }

    const session = sessions[req.params.id];
    res.json({ 
      id: req.params.id, 
      memberCount: session ? session.members.length : 0,
      storyCount: sessionDoc.stories.length,
      createdAt: sessionDoc.createdAt,
      isActive: sessionDoc.isActive
    });
  } catch (error) {
    console.error('Error fetching session:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/session/:id/stories', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const sessionDoc = await SessionModel.findOne({ 
      sessionId: req.params.id,
      userId: req.user._id 
    });
    
    if (!sessionDoc) {
      return res.status(404).json({ message: 'Session not found' });
    }

    res.json(sessionDoc.stories || []);
  } catch (error) {
    console.error('Error fetching session stories:', error);
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
      // Check if session exists and belongs to user
      const sessionDoc = await SessionModel.findOne({ 
        sessionId,
        userId: authenticatedSocket.user._id 
      });

      if (!sessionDoc) {
        socket.emit('error', { message: 'Session not found or access denied' });
        return;
      }

      // Check if session exists in memory
      if (!sessions[sessionId]) {
        sessions[sessionId] = {
          id: sessionId,
          userId: authenticatedSocket.user._id.toString(),
          members: [],
          stories: []
        };
      }

      // Check if user owns this session
      if (sessions[sessionId].userId !== authenticatedSocket.user._id.toString()) {
        socket.emit('error', { message: 'Access denied' });
        return;
      }

      socket.join(sessionId);
      
      sessions[sessionId].members.push({
        socketId: socket.id,
        userName: userName
      });

      // Update participants in database
      if (!sessionDoc.participants.includes(userName)) {
        sessionDoc.participants.push(userName);
        await sessionDoc.save();
      }

      socket.emit('sessionJoined', { 
        sessionId, 
        userName,
        stories: sessions[sessionId].stories 
      });

      const currentStory = sessions[sessionId].stories[0];
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

    const story = session.stories[0];
    if (!story) return;

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

  socket.on('reveal', async () => {
    const session = getSessionBySocket(socket.id);
    if (!session) return;
    
    const story = session.stories[0];
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
    
    const story = session.stories[0];
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
    
    const story = session.stories[0];
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

    const story = session.stories[0];
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