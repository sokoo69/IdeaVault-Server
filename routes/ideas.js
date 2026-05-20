const express = require('express');
const { ObjectId } = require('mongodb');
const { authenticateToken } = require('../middleware/auth');

module.exports = (db) => {
  const router = express.Router();
  const ideasCollection = db.collection('ideas');
  const commentsCollection = db.collection('comments');

  router.get('/', async (req, res) => {
    try {
      const { search, category, sort } = req.query;
      let query = {};
      if (search) query.title = { $regex: search, $options: 'i' };
      if (category && category !== 'All') query.category = category;

      let sortOpt = { createdAt: -1 };
      if (sort === 'oldest') sortOpt = { createdAt: 1 };
      if (sort === 'popular') sortOpt = { likes: -1, createdAt: -1 };

      const ideas = await ideasCollection.find(query).sort(sortOpt).limit(100).toArray();
      res.json(ideas);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });

  router.get('/trending', async (req, res) => {
    try {
      const ideas = await ideasCollection.aggregate([
        {
          $addFields: {
            timeInHours: {
              $divide: [
                { $subtract: [new Date(), "$createdAt"] },
                3600000
              ]
            }
          }
        },
        {
          $addFields: {
            score: {
              $divide: [
                { $add: [ { $ifNull: ["$likes", 0] }, { $multiply: [{ $ifNull: ["$commentCount", 0] }, 2] } ] },
                { $pow: [ { $add: ["$timeInHours", 2] }, 1.5 ] }
              ]
            }
          }
        },
        { $sort: { score: -1 } },
        { $limit: 6 }
      ]).toArray();
      res.json(ideas);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });

  router.get('/:id', async (req, res) => {
    try {
      const idea = await ideasCollection.findOne({ _id: new ObjectId(req.params.id) });
      if (!idea) return res.status(404).json({ message: 'Idea not found' });
      const commentCount = await commentsCollection.countDocuments({ ideaId: new ObjectId(req.params.id) });
      idea.commentCount = commentCount;
      res.json(idea);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });

  router.post('/:id/like', authenticateToken, async (req, res) => {
    try {
      const ideaId = new ObjectId(req.params.id);
      const idea = await ideasCollection.findOne({ _id: ideaId });
      if (!idea) return res.status(404).json({ message: 'Idea not found' });

      const userId = req.user.uid;
      const hasLiked = (idea.likedBy || []).includes(userId);

      let update;
      let filter = { _id: ideaId };

      if (hasLiked) {
        filter.likedBy = userId;
        update = { $inc: { likes: -1 }, $pull: { likedBy: userId } };
      } else {
        filter.likedBy = { $ne: userId };
        update = { $inc: { likes: 1 }, $push: { likedBy: userId } };
      }

      const result = await ideasCollection.findOneAndUpdate(filter, update, { returnDocument: 'after' });

      if (!result) {
        const currentIdea = await ideasCollection.findOne({ _id: ideaId });
        return res.json({ 
          liked: (currentIdea.likedBy || []).includes(userId), 
          likes: currentIdea.likes || 0 
        });
      }

      res.json({ 
        liked: (result.likedBy || []).includes(userId), 
        likes: result.likes || 0 
      });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });

  router.post('/:id/bookmark', authenticateToken, async (req, res) => {
    try {
      const idea = await ideasCollection.findOne({ _id: new ObjectId(req.params.id) });
      if (!idea) return res.status(404).json({ message: 'Idea not found' });

      const userId = req.user.uid;
      const bookmarkedBy = idea.bookmarkedBy || [];
      const hasBookmarked = bookmarkedBy.includes(userId);

      const update = hasBookmarked
        ? { $pull: { bookmarkedBy: userId } }
        : { $push: { bookmarkedBy: userId } };

      await ideasCollection.updateOne({ _id: new ObjectId(req.params.id) }, update);
      res.json({ bookmarked: !hasBookmarked });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });

  router.post('/', authenticateToken, async (req, res) => {
    try {
      const {
        title, shortDescription, detailedDescription,
        category, tags, imageUrl, estimatedBudget,
        targetAudience, problemStatement, proposedSolution,
      } = req.body;

      if (!title || !shortDescription || !category) {
        return res.status(400).json({ message: 'Title, short description, and category are required' });
      }

      const newIdea = {
        title, shortDescription, detailedDescription: detailedDescription || '',
        category, tags: tags || [],
        imageUrl: imageUrl || '', estimatedBudget: estimatedBudget || '',
        targetAudience: targetAudience || '', problemStatement: problemStatement || '',
        proposedSolution: proposedSolution || '',
        authorId: req.user.uid,
        authorName: req.user.name || 'Anonymous',
        authorPhoto: req.user.photo || '',
        likes: 0, likedBy: [], commentCount: 0,
        createdAt: new Date(), updatedAt: new Date(),
      };

      const result = await ideasCollection.insertOne(newIdea);
      res.status(201).json({ message: 'Idea created!', idea: { _id: result.insertedId, ...newIdea } });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });

  router.put('/:id', authenticateToken, async (req, res) => {
    try {
      const idea = await ideasCollection.findOne({ _id: new ObjectId(req.params.id) });
      if (!idea) return res.status(404).json({ message: 'Idea not found' });
      if (idea.authorId !== req.user.uid) return res.status(403).json({ message: 'Not authorized' });

      const allowed = ['title','shortDescription','detailedDescription','category','tags','imageUrl','estimatedBudget','targetAudience','problemStatement','proposedSolution'];
      const updates = { updatedAt: new Date() };
      allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });

      await ideasCollection.updateOne({ _id: new ObjectId(req.params.id) }, { $set: updates });
      res.json({ message: 'Idea updated!', idea: { ...idea, ...updates } });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });

  router.delete('/:id', authenticateToken, async (req, res) => {
    try {
      const idea = await ideasCollection.findOne({ _id: new ObjectId(req.params.id) });
      if (!idea) return res.status(404).json({ message: 'Idea not found' });
      if (idea.authorId !== req.user.uid) return res.status(403).json({ message: 'Not authorized' });

      await ideasCollection.deleteOne({ _id: new ObjectId(req.params.id) });
      await commentsCollection.deleteMany({ ideaId: new ObjectId(req.params.id) });
      res.json({ message: 'Idea deleted!' });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });

  return router;
};
