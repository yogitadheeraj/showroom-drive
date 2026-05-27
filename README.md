# Showroom Drive

## Monorepo Setup

This repository is now structured as a monorepo foundation:

- Existing frontend app remains at repository root (Vite + React)
- New Node.js API lives in `apps/api` (Express + Mongoose)
- Shared package lives in `packages/shared`

## Install

Run install from repository root with your preferred package manager.
## Run Apps
## Run Apps

- Frontend: `npm run dev:web`
- API: `npm run dev:api`

## API Environment

1. Copy `apps/api/.env.example` to `apps/api/.env`
2. Set `MONGODB_URI`

## Migration Direction (Supabase -> Node + MongoDB)

Suggested incremental migration path:

1. Add API endpoints in `apps/api` for auth/user management/test drives
2. Switch frontend pages from direct Supabase calls to API calls one feature at a time
3. Migrate data from Postgres to MongoDB collections in phases
4. Remove Supabase dependencies after all traffic flows through API
