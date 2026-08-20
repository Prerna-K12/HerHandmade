# People's Awareness Network — Simplified

A trimmed-down rebuild of the original Team-59 project: one login, three roles
(admin / leader / artisan), orders that flow admin → leader → artisan, a basic
dashboard, and announcements. No rewards, quality checklists, notifications,
or password-reset flow — cut on purpose to keep the codebase small enough to
fully explain.

## Stack
- **Backend:** Node.js, Express, MongoDB (Mongoose), JWT auth, plain JavaScript (no TypeScript)
- **Frontend:** React + Vite, React Router, Axios, plain CSS (no UI library)

## How the roles work
- **Admin** creates orders and creates leader accounts. Assigns orders to a leader.
- **Leader** creates artisan accounts (their own cluster). Assigns orders (once
  assigned to them) to one of their artisans.
- **Artisan** sees orders assigned to them and marks them completed.

Order status flow: `created` → (admin assigns leader) → `assigned` →
(leader assigns artisan) → `in_progress` → (artisan finishes) → `completed`.

## Setup

### 1. Backend
```bash
cd backend
cp .env.example .env      # edit MONGO_URI and JWT_SECRET if needed
npm install
npm run seed               # creates admin@pan.local / admin123
npm run dev                 # starts on http://localhost:5000
```

### 2. Frontend
```bash
cd frontend
npm install
npm run dev                 # starts on http://localhost:5173
```

The Vite dev server proxies `/api/*` to `http://localhost:5000`, so no CORS
config is needed locally.

### 3. Log in
Go to http://localhost:5173, log in as `admin@pan.local` / `admin123`.
From there:
1. Go to **Leaders** and create a leader account.
2. Log out, log in as that leader, go to **My Artisans**, create an artisan.
3. Log back in as admin, go to **Orders**, create an order, assign it to the leader.
4. Log in as the leader, assign the order to the artisan.
5. Log in as the artisan, mark the order completed.

## What's genuinely done vs. what still needs work
- Backend: all routes syntax-checked; logic traced by hand; **not yet run
  against a live MongoDB** (my sandbox couldn't download a test DB binary —
  do this first on your machine before trusting it fully).
- Frontend: installs cleanly, builds cleanly, zero dependency conflicts.
- No automated tests yet (Jest/Supertest for backend, React Testing Library
  for frontend) — that's the natural next step once you've confirmed it runs.
- No deployment config yet.

## Why it's structured this way (for when someone asks)
- **Plain JS, not TS:** fewer moving parts to defend under interview pressure;
  add TypeScript later once you're fluent in the untyped version.
- **One login page:** role lives on the User document and is checked
  server-side on every request — the frontend just reflects it, it doesn't
  enforce it. That's the actual security boundary.
- **JWT in localStorage + Authorization header:** simplest working auth for
  a learning project; a refresh-token/httpOnly-cookie setup is the natural
  "what would you improve" answer if asked.
