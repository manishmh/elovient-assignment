# Backend

Express + TypeScript + Mongoose API for the activity tracker.

## Stack

- Node 20, Express 4
- TypeScript (strict, NodeNext)
- MongoDB via Mongoose
- bcrypt, jsonwebtoken, cookie-parser, cors, dotenv
- `ts-node-dev` for the dev loop

No rate-limit, analytics, or session libraries — assignment constraint.

## Setup

```bash
cp .env.example .env
npm install
npm run dev
```

Default port: 8080 (or whatever `PORT` is set to in `.env`).

## Scripts

| Command           | What it does                          |
| ----------------- | ------------------------------------- |
| `npm run dev`     | `ts-node-dev` with watch              |
| `npm run build`   | `tsc` → `dist/`                       |
| `npm start`       | Run the compiled JS                   |

## Environment

| Key                      | Default              | Purpose                              |
| ------------------------ | -------------------- | ------------------------------------ |
| `PORT`                   | 5000                 | server port                          |
| `NODE_ENV`               | development          | enables `Secure` cookies in prod     |
| `MONGO_URI`              | —                    | Mongo connection string (required)   |
| `JWT_ACCESS_SECRET`      | —                    | access-token signing secret          |
| `JWT_REFRESH_SECRET`     | —                    | refresh-token signing secret         |
| `JWT_ACCESS_EXPIRES_IN`  | 15m                  | also drives access cookie maxAge     |
| `JWT_REFRESH_EXPIRES_IN` | 7d                   | also drives refresh cookie maxAge    |
| `BCRYPT_SALT_ROUNDS`     | 10                   | password hashing cost                |
| `CORS_ORIGIN`            | `*` (when unset)     | comma-separated allowed origins      |

## Folder layout

```
src/
├── config/db.ts         Mongo connect
├── controllers/         thin HTTP handlers
├── middleware/          auth + error handlers
├── models/              User, ActivityLog
├── routes/              auth, activity, health
├── services/            replay, analytics, suspicious
├── utils/               asyncHandler, jwt, password, rateLimiter
├── types/               AppError, Request augmentation
├── app.ts               Express wiring
└── server.ts            connect DB → app.listen
```

Request flow: `route → controller → service → model`. Controllers stay thin.

## Seeding

No built-in seed script. For testing stats / suspicious detection, insert via `mongosh`:

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

`createdAt` must be set manually — Mongoose timestamps don't fire on shell inserts.

## API

### Auth

| Method | Path                  | Notes                                  |
| ------ | --------------------- | -------------------------------------- |
| POST   | /api/auth/register    | rate-limited 5/min/IP                  |
| POST   | /api/auth/login       | rate-limited 10/min/IP                 |
| POST   | /api/auth/refresh     | rotation; rate-limited 30/min/IP       |
| POST   | /api/auth/logout      | clears DB refresh + cookies            |
| GET    | /api/auth/me          | current user                           |

### Activity

| Method | Path                          | Response                                                |
| ------ | ----------------------------- | ------------------------------------------------------- |
| POST   | /api/activity                 | `{ success, serverTime, actionsInLast10Sec }`           |
| POST   | /api/activity/replay-check    | `{ allowed: true, serverTime }` or 409                  |
| GET    | /api/activity/stats           | `{ success, data: { totalActions, mostCommonAction, actionsPerMinute, mostActiveUser } }` |
| GET    | /api/activity/suspicious      | `[{ userId, email, reason, count }]`                    |

## Auth flow

- Passwords hashed with bcrypt (field has `select: false`).
- Login returns `{ user, accessToken, refreshToken }` and sets both as HTTP-only cookies.
- Refresh token stored as SHA-256 hash on `User.refreshToken`. Every refresh rotates it — old tokens fail the hash compare.
- Logout sets `refreshToken: null` and clears cookies.
- `requireAuth` reads the access token from either the `Authorization: Bearer` header or the `accessToken` cookie.

## Rate limiting

- **Activity (`/api/activity`):** sliding 5-in-10s per user via `countDocuments({ userId, createdAt >= now-10s })`. Returns 429 when exceeded.
- **Auth routes:** in-memory `Map<ip, { count, resetAt }>`, one closure per route:
  - register: 5/min/IP
  - login: 10/min/IP
  - refresh: 30/min/IP

## Replay protection

`POST /api/activity/replay-check` against `ActivityLog`:

- `|serverTime − clientTime| > 30s` → 409
- any entry with same `(userId, action)` in last 3s → 409

On allow: records the attempt with `meta.source: 'replay-check'` and returns `{ allowed: true, serverTime }`.

## Analytics

`GET /api/activity/stats` runs four pipelines in parallel:

- `countDocuments({})` → `totalActions`
- `$group action + $sort + $limit 1` → most common action
- `$match (last 10 min) + $group $dateToString minute + $sort` → per-minute counts (missing minutes are zero on the client)
- `$group userId + $sort + $limit 1 + $lookup users` → most active user (with email)

## Suspicious detection

`GET /api/activity/suspicious` runs two pipelines in parallel:

- Rule 1: `$match (last 1 min) + $group userId + $match count > 20`
- Rule 2: `$match (last 5 min) + $group userId, $addToSet ip + $project size > 2`

Results merged in JS; a user flagged by both rules gets `reason: "High frequency / Multiple IPs"`. Email comes from `$lookup` against `users`.

## Smoke test

```bash
curl http://localhost:8080/health
# { "success": true, "message": "Server running" }
```
