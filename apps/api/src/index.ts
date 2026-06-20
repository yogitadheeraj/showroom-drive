import cors from 'cors';
import express from 'express';
import mongoose from 'mongoose';
import { getApps, deleteApp } from 'firebase-admin/app';
import { env } from './config/env.js';
import { initFirebaseAdmin } from './config/firebaseAdmin.js';
import { attachAuthUser } from './middleware/auth.js';
import { apiRouter } from './routes/index.js';
import { processEmailQueues } from './services/emailProcessorService.js';
import { runTestDriveReminderJobs } from './services/testDriveReminderService.js';
import { processConfiguredReportDispatchJobs } from './services/reportDeliveryService.js';

const app = express();

// CORS configuration: allow multiple origins for development
const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Allow requests without origin (like mobile apps, curl, postman)
    if (!origin) {
      callback(null, true);
      return;
    }

    const allowedOrigins = [
      env.corsOrigin, // Default from .env (typically http://localhost:8080)
      'http://localhost:8080',
      'http://localhost:8081',
      'http://localhost:8082',
      'http://127.0.0.1:8080',
      'http://127.0.0.1:8081',
      'http://127.0.0.1:8082',
    ];

    // In production, only allow configured origin
    if (env.nodeEnv === 'production') {
      if (origin === env.corsOrigin) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    } else {
      // In development, allow localhost origins
      if (allowedOrigins.includes(origin) || origin.startsWith('http://localhost:')) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    }
  },
  credentials: true,
};

app.use(cors(corsOptions));
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

  // Background email queue processor — runs every 30 seconds
  const EMAIL_PROCESSOR_INTERVAL_MS = 30_000;
  const emailInterval = setInterval(async () => {
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
  const reminderInterval = setInterval(() => {
    void runTestDriveReminderJobs();
  }, REMINDER_INTERVAL_MS);

  // Configured report dispatch scheduler — runs every 5 minutes
  const REPORT_DISPATCH_INTERVAL_MS = 5 * 60_000;
  void processConfiguredReportDispatchJobs();
  const reportDispatchInterval = setInterval(async () => {
    try {
      const result = await processConfiguredReportDispatchJobs();
      if (result.processed > 0 || result.failures > 0) {
        console.log(
          `[reportDispatch] processed=${result.processed} skipped=${result.skipped} failures=${result.failures}`,
        );
      }
    } catch (err) {
      console.error('[reportDispatch] Error while processing configured report jobs', err);
    }
  }, REPORT_DISPATCH_INTERVAL_MS);

  const server = app.listen(env.port, () => {
    console.log(`API listening on http://localhost:${env.port}`);
  });

  async function shutdown(signal: string) {
    console.log(`[shutdown] ${signal} received — closing gracefully`);
    clearInterval(emailInterval);
    clearInterval(reminderInterval);
    clearInterval(reportDispatchInterval);
    server.close();
    await mongoose.disconnect();
    const apps = getApps();
    if (apps.length) await deleteApp(apps[0]);
    process.exit(0);
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));
}

start().catch((error) => {
  console.error('Failed to start API', error);
  process.exit(1);
});