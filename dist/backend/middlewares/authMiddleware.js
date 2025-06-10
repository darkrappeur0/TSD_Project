"use strict";
// backend/src/middlewares/authMiddleware.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticateToken = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const authenticateToken = (req, res, next) => {
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
    jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            console.error("JWT verification failed:", err.message);
            res.status(403).json({ message: 'Invalid or expired token.' });
            return; // <--- IMPORTANT: Explicitly return void after sending response
        }
        req.user = user;
        next();
    });
};
exports.authenticateToken = authenticateToken;
//# sourceMappingURL=authMiddleware.js.map