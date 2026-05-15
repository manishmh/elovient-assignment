# Smart User Activity Tracker

Full-stack assignment. Node + Express + MongoDB backend, small React frontend. Tracks user actions, enforces a custom rate limit, runs replay checks, and exposes analytics + suspicious-user queries.

## Stack

- **Backend:** Node 20, Express 4, TypeScript (strict, NodeNext), MongoDB via Mongoose
- **Frontend:** React 18, Vite, TypeScript, Tailwind v3, React Router v6
- **Auth:** JWT (access + refresh), bcrypt, HTTP-only cookies
- No external rate-limit, analytics, or session libraries

## Features

- Auth: register / login / refresh / logout / me, refresh-token rotation
- Activity logging with sliding 5-in-10s per-user rate limit
- Replay check: rejects clock skew > 30s or duplicate action within 3s
- Analytics: total actions, most common action, per-minute breakdown (10 min), most active user
- Suspicious detection: > 20 actions/min OR > 2 distinct IPs in 5 min
- Frontend: login/register, dashboard, activity simulator, stats, suspicious users

## Architecture

```
React (Vite)
   │  fetch + Bearer JWT
   ▼
Express
   routes → controllers → services → models
   ▼
MongoDB
   users          (auth + refresh hash)
   activitylogs   (rate limit, replay, analytics, detection)
```

All four backend features query the same `activitylogs` collection. Compound index `{ userId: 1, createdAt: -1 }` covers the windowed lookups.

## Folder structure

```
.
├── backend/        Express + Mongoose API
├── frontend/       React + Vite UI
├── decisions.md    ADRs — design choices with reasoning
└── README.md
```

## Prerequisites

- Node 20+
- MongoDB running locally (or a reachable URI)

## Setup

### Backend

```bash
cd backend
cp .env.example .env     # set MONGO_URI + JWT secrets
npm install
npm run dev              # default http://localhost:8080
```

### Frontend

```bash
cd frontend
cp .env.example .env     # set VITE_API_URL if backend isn't on :8080
npm install
npm run dev              # http://localhost:5173
```

Make sure `CORS_ORIGIN` in `backend/.env` includes the frontend URL.

## Seeding

No dedicated seed script. To populate `activitylogs` for testing analytics / suspicious detection, use `mongosh`:

```js
use activity-tracker

const u = db.users.findOne({ email: "test@example.com" })._id
const now = Date.now()
const ips = ["1.1.1.1", "2.2.2.2", "3.3.3.3"]

db.activitylogs.insertMany(
  Array.from({ length: 25 }, (_, i) => ({
    userId: u,
    action: i % 2 ? "click" : "view",
    ip: ips[i % 3],
    createdAt: new Date(now - i * 1000),
    updatedAt: new Date(now - i * 1000),
  }))
)
```

Important: `createdAt` must be set manually when inserting from the shell — Mongoose's `timestamps: true` only fires when inserting through the model.

## API overview

| Method | Path                          | Auth        | Notes                              |
| ------ | ----------------------------- | ----------- | ---------------------------------- |
| POST   | /api/auth/register            | —           | rate-limited 5/min/IP              |
| POST   | /api/auth/login               | —           | rate-limited 10/min/IP             |
| POST   | /api/auth/refresh             | refresh JWT | rotation; 30/min/IP                |
| POST   | /api/auth/logout              | access JWT  | clears DB refresh + cookies        |
| GET    | /api/auth/me                  | access JWT  | current user                       |
| POST   | /api/activity                 | access JWT  | logs action; 5-in-10s rate limit   |
| POST   | /api/activity/replay-check    | access JWT  | clock skew + duplicate check       |
| GET    | /api/activity/stats           | access JWT  | aggregated analytics               |
| GET    | /api/activity/suspicious      | access JWT  | flagged users                      |

Detailed request/response shapes: `backend/README.md`.

## Auth flow

- Register/login returns `{ user, accessToken, refreshToken }` and sets both as HTTP-only cookies.
- Frontend sends `Authorization: Bearer <accessToken>` on each call.
- On 401, frontend calls `/api/auth/refresh` once, retries.
- Refresh token is stored as a SHA-256 hash on the user. Every refresh rotates it — old tokens fail the hash check.
- Logout clears the stored hash and both cookies.

## Assumptions

- Single backend instance. The auth rate limiter is an in-memory `Map` — does not cluster. The activity rate limit is DB-backed and would.
- `req.ip` relies on `trust proxy: 1`. For multi-hop deployments, bump the trust level.
- `/stats` and `/suspicious` are intentionally global, not admin-only. A real product would gate them behind a role.

## Further reading

- `backend/README.md` — backend details, curl examples, env reference
- `frontend/README.md` — frontend pages, auth/session behavior
- `decisions.md` — ADRs for non-obvious design choices
