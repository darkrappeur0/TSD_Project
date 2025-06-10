"use strict";
// backend/src/routes/storyRoutes.ts
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const Story_1 = require("../models/Story");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const router = (0, express_1.Router)();
// Créer une nouvelle histoire (utilisée si vous avez une gestion d'histoires globale)
router.post('/', authMiddleware_1.authenticateToken, async (req, res) => {
    const { title, description, tasks } = req.body;
    const userId = req.user.userId;
    try {
        const newStory = new Story_1.Story({ title, description, tasks, createdBy: userId });
        await newStory.save();
        res.status(201).json(newStory);
        return; // <--- ADDED: Explicitly return void after sending response
    }
    catch (error) {
        res.status(500).json({ message: error.message });
        return; // <--- ADDED: Explicitly return void after sending response
    }
});
// Obtenir toutes les histoires (protégé)
router.get('/', authMiddleware_1.authenticateToken, async (req, res) => {
    try {
        const stories = await Story_1.Story.find();
        res.status(200).json(stories);
        return; // <--- ADDED: Explicitly return void after sending response
    }
    catch (error) {
        res.status(500).json({ message: error.message });
        return; // <--- ADDED: Explicitly return void after sending response
    }
});
// Obtenir une histoire par ID (protégé)
router.get('/:id', authMiddleware_1.authenticateToken, async (req, res) => {
    try {
        const story = await Story_1.Story.findById(req.params.id);
        if (!story) {
            res.status(404).json({ message: 'Histoire introuvable.' });
            return; // <--- ADDED: Explicitly return void after sending response
        }
        res.status(200).json(story);
        return; // <--- ADDED: Explicitly return void after sending response
    }
    catch (error) {
        res.status(500).json({ message: error.message });
        return; // <--- ADDED: Explicitly return void after sending response
    }
});
// Mettre à jour une histoire (protégé)
router.put('/:id', authMiddleware_1.authenticateToken, async (req, res) => {
    try {
        const updatedStory = await Story_1.Story.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!updatedStory) {
            res.status(404).json({ message: 'Histoire introuvable.' });
            return; // <--- ADDED: Explicitly return void after sending response
        }
        res.status(200).json(updatedStory);
        return; // <--- ADDED: Explicitly return void after sending response
    }
    catch (error) {
        res.status(500).json({ message: error.message });
        return; // <--- ADDED: Explicitly return void after sending response
    }
});
// Supprimer une histoire (protégé)
router.delete('/:id', authMiddleware_1.authenticateToken, async (req, res) => {
    try {
        const deletedStory = await Story_1.Story.findByIdAndDelete(req.params.id);
        if (!deletedStory) {
            res.status(404).json({ message: 'Histoire introuvable.' });
            return; // <--- ADDED: Explicitly return void after sending response
        }
        res.status(200).json({ message: 'Histoire supprimée avec succès.' });
        return; // <--- ADDED: Explicitly return void after sending response
    }
    catch (error) {
        res.status(500).json({ message: error.message });
        return; // <--- ADDED: Explicitly return void after sending response
    }
});
exports.default = router;
//# sourceMappingURL=storyRoutes.js.map