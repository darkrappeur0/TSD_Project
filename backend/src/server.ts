import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import storyRoutes from './routes/storyRoutes';
import userRoutes from './routes/userRoutes';
import { WebSocketServer } from 'ws';

dotenv.config();

const app = express();
const port = 4000;

// Middlewares
app.use(cors());
app.use(bodyParser.json());

// Routes
app.use('/api/stories', storyRoutes);
app.use('/api/users', userRoutes);

// DB connection
mongoose.connect(process.env.MONGO_URL || 'mongodb://localhost/tsd', {})
    .then(() => console.log('MongoDB connected'))
    .catch(err => console.error('MongoDB error:', err));

// HTTP server
const server = app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});

// WebSocket server
const wss = new WebSocketServer({ server });

wss.on('connection', ws => {
    console.log('New WebSocket connection');

    ws.on('message', message => {
        console.log(`WS message received: ${message}`);
        wss.clients.forEach(client => {
            if (client !== ws && client.readyState === ws.OPEN) {
                client.send(message);
            }
        });
    });
});
