# Smart User Activity Tracker — Backend

Backend for the **Smart User Activity Tracker System** built with **Node.js + Express + MongoDB + TypeScript**.

This repo is being developed in phases. The current phase delivers only the scalable project foundation — auth, activity logging, rate limiting, replay protection, analytics, and suspicious-activity detection are scaffolded but not yet implemented.

---

## Tech Stack

| Layer    | Tool                            |
| -------- | ------------------------------- |
| Runtime  | Node.js                         |
| Server   | Express                         |
| Database | MongoDB (via Mongoose ODM)      |
| Language | TypeScript (strict mode)        |
| Auth     | JWT (planned — phase 1)         |
| Dev      | ts-node-dev (hot reload)        |

No external rate-limit, analytics, or detection libraries — everything will be hand-rolled per assignment rules.

---

## Folder Structure

```
backend/
├── src/
│   ├── config/            # DB connection, env loading
│   ├── controllers/       # HTTP handlers (thin)
│   ├── middleware/        # auth + error handlers
│   ├── models/            # Mongoose schemas (User, ActivityLog)
│   ├── routes/            # Express routers
│   ├── services/          # Business logic (analytics, suspicious, replay)
│   ├── validators/        # Request validators
│   ├── utils/             # asyncHandler, jwt, rateLimiter, time helpers
│   ├── constants/         # Shared constants
│   ├── types/             # Shared TS types + express augmentation
│   ├── app.ts             # Express app wiring
│   └── server.ts          # Bootstrap (DB connect → listen)
├── .env.example
├── .gitignore
├── package.json
├── tsconfig.json
└── README.md
```

`routes → controllers → services → models` is the request flow. Controllers stay thin; business logic lives in services.

---

## Setup

```bash
# from the backend/ directory
cp .env.example .env       # then edit MONGO_URI etc. as needed
npm install
npm run dev
```

The server starts on `http://localhost:5000`.

> A reachable MongoDB instance (local or cloud) is required — `server.ts` connects before binding the port.

---

## Scripts

| Script          | Description                                              |
| --------------- | -------------------------------------------------------- |
| `npm run dev`   | Start in watch mode with `ts-node-dev`                   |
| `npm run build` | Compile TypeScript to `dist/`                            |
| `npm start`     | Run the compiled JavaScript from `dist/`                 |

---

## Environment Variables

See `.env.example`. Required:

| Variable                  | Purpose                                                          |
| ------------------------- | ---------------------------------------------------------------- |
| `PORT`                    | Port the server listens on                                       |
| `NODE_ENV`                | `development` or `production` (cookies set `secure: true` in prod) |
| `MONGO_URI`               | MongoDB connection string                                        |
| `JWT_ACCESS_SECRET`       | Signing secret for short-lived access tokens                     |
| `JWT_REFRESH_SECRET`      | Signing secret for refresh tokens (different secret)             |
| `JWT_ACCESS_EXPIRES_IN`   | Access-token lifetime; also access-cookie maxAge (default `15m`) |
| `JWT_REFRESH_EXPIRES_IN`  | Refresh-token lifetime; also refresh-cookie maxAge (default `7d`)|
| `BCRYPT_SALT_ROUNDS`      | bcrypt cost factor for password hashing (default `10`)           |
| `CORS_ORIGIN`             | Comma-separated allowed origins (sets `credentials: true`)       |

---

## Endpoints

### Phase 0 — Health

| Method | Path      | Auth | Response                                        |
| ------ | --------- | ---- | ----------------------------------------------- |
| GET    | `/health` | —    | `{ "success": true, "message": "Server running" }` |

Unmatched routes return `404 { success: false, message: "Route not found: ..." }`.

### Phase 1 — Authentication

| Method | Path                    | Auth                          | Purpose                                                                |
| ------ | ----------------------- | ----------------------------- | ---------------------------------------------------------------------- |
| POST   | `/api/auth/register`    | — (rate-limited 5/min/IP)     | Create user, persist hashed refresh, set cookies, return tokens in JSON|
| POST   | `/api/auth/login`       | — (rate-limited 10/min/IP)    | Verify credentials, rotate refresh in DB, set cookies, return tokens   |
| POST   | `/api/auth/refresh`     | refresh JWT (cookie OR body), rate-limited 30/min/IP | Verify + hash-compare + **rotate**; set new cookies, return new pair |
| POST   | `/api/auth/logout`      | Bearer access JWT (or cookie) | Clear `refreshToken` in DB and `clearCookie` both cookies              |
| GET    | `/api/auth/me`          | Bearer access JWT (or cookie) | Return the authenticated user                                          |

**Cookies:**
- `accessToken` and `refreshToken` are set as `HttpOnly` cookies with `sameSite: lax` and `secure: true` in production. The same tokens are also returned in the JSON body so non-cookie clients (mobile, CLI) can use the API.

**Token flow (with DB-backed rotation):**
1. Client calls `register` or `login` → server signs an access JWT (short, e.g. 15m) and a refresh JWT (long, e.g. 7d), **stores SHA-256 hash of the refresh token on the user document**, returns both tokens in JSON, and sets both as HttpOnly cookies.
2. Client sends the access token on every protected request — either via cookie (browsers automatically) or `Authorization: Bearer <accessToken>` (non-browser clients).
3. When the access token expires (401), the client calls `POST /api/auth/refresh` (cookie picked up automatically, or refresh token in body). Server:
   - verifies JWT signature/expiry,
   - looks up the user,
   - compares `sha256(incoming)` against `user.refreshToken` in constant time,
   - if match: signs a **new** access + **new** refresh, **replaces** the stored hash, sets new cookies, returns the new pair.
4. **Rotation makes stolen tokens self-defeat:** the old refresh hash is gone, so any attempt to reuse the old refresh token fails the hash check.
5. Logout: server sets `user.refreshToken = null` and clears both cookies.

### Phase 2 — Activity Logging

| Method | Path                          | Auth                          | Purpose                                                          |
| ------ | ----------------------------- | ----------------------------- | ---------------------------------------------------------------- |
| POST   | `/api/activity`               | Bearer access JWT (or cookie) | Log a user action; enforces a 5-in-10s sliding-window rate limit |
| POST   | `/api/activity/replay-check`  | Bearer access JWT (or cookie) | Validate clock skew (≤30s) + reject duplicate action (≤3s)       |
| GET    | `/api/activity/stats`         | Bearer access JWT (or cookie) | Aggregated analytics: total / top action / per-minute / top user |
| GET    | `/api/activity/suspicious`    | Bearer access JWT (or cookie) | Users flagged by >20 actions/min OR >2 distinct IPs in 5 min     |

**Request body:**
```json
{ "action": "button_click", "meta": { "page": "/dashboard" } }
```
- `action` (string, required) — non-empty identifier for what happened.
- `meta` (object, optional) — free-form payload tied to the action.

**Success response (201):**
```json
{
  "success": true,
  "serverTime": "2026-05-14T18:23:11.482Z",
  "actionsInLast10Sec": 3
}
```

**Rate-limit response (429):**
```json
{
  "success": false,
  "message": "Rate limit exceeded: more than 5 actions in the last 10 seconds"
}
```

**How the rate limit works:** before saving, the controller runs `ActivityLog.countDocuments({ userId, createdAt: { $gte: now - 10s } })`. If the count is `>= 5`, it throws `AppError(..., 429)`. Otherwise it saves a new `ActivityLog` (with the client `req.ip`, user agent, and any `meta`) and reports `count + 1`. No external rate-limit library — the `ActivityLog` collection + a compound index on `{ userId: 1, createdAt: -1 }` is the entire mechanism.

**Replay check (`/api/activity/replay-check`)** — request body `{ "action": "click", "clientTime": "<ISO>" }`. Rejects with 409 if `|serverTime - clientTime| > 30s` OR if the same `(userId, action)` was logged within the previous 3 seconds. On success returns 200 with `{ "allowed": true, "serverTime": "<ISO>" }` and records the accepted attempt in `ActivityLog` with `meta.source: 'replay-check'`. Handled by `services/replay.service.ts`.

**Analytics (`/api/activity/stats`)** — runs four aggregation pipelines in parallel against `ActivityLog`:
```json
{
  "success": true,
  "data": {
    "totalActions": 42,
    "mostCommonAction": { "action": "click", "count": 21 },
    "actionsPerMinute": [
      { "minute": "2026-05-15T14:15:00.000Z", "count": 3 },
      { "minute": "2026-05-15T14:18:00.000Z", "count": 5 }
    ],
    "mostActiveUser": { "userId": "<objectId>", "count": 18 }
  }
}
```
`actionsPerMinute` only contains minutes that had activity in the last 10 minutes (missing minutes are zero). `mostCommonAction` and `mostActiveUser` are `null` when there are no logs yet. Handled by `services/analytics.service.ts`.

**Suspicious detection (`/api/activity/suspicious`)** — returns a bare JSON array of users flagged by two parallel rules:
```json
[
  { "userId": "...", "reason": "High frequency", "count": 24 },
  { "userId": "...", "reason": "Multiple IPs", "count": 3 },
  { "userId": "...", "reason": "High frequency / Multiple IPs", "count": 31 }
]
```
A user is flagged when they sent **more than 20 actions in the last minute** (rule 1) or used **more than 2 distinct IPs in the last 5 minutes** (rule 2). Users that hit both rules get the combined reason. Empty result is `[]`. Handled by `services/suspicious.service.ts`.

### Phases 3–6 (planned)

| Method | Path                  | Phase                |
| ------ | --------------------- | -------------------- |
| GET    | `/api/activity`       | Activity listing     |
| GET    | `/api/analytics/...`  | Analytics            |
| GET    | `/api/suspicious/...` | Suspicious detection |

---

## Roadmap

- [x] **Phase 0** — Project setup, health route, scalable folder structure
- [x] **Phase 1** — JWT auth with HTTP-only cookies + DB-backed refresh-token rotation
- [x] **Phase 2** — Activity logging API + `ActivityLog` model + custom 5-in-10s rate limit
- [x] **Phase 3** — Generic in-memory rate-limiter middleware applied to auth routes
- [x] **Phase 4** — Replay protection (clock skew ≤30s + duplicate action ≤3s)
- [x] **Phase 5** — Analytics APIs powered by MongoDB aggregation pipelines
- [x] **Phase 6** — Suspicious activity detection (>20/min OR >2 IPs/5min)
- [ ] **Phase 7** — React frontend

Progress is tracked in [`../PROGRESS.md`](../PROGRESS.md). Design decisions are documented in [`../decisions.md`](../decisions.md).

---

## Engineering Conventions

- **Thin controllers, fat services.** Controllers parse the request and call services. Services own business logic and are unit-testable without HTTP.
- **`asyncHandler` everywhere.** All async route handlers are wrapped with `src/utils/asyncHandler.ts` so thrown errors flow to the centralized error middleware.
- **Inline response shape.** Handlers write `res.status(<code>).json({ success, message, data? })` directly — no helper wrappers — keeping the surface explicit. The `ApiResponse<T>` type in `src/types/index.ts` documents the contract.
- **Centralized error handling.** Throw `new AppError(message, statusCode)` (from `src/types`) and the error middleware will format the response and hide the stack in production.
- **Strict TypeScript.** `strict: true` is on; null-safety and explicit types are enforced.
