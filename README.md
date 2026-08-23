# Auto Advant

## Monorepo Setup

This repository is now structured as a monorepo foundation:

- Existing frontend app remains at repository root (Vite + React)
- New Node.js API lives in `apps/api` (Express + Mongoose)
- Shared package lives in `packages/shared`

## Localhost Ports

- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:4000`

## Install

Run install from repository root with your preferred package manager.

```bash
npm install
```

## Run Apps

Run each app in separate terminals:

```bash
npm run dev:api
npm run dev:web
```

## Environment Setup

1. Copy `.env.example` to `.env`
2. Fill Firebase web config values for frontend login
3. Optional for analytics: set `VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX` in `.env`
4. Copy `apps/api/.env.example` to `apps/api/.env`
5. Set `MONGODB_URI`
6. Add Firebase Admin credentials (`FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`) in `apps/api/.env`

## Conversion Status

Supabase client usage has been replaced with a compatibility adapter that routes to:

- Firebase Authentication for login/session
- Node.js API (`apps/api`) for database reads/writes
- Local file storage endpoints for uploads/public URLs/signed URLs
- RPC/function invocation endpoints on API

## API Structure

The backend is organized into controllers, services, models, routes, and middleware:

- Controllers: request/response handlers
- Services: database, storage, RPC/function business logic
- Models: dynamic Mongo collection model resolver
- Middleware: Firebase token attachment and auth guards
