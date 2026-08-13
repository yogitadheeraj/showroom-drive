import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

dotenv.config();

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

const DEFAULT_CORS_ORIGINS = [
  'http://localhost:8080',
  'http://localhost:8081',
  'https://www.autoadvant.com',
  'https://autoadvant.com',
  'https://autoadvant-staging.web.app',
  'https://autoadvant-staging.firebaseapp.com',
  'https://autoadvant.web.app',
  'https://autoadvant.firebaseapp.com',
];

const parseOrigins = (value?: string) =>
  (value || '')
    .split(',')
    .map((origin) => origin.trim().replace(/^['"]|['"]$/g, ''))
    .filter(Boolean);

const configuredCorsOrigins = [
  ...parseOrigins(process.env.CORS_ORIGINS),
  ...parseOrigins(process.env.CORS_ORIGIN),
];

const mergedCorsOrigins = Array.from(new Set([
  ...DEFAULT_CORS_ORIGINS,
  ...configuredCorsOrigins,
]));

export const env = {
  host: process.env.HOST || '0.0.0.0',
  port: Number(process.env.PORT || 4000),
  nodeEnv: process.env.NODE_ENV || 'development',
  mongoUri: process.env.MONGODB_URI || '',
  corsOrigin: mergedCorsOrigins[0] || 'http://localhost:8080',
  corsOrigins: mergedCorsOrigins,
  firebaseProjectId: process.env.FIREBASE_PROJECT_ID || '',
  firebaseClientEmail: process.env.FIREBASE_CLIENT_EMAIL || '',
  firebasePrivateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
  firebaseDatabaseUrl: process.env.FIREBASE_DATABASE_URL || '',
  storageRoot: process.env.STORAGE_ROOT
    ? path.resolve(process.env.STORAGE_ROOT)
    : path.resolve(appRoot, 'uploads'),
  publicApiUrl: process.env.PUBLIC_API_URL || 'http://localhost:4000',
  smtpHost: process.env.SMTP_HOST || '',
  smtpPort: Number(process.env.SMTP_PORT || 0),
  smtpSecure: process.env.SMTP_SECURE === 'true',
  smtpUser: process.env.SMTP_USER || '',
  smtpPass: process.env.SMTP_PASS || '',
  mailFrom: process.env.MAIL_FROM || '',
  // OAuth — Google Calendar
  googleOAuthClientId: process.env.GOOGLE_OAUTH_CLIENT_ID || '',
  googleOAuthClientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET || '',
  // OAuth — Microsoft (Outlook)
  outlookOAuthClientId: process.env.OUTLOOK_OAUTH_CLIENT_ID || '',
  outlookOAuthClientSecret: process.env.OUTLOOK_OAUTH_CLIENT_SECRET || '',
  outlookOAuthTenantId: process.env.OUTLOOK_OAUTH_TENANT_ID || 'common',
  // OAuth state signing secret
  oauthStateSecret: process.env.OAUTH_STATE_SECRET || 'change-me-in-production',
  // Public frontend URL (used for customer-facing links in emails)
  publicFrontendUrl: process.env.PUBLIC_FRONTEND_URL || 'http://localhost:8080',
  // AI report generation (optional)
  aiApiBaseUrl: process.env.AI_API_BASE_URL || 'https://api.openai.com/v1',
  aiApiKey: process.env.AI_API_KEY || '',
  aiModel: process.env.AI_MODEL || 'gpt-4.1-mini',
};
