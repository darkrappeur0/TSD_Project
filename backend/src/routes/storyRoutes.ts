// backend/src/routes/storyRoutes.ts

import { Router } from 'express';
import { Story } from '../models/Story';
import { authenticateToken } from '../middlewares/authMiddleware';

const router = Router();

// Créer une nouvelle histoire (utilisée si vous avez une gestion d'histoires globale)
router.post('/', authenticateToken, async (req, res) => {
    const { title, description, tasks } = req.body;
    const userId = (req as any).user.userId;

    try {
        const newStory = new Story({ title, description, tasks, createdBy: userId });
        await newStory.save();
        res.status(201).json(newStory);
        return; // <--- ADDED: Explicitly return void after sending response
    } catch (error: any) {
        res.status(500).json({ message: error.message });
        return; // <--- ADDED: Explicitly return void after sending response
    }
});

// Obtenir toutes les histoires (protégé)
router.get('/', authenticateToken, async (req, res) => {
    try {
        const stories = await Story.find();
        res.status(200).json(stories);
        return; // <--- ADDED: Explicitly return void after sending response
    } catch (error: any) {
        res.status(500).json({ message: error.message });
        return; // <--- ADDED: Explicitly return void after sending response
    }
});

// Obtenir une histoire par ID (protégé)
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const story = await Story.findById(req.params.id);
        if (!story) {
            res.status(404).json({ message: 'Histoire introuvable.' });
            return; // <--- ADDED: Explicitly return void after sending response
        }
        res.status(200).json(story);
        return; // <--- ADDED: Explicitly return void after sending response
    } catch (error: any) {
        res.status(500).json({ message: error.message });
        return; // <--- ADDED: Explicitly return void after sending response
    }
});

// Mettre à jour une histoire (protégé)
router.put('/:id', authenticateToken, async (req, res) => {
    try {
        const updatedStory = await Story.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!updatedStory) {
            res.status(404).json({ message: 'Histoire introuvable.' });
            return; // <--- ADDED: Explicitly return void after sending response
        }
        res.status(200).json(updatedStory);
        return; // <--- ADDED: Explicitly return void after sending response
    } catch (error: any) {
        res.status(500).json({ message: error.message });
        return; // <--- ADDED: Explicitly return void after sending response
    }
});

// Supprimer une histoire (protégé)
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const deletedStory = await Story.findByIdAndDelete(req.params.id);
        if (!deletedStory) {
            res.status(404).json({ message: 'Histoire introuvable.' });
            return; // <--- ADDED: Explicitly return void after sending response
        }
        res.status(200).json({ message: 'Histoire supprimée avec succès.' });
        return; // <--- ADDED: Explicitly return void after sending response
    } catch (error: any) {
        res.status(500).json({ message: error.message });
        return; // <--- ADDED: Explicitly return void after sending response
    }
});

export default router;