const express = require('express');
const { ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

module.exports = (db) => {
  const router = express.Router();
  const usersCollection = db.collection('iv_users');

  const generateToken = (user) => {
    return jwt.sign(
      {
        uid: user._id.toString(),
        email: user.email,
        name: user.name,
        photo: user.photoURL || '',
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
  };

  router.post('/register', async (req, res) => {
    try {
      const { name, email, password, photoURL } = req.body;

      if (!name || !email || !password) {
        return res.status(400).json({ message: 'Name, email, and password are required' });
      }

      const existingUser = await usersCollection.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ message: 'Email already registered' });
      }

      if (password.length < 6) {
        return res.status(400).json({ message: 'Password must be at least 6 characters' });
      }
      if (!/[A-Z]/.test(password)) {
        return res.status(400).json({ message: 'Password must include an uppercase letter' });
      }
      if (!/[a-z]/.test(password)) {
        return res.status(400).json({ message: 'Password must include a lowercase letter' });
      }

      const hashedPassword = await bcrypt.hash(password, 12);

      const newUser = {
        name,
        email,
        password: hashedPassword,
        photoURL: photoURL || '',
        provider: 'email',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await usersCollection.insertOne(newUser);
      const user = { ...newUser, _id: result.insertedId };

      const token = generateToken(user);

      res.status(201).json({
        message: 'Registration successful',
        token,
        user: {
          uid: result.insertedId.toString(),
          name: user.name,
          email: user.email,
          photoURL: user.photoURL,
        },
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  router.post('/login', async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required' });
      }

      const user = await usersCollection.findOne({ email });
      if (!user) {
        return res.status(401).json({ message: 'Invalid email or password' });
      }

      if (user.provider === 'google') {
        return res.status(401).json({ message: 'Please login with Google' });
      }

      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ message: 'Invalid email or password' });
      }

      const token = generateToken(user);

      res.json({
        message: 'Login successful',
        token,
        user: {
          uid: user._id.toString(),
          name: user.name,
          email: user.email,
          photoURL: user.photoURL,
        },
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  router.post('/google', async (req, res) => {
    try {
      const { uid, name, email, photoURL } = req.body;

      if (!uid || !email) {
        return res.status(400).json({ message: 'UID and email required' });
      }

      let user = await usersCollection.findOne({ email });

      if (!user) {
        const newUser = {
          firebaseUid: uid,
          name,
          email,
          photoURL: photoURL || '',
          provider: 'google',
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        const result = await usersCollection.insertOne(newUser);
        user = { ...newUser, _id: result.insertedId };
      } else {
        await usersCollection.updateOne(
          { email },
          { $set: { name, photoURL, firebaseUid: uid, updatedAt: new Date() } }
        );
        user.name = name;
        user.photoURL = photoURL;
        user.firebaseUid = uid;
      }

      const jwtPayload = {
        uid: user.firebaseUid || uid,
        email: user.email,
        name: user.name,
        photo: user.photoURL || '',
      };
      const token = jwt.sign(jwtPayload, process.env.JWT_SECRET, { expiresIn: '7d' });

      res.json({
        message: 'Google login successful',
        token,
        user: {
          uid: user.firebaseUid || uid,
          name: user.name,
          email: user.email,
          photoURL: user.photoURL,
        },
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  return router;
};
