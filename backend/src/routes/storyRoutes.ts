import express from 'express';
import Story from '../models/Story';

const router = express.Router();

// Get all stories
router.get('/', async (req, res) => {
    const stories = await Story.find();
    res.json(stories);
});

// Create story
router.post('/', async (req, res) => {
    const story = new Story(req.body);
    await story.save();
    res.json(story);
});

// Delete story
router.delete('/:id', async (req, res) => {
    await Story.findByIdAndDelete(req.params.id);
    res.json({ message: 'Story deleted' });
});

export default router;
