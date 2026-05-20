const express = require('express');
const { authenticateToken } = require('../middleware/auth');

module.exports = (db) => {
  const router = express.Router();
  const ideasCollection = db.collection('ideas');
  const commentsCollection = db.collection('comments');

  router.get('/:userId/ideas', async (req, res) => {
    try {
      const ideas = await ideasCollection
        .find({ authorId: req.params.userId })
        .sort({ createdAt: -1 })
        .toArray();
      res.json(ideas);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });

  router.get('/:userId/interactions', async (req, res) => {
    try {
      const comments = await commentsCollection
        .find({ userId: req.params.userId })
        .sort({ createdAt: -1 })
        .toArray();

      const interactions = await Promise.all(
        comments.map(async (comment) => {
          const idea = await ideasCollection.findOne({ _id: comment.ideaId });
          return { comment, idea };
        })
      );
      res.json(interactions);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });

  router.get('/:userId/bookmarks', async (req, res) => {
    try {
      const ideas = await ideasCollection
        .find({ bookmarkedBy: req.params.userId })
        .sort({ createdAt: -1 })
        .toArray();
      res.json(ideas);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });

  router.put('/profile', authenticateToken, async (req, res) => {
    try {
      const usersCollection = db.collection('user'); // BetterAuth stores users in 'user'
      const { name, image } = req.body;
      const updates = { updatedAt: new Date() };
      if (name) updates.name = name;
      if (image !== undefined) updates.image = image;

      await usersCollection.updateOne({ _id: req.user.uid }, { $set: updates });
      res.json({ message: 'Profile updated' });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });

  return router;
};
