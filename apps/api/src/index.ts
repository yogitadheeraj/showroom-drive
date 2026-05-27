import cors from 'cors';
import express from 'express';
import mongoose from 'mongoose';
import { env } from './config/env.js';
import { initFirebaseAdmin } from './config/firebaseAdmin.js';
import { attachAuthUser } from './middleware/auth.js';
import { apiRouter } from './routes/index.js';

const app = express();

app.use(cors({ origin: env.corsOrigin, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(attachAuthUser);
app.use('/uploads', express.static(env.storageRoot));

app.get('/health', (_req, res) => {
  res.status(200).json({ ok: true, service: 'api' });
});

app.use('/api', apiRouter);

async function start() {
  if (!env.mongoUri) {
    throw new Error('MONGODB_URI is required. Copy apps/api/.env.example to apps/api/.env');
  }

  initFirebaseAdmin();
  await mongoose.connect(env.mongoUri);

  app.listen(env.port, () => {
    console.log(`API listening on http://localhost:${env.port}`);
  });
}

start().catch((error) => {
  console.error('Failed to start API', error);
  process.exit(1);
});