const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri, {
  serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true }
});

let db;

async function connectDB() {
  try {
    await client.connect();
    db = client.db('ideavault');
    console.log('✅ Connected to MongoDB');
    startServer();
  } catch (error) {
    console.error('❌ MongoDB Connection Error:', error);
    process.exit(1);
  }
}

function startServer() {
  const { createAuth } = require('./lib/auth');
  const auth = createAuth(db);

  const { setAuthInstance } = require('./middleware/auth');
  setAuthInstance(auth);

  const allowedOrigins = [
    process.env.CLIENT_URL,
  ].filter(Boolean);

  app.use(cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) callback(null, true);
      else callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  }));

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  app.all('/api/auth/*', async (req, res) => {
    try {
      const url = `${process.env.BETTER_AUTH_URL}${req.path}${req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : ''}`;

      const headers = new Headers();
      Object.entries(req.headers).forEach(([key, value]) => {
        if (value) headers.set(key, Array.isArray(value) ? value[0] : value);
      });

      let body = undefined;
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        body = JSON.stringify(req.body);
        headers.set('content-type', 'application/json');
      }

      const webReq = new Request(url, {
        method: req.method,
        headers,
        body,
      });

      const webRes = await auth.handler(webReq);

      webRes.headers.forEach((value, key) => {
        res.setHeader(key, value);
      });

      res.status(webRes.status);

      const text = await webRes.text();
      res.send(text);
    } catch (err) {
      console.error('Auth handler error:', err);
      res.status(500).json({ message: 'Auth error' });
    }
  });

  const { authenticateToken } = require('./middleware/auth');
  app.use('/api/ideas', require('./routes/ideas.js')(db));
  app.use('/api/comments', require('./routes/comments.js')(db));
  app.use('/api/users', require('./routes/users.js')(db));

  app.get('/api/health', (req, res) => {
    res.json({ status: 'Server is running', timestamp: new Date() });
  });

  app.use((req, res) => {
    res.status(404).json({ message: 'Route not found' });
  });

  app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({ message: 'Internal server error' });
  });

  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
  });
}

connectDB();

process.on('SIGINT', async () => {
  console.log('\n✋ Shutting down...');
  await client.close();
  process.exit(0);
});
