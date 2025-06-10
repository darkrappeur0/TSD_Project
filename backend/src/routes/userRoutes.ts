import express, { Request, Response } from 'express';
import { User } from '../models/User'; // Ensure this import is correct
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose'; // Import mongoose for ObjectId if needed for JWT payload

const router = express.Router();

// Register
router.post('/register', async (req: Request, res: Response): Promise<void> => {
  try {
    const hashedPassword = await bcrypt.hash(req.body.password, 10);
    // Use passwordHash here to match the User model's schema and interface
    const user = new User({ username: req.body.username, passwordHash: hashedPassword }); // <-- CHANGED TO passwordHash
    await user.save();
    res.json({ message: 'User registered successfully!' }); // Added 'successfully'
    return; // <-- Added return for consistency
  } catch (err: any) { // Type 'any' for err for now, or define a specific error type
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
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await User.findOne({ username: req.body.username });
    if (!user) {
      res.status(404).json({ message: 'User not found.' }); // Consistent message
      return;
    }
    
    // Compare the provided password with the hashed password from the user object
    const valid = await bcrypt.compare(req.body.password, user.passwordHash); // <-- CHANGED TO user.passwordHash
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
    const token = jwt.sign(
      { userId: user._id.toString(), username: user.username }, // <-- userId as string, added username
      secret,
      { expiresIn: '1h' }
    );

    res.json({ token });
    return; // <-- Added return for consistency
  } catch (err: any) { // Type 'any' for err for now
    console.error('Error during login:', err); // More descriptive logging
    res.status(500).json({ message: 'Error logging in.' });
    return; // <-- Added return
  }
});

export default router;