// backend/src/middlewares/authMiddleware.ts

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

declare global {
    namespace Express {
        interface Request {
            user?: { userId: string; username: string };
        }
    }
}

export const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ message: 'Authorization token not provided or malformed.' });
        return; // <--- IMPORTANT: Explicitly return void after sending response
    }

    const token = authHeader.split(' ')[1];

    if (!process.env.JWT_SECRET) {
        console.error("JWT_SECRET is not defined in environment variables.");
        res.status(500).json({ message: 'Server configuration error: JWT secret missing.' });
        return; // <--- IMPORTANT: Explicitly return void after sending response
    }

    jwt.verify(token, process.env.JWT_SECRET as string, (err: any, user: any) => {
        if (err) {
            console.error("JWT verification failed:", err.message);
            res.status(403).json({ message: 'Invalid or expired token.' });
            return; // <--- IMPORTANT: Explicitly return void after sending response
        }

        req.user = user;
        next();
    });
};