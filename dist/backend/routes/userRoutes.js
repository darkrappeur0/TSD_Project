"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const User_1 = require("../models/User"); // Ensure this import is correct
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const router = express_1.default.Router();
// Register
router.post('/register', async (req, res) => {
    try {
        const hashedPassword = await bcrypt_1.default.hash(req.body.password, 10);
        // Use passwordHash here to match the User model's schema and interface
        const user = new User_1.User({ username: req.body.username, passwordHash: hashedPassword }); // <-- CHANGED TO passwordHash
        await user.save();
        res.json({ message: 'User registered successfully!' }); // Added 'successfully'
        return; // <-- Added return for consistency
    }
    catch (err) { // Type 'any' for err for now, or define a specific error type
        console.error('Error during registration:', err); // More descriptive logging
        // Check for duplicate key error (e.g., username already exists)
        if (err.code === 11000) {
            res.status(409).json({ message: 'Username already exists.' });
            return; // <-- Added return
        }
        res.status(500).json({ message: 'Error registering user.' });
        return; // <-- Added return
    }
});
// Login
router.post('/login', async (req, res) => {
    try {
        const user = await User_1.User.findOne({ username: req.body.username });
        if (!user) {
            res.status(404).json({ message: 'User not found.' }); // Consistent message
            return;
        }
        // Compare the provided password with the hashed password from the user object
        const valid = await bcrypt_1.default.compare(req.body.password, user.passwordHash); // <-- CHANGED TO user.passwordHash
        if (!valid) {
            res.status(401).json({ message: 'Invalid credentials.' }); // More generic and secure message
            return;
        }
        const secret = process.env.JWT_SECRET;
        if (!secret) {
            console.error("JWT_SECRET is not defined in environment variables.");
            res.status(500).json({ message: 'Server configuration error: JWT secret missing.' });
            return;
        }
        // Ensure userId is a string when signing the token, and include username
        const token = jsonwebtoken_1.default.sign({ userId: user._id.toString(), username: user.username }, // <-- userId as string, added username
        secret, { expiresIn: '1h' });
        res.json({ token });
        return; // <-- Added return for consistency
    }
    catch (err) { // Type 'any' for err for now
        console.error('Error during login:', err); // More descriptive logging
        res.status(500).json({ message: 'Error logging in.' });
        return; // <-- Added return
    }
});
exports.default = router;
//# sourceMappingURL=userRoutes.js.map