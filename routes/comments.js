const express = require('express');
const { ObjectId } = require('mongodb');
const { authenticateToken } = require('../middleware/auth');

module.exports = (db) => {
  const router = express.Router();
  const commentsCollection = db.collection('comments');
  const ideasCollection = db.collection('ideas');

  router.get('/:ideaId', async (req, res) => {
    try {
      const comments = await commentsCollection
        .find({ ideaId: new ObjectId(req.params.ideaId) })
        .sort({ createdAt: -1 })
        .toArray();
      res.json(comments);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });

  router.post('/', authenticateToken, async (req, res) => {
    try {
      const { ideaId, text } = req.body;
      if (!ideaId || !text?.trim()) {
        return res.status(400).json({ message: 'Idea ID and text are required' });
      }

      const newComment = {
        ideaId: new ObjectId(ideaId),
        userId: req.user.uid,
        userName: req.user.name || 'Anonymous',
        userPhoto: req.user.photo || '',
        text: text.trim(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await commentsCollection.insertOne(newComment);
      await ideasCollection.updateOne({ _id: new ObjectId(ideaId) }, { $inc: { commentCount: 1 } });

      res.status(201).json({ message: 'Comment added', comment: { _id: result.insertedId, ...newComment } });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });

  router.put('/:id', authenticateToken, async (req, res) => {
    try {
      const comment = await commentsCollection.findOne({ _id: new ObjectId(req.params.id) });
      if (!comment) return res.status(404).json({ message: 'Comment not found' });
      if (comment.userId !== req.user.uid) return res.status(403).json({ message: 'Not authorized' });

      const updated = { ...comment, text: req.body.text || comment.text, updatedAt: new Date() };
      await commentsCollection.updateOne({ _id: new ObjectId(req.params.id) }, { $set: updated });
      res.json({ message: 'Comment updated', comment: updated });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });

  router.delete('/:id', authenticateToken, async (req, res) => {
    try {
      const comment = await commentsCollection.findOne({ _id: new ObjectId(req.params.id) });
      if (!comment) return res.status(404).json({ message: 'Comment not found' });
      if (comment.userId !== req.user.uid) return res.status(403).json({ message: 'Not authorized' });

      await commentsCollection.deleteOne({ _id: new ObjectId(req.params.id) });
      await ideasCollection.updateOne({ _id: comment.ideaId }, { $inc: { commentCount: -1 } });
      res.json({ message: 'Comment deleted' });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });

  return router;
};
