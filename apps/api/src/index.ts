import cors from 'cors';
import express from 'express';
import mongoose from 'mongoose';
import { getApps, deleteApp } from 'firebase-admin/app';
import { env } from './config/env.js';
import { initFirebaseAdmin } from './config/firebaseAdmin.js';
import { attachAuthUser } from './middleware/auth.js';
import { apiRouter } from './routes/index.js';
import { Vehicle } from './models/Vehicle.js';
import { processEmailQueues } from './services/emailProcessorService.js';
import { runTestDriveReminderJobs } from './services/testDriveReminderService.js';
import { runTimesheetReminderJobs } from './services/timesheetReminderService.js';

const app = express();
let startupReady = false;
let emailInterval: NodeJS.Timeout | null = null;
let reminderInterval: NodeJS.Timeout | null = null;
let timesheetReminderInterval: NodeJS.Timeout | null = null;

const normalizeOrigin = (value?: string) => {
  if (!value) return '';
  return value.trim().replace(/^['"]|['"]$/g, '').replace(/\/$/, '').toLowerCase();
};

const allowedOrigins = new Set(
  [...env.corsOrigins, env.corsOrigin]
    .map(normalizeOrigin)
    .filter(Boolean),
);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);

    const normalizedOrigin = normalizeOrigin(origin);
    if (allowedOrigins.has(normalizedOrigin) || allowedOrigins.has('*')) {
      return callback(null, true);
    }

    console.warn(`[cors] Blocked origin: ${origin}`);

    callback(null, false);
  },
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(attachAuthUser);
app.use('/uploads', express.static(env.storageRoot));

app.get('/health', (_req, res) => {
  res.status(200).json({
    ok: true,
    service: 'api',
    ready: startupReady,
    mongoState: mongoose.connection.readyState,
  });
});

app.use('/api', apiRouter);

async function start() {
  if (!env.mongoUri) {
    throw new Error('MONGODB_URI is required. Copy apps/api/.env.example to apps/api/.env');
  }

  const server = app.listen(env.port, () => {
    console.log(`API listening on http://localhost:${env.port}`);
  });

  const shutdown = async (signal: string) => {
    console.log(`[shutdown] ${signal} received — closing gracefully`);
    if (emailInterval) clearInterval(emailInterval);
    if (reminderInterval) clearInterval(reminderInterval);
    if (timesheetReminderInterval) clearInterval(timesheetReminderInterval);
    server.close();
    await mongoose.disconnect();
    const apps = getApps();
    if (apps.length) await deleteApp(apps[0]);
    process.exit(0);
  };

  process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
  });
  process.on('SIGINT', () => {
    void shutdown('SIGINT');
  });

  initFirebaseAdmin();
  await mongoose.connect(env.mongoUri);

  try {
    await mongoose.connection.collection('vehicles').dropIndex('vin_1').catch(() => undefined);
    await mongoose.connection.collection('vehicles').dropIndex('vin_sparse_idx').catch(() => undefined);
    await Vehicle.syncIndexes();
  } catch (error) {
    console.warn('[vehicle-indexes] Failed to sync vehicle indexes:', error);
  }

  // Background email queue processor — runs every 30 seconds
  const EMAIL_PROCESSOR_INTERVAL_MS = 30_000;
  emailInterval = setInterval(async () => {
    try {
      const result = await processEmailQueues();
      if (result.processed > 0) {
        console.log(`[emailProcessor] Processed ${result.processed} emails`);
      }
    } catch (err) {
      console.error('[emailProcessor] Error during queue processing', err);
    }
  }, EMAIL_PROCESSOR_INTERVAL_MS);

  // Test drive reminder scheduler — runs every 15 minutes
  const REMINDER_INTERVAL_MS = 15 * 60_000;
  // Run once immediately on startup to catch any missed reminders
  void runTestDriveReminderJobs();
  reminderInterval = setInterval(() => {
    void runTestDriveReminderJobs();
  }, REMINDER_INTERVAL_MS);

  // Timesheet reminder scheduler — runs every 5 minutes
  const TIMESHEET_REMINDER_INTERVAL_MS = 5 * 60_000;
  void runTimesheetReminderJobs();
  timesheetReminderInterval = setInterval(() => {
    void runTimesheetReminderJobs();
  }, TIMESHEET_REMINDER_INTERVAL_MS);

  startupReady = true;
}

start().catch((error) => {
  console.error('Failed to start API', error);
  process.exit(1);
});