# Architectural Decisions

This file captures the reasoning behind the major design choices in this project. Entries are written ADR-style: short, concrete, with **why** rather than just **what**.

---

## 1. TypeScript with strict mode

**Decision:** Use TypeScript with `strict: true` (incl. `noImplicitAny`, `strictNullChecks`) from day one.

**Why:** The assignment is backend-heavy and includes subtle invariants (replay windows, rate-limit counters, JWT payload shapes, aggregation results). Catching `undefined`/`null` and shape mismatches at compile time is much cheaper than catching them in production logs.

---

## 2. Split `app.ts` and `server.ts`

**Decision:** `app.ts` exports a configured Express `Application`. `server.ts` imports it, connects to MongoDB, then calls `app.listen`.

**Why:** Future integration tests can import `app` and use Supertest without binding a port. It also separates two concerns that often get tangled — *what the API looks like* vs *how it boots*.

---

## 3. Layered architecture: routes → controllers → services → models

**Decision:** Each request flows through a thin Express handler (controller) into a service that owns the business logic, which in turn talks to a Mongoose model.

**Why:** The hard parts of this assignment — analytics aggregations, suspicious-activity rules, custom rate-limiting, replay checks — are *not* HTTP concerns. Putting them in services means they can be unit-tested in isolation and reused (e.g., the same `suspicious.service` can power both a real-time check and a nightly report).

---

## 4. Custom `asyncHandler` utility

**Decision:** Use a tiny `asyncHandler` wrapper that catches rejected promises and forwards them to `next(err)`. No external dependency.

**Why:** Express 4 doesn't natively forward async errors. Either every controller wraps itself in try/catch (boilerplate) or we use one wrapper. The wrapper is 4 lines — adding a library for it is overkill.

---

## 5. Inline status codes and response objects (no helpers)

**Decision:** Handlers write `res.status(200).json({ success: true, message: "...", data })` directly. No `apiResponse(...)` helper, no `HTTP_STATUS.OK` constant.

**Why:** Tiny helper files like `apiResponse.ts` or `httpStatus.ts` add indirection without earning their keep at this scale. Reading `res.status(404)` is clearer than `res.status(HTTP_STATUS.NOT_FOUND)`, and the response shape is short enough to write twice. The `ApiResponse<T>` TypeScript type in `src/types/index.ts` documents the contract so it stays consistent without a helper enforcing it.

---

## 6. No external rate-limiting or analytics libraries

**Decision:** Custom rate limiting, replay protection, and analytics are all hand-rolled on top of the `ActivityLog` MongoDB collection.

**Why:** This is an assignment hard requirement — and architecturally it's the right call too. The `ActivityLog` collection is already the system's source of truth; using it for rate limiting (count of recent events per user) means no second data store to sync. The same goes for replay protection (nonce + timestamp lookup) and analytics (aggregation pipelines).

---

## 7. Placeholder files for future phases

**Decision:** `src/controllers/auth.controller.ts`, `src/services/replay.service.ts`, etc. exist now as empty `export {}` files even though they have no logic yet.

**Why:** The assignment specifies the codebase should be *prepared* for JWT middleware, replay protection, rate limiting, and so on. Reserving the import paths now means later phases are pure additions — no folder renames, no broken imports, no refactoring noise in PRs.

---

## 8. MongoDB connection before listen

**Decision:** `server.ts` awaits `connectDB()` before calling `app.listen`. If Mongo is unreachable, the process exits with code 1.

**Why:** A server that accepts requests but can't talk to its database is worse than one that fails to start — it lies to clients and orchestrators. Fail fast, let the process manager restart, surface the real error in logs.

---

## 9. Centralized error middleware + `AppError` class

**Decision:** All routes either throw or call `next(err)`. A single `errorHandler` middleware normalizes the response. `AppError` carries an explicit status code for known errors; unknown errors default to 500 and are logged.

**Why:** Predictable error format for the frontend, and a single place to add concerns like structured logging or Sentry later. Stack traces are exposed in development and hidden in production.

---

## 10. Access token + refresh token, two separate secrets

**Decision:** The auth layer issues two JWTs per session: a short-lived **access token** (15 min default, signed with `JWT_ACCESS_SECRET`) and a longer-lived **refresh token** (7 days default, signed with `JWT_REFRESH_SECRET`). Clients send the access token on every API call; when it expires, they exchange the refresh token at `POST /api/auth/refresh` for a fresh pair.

**Why:** A long-lived access token is dangerous — if leaked (XSS, accidental log line), the attacker has a wide window. A short access token narrows that window to minutes. A separate refresh-token secret means even if the access secret is compromised, refresh tokens are not — and vice versa. Two separate secrets also let us rotate either independently.

---

## 11. DB-backed refresh tokens with rotation (replaces earlier `tokenVersion` design)

**Decision:** Each `User` document has a `refreshToken?: string` field (default `null`, `select: false`) that stores the **SHA-256 hash** of the user's currently-valid refresh token. On every login/register/refresh, the server mints a fresh refresh JWT, hashes it, writes the hash to `user.refreshToken`, and returns the plain JWT to the client. On `/refresh`, the server verifies the JWT signature/expiry, looks up the user, and `timingSafeEqual`s `sha256(incoming)` against the stored hash. Old refresh tokens are invalidated automatically because the hash they'd match no longer exists.

**Why:** This is a "refresh-token rotation" scheme — the industry standard for SPA auth. Each refresh replaces the stored hash, so a stolen refresh token only works until the legitimate client next refreshes (after which the attacker's copy fails the hash check). It also gives us *individual* revocation on logout (set `refreshToken: null`) rather than only "log out everywhere," and the JWT itself remains stateless for the access token (no DB read on regular API calls).

**Why SHA-256, not bcrypt, for refresh tokens?** Refresh tokens are JWTs (often 200+ bytes), which exceeds bcrypt's 72-byte input limit. They're also already high-entropy (signed by a server secret) so they don't need bcrypt's intentional slowness — that's for low-entropy human passwords. SHA-256 with `crypto.timingSafeEqual` is the right tool: fast, no length limit, constant-time comparison.

**Trade-off vs. previous `tokenVersion` design:** Before, logout was a single `$inc`; now logout writes `refreshToken: null` and every refresh writes a new hash. One extra `findByIdAndUpdate` per refresh. In return we get true per-session storage and natural rotation — worth it.

---

## 11a. HTTP-only cookies for both tokens (in addition to JSON body)

**Decision:** `register`, `login`, and `refresh` set two cookies — `accessToken` and `refreshToken` — with `httpOnly: true`, `sameSite: 'lax'`, and `secure: true` in production. The JSON body still includes both tokens so non-browser clients (mobile, CLI) can use the API too. `logout` calls `res.clearCookie` on both.

**Why:** HTTP-only cookies are immune to XSS-based token theft because JavaScript can't read them. The frontend doesn't need to manage `localStorage` or worry about token-injection vectors. We keep the body tokens so the same API works for non-cookie clients (curl, mobile). `sameSite: 'lax'` blocks CSRF on cross-site POSTs while still allowing same-origin and top-level navigations to carry the cookie. `secure: true` in production prevents the cookie from being sent over plain HTTP; in dev we relax it so `http://localhost` works.

The middleware (`requireAuth`) reads the access token from `Authorization: Bearer` **or** the cookie — clients can pick whichever fits.

---

## 11b. `cookie-parser` middleware (not session middleware)

**Decision:** Use `cookie-parser` to expose `req.cookies`. Do **not** use `express-session`, `connect-redis`, or any server-side session store.

**Why:** All auth state we need is already on the `User` document (`refreshToken` hash). A session store would duplicate this and add a second source of truth. `cookie-parser` is a 1-line middleware that just parses the `Cookie` header into `req.cookies` — it has no opinion about sessions.

---

## 12. bcrypt with configurable salt rounds

**Decision:** Passwords are hashed with `bcrypt` at 10 rounds by default (`BCRYPT_SALT_ROUNDS` env var). The hash is stored in `User.password` with `select: false` so it's never returned by default queries.

**Why:** bcrypt is widely audited, has built-in salt generation, and is intentionally slow — making offline brute-force expensive. 10 rounds is a reasonable production default in 2025/2026; the env var lets us tune up if hardware improves. `select: false` removes a class of bugs where a developer accidentally returns the hashed password in a response.

---

## 13. Email normalization on the model

**Decision:** The `User.email` field has `lowercase: true` and `trim: true` Mongoose options. The controller also lowercases incoming emails before lookups.

**Why:** Email is the unique key. Without normalization, "Alice@example.com" and "alice@example.com" would create two accounts. Normalizing in *both* the schema and the controller keeps a defense in depth — a future code path that inserts directly won't bypass it.

---

## 14. `ActivityLog` as the single source of truth for activity, rate-limit, and (later) analytics

**Decision:** One Mongoose collection — `ActivityLog` — holds every user action: `{ userId, action, ip, userAgent?, meta?, createdAt, updatedAt }`. The compound index `{ userId: 1, createdAt: -1 }` makes both "events for user X" and "events for user X since timestamp T" point-in-index queries.

**Why:** The assignment requires four features that all need the same data: rate limiting, replay protection, analytics aggregations, and suspicious-activity detection. Forking that into multiple stores (Redis for rate limits, a counters collection, a separate audit log) would force us to keep them consistent. One collection with the right index serves all four — and avoids the second-source-of-truth class of bugs. The `meta` field is `Schema.Types.Mixed` so any future action shape fits without a migration.

---

## 15. Custom 5-in-10s rate limit via `countDocuments` (no rate-limit libraries)

**Decision:** In `activity.controller.ts`, before saving a new log, we run `ActivityLog.countDocuments({ userId, createdAt: { $gte: now - 10s } })`. If the count is `>= 5`, we throw `AppError(..., 429)`. Otherwise we save the new doc and return `recentCount + 1` as `actionsInLast10Sec`.

**Why:** The assignment forbids rate-limit libraries (`express-rate-limit`, `rate-limiter-flexible`, etc.). Since `ActivityLog` is already the source of truth (ADR 14), the rate-limit check is a one-liner against an indexed count — cheap, in-database, no extra state to sync. The trade-off is a small TOCTOU race under burst concurrency: two simultaneous requests at count=4 can both pass the check and both insert. For an assignment this is acceptable; a production hardening would use a transaction or `findOneAndUpdate` on a counter doc with `$inc`.

**Why a sliding window of 10s, not a fixed bucket?** Sliding windows give smoother rate limiting and don't reset on a boundary. With `createdAt: { $gte: now - 10000 }`, the window slides per-request, so a user who bursts 5 then waits 11 seconds gets a clean slate — no synchronized "top of the minute" thundering herd.

---

## 16. Read client IP via `req.ip` with `trust proxy: 1`

**Decision:** `app.set('trust proxy', 1)` is set in `app.ts`, and the activity controller reads `req.ip || req.socket.remoteAddress || 'unknown'`.

**Why:** In production, the API is almost always behind one reverse-proxy hop (nginx, ALB, Cloudflare, etc.) that sets `X-Forwarded-For`. With `trust proxy: 1`, Express reads the rightmost IP in that header — the proxy's view of the client. Setting it higher (`true`) trusts the *entire* chain, which lets clients spoof their IP by forging additional `X-Forwarded-For` entries. `1` is the right default for a typical single-hop deployment; bump it for multi-hop setups. The fallback to `req.socket.remoteAddress` handles the (rare) case where `req.ip` is unset.

---

## 17. Phase-2 response shape diverges from the standard `{ success, message, data }`

**Decision:** The `POST /api/activity` success response is `{ success, serverTime, actionsInLast10Sec }` (no `message`, no `data` wrapper). Error responses keep the standard `{ success: false, message }` shape.

**Why:** The assignment explicitly specifies this success shape. We match the spec verbatim — the rate-limit/serverTime info is structural data that belongs at the top level, not buried inside a generic `data` envelope. Error responses still flow through the central `errorHandler`, so error format remains consistent across endpoints.

---

## 18. Phase 3 rate limiter is an in-memory middleware factory (not DB-backed)

**Decision:** `utils/rateLimiter.ts` exports `createRateLimiter({ windowMs, max, message?, keyFn? })` which returns an Express middleware closing over its own `Map<key, { count, resetAt }>`. Default key is `req.ip`. Used on `/api/auth/register`, `/api/auth/login`, and `/api/auth/refresh` to blunt brute-force and abuse.

**Why in-memory and not on `ActivityLog`?** The activity endpoint already does DB-backed rate limiting against `ActivityLog` (Phase 2, ADR 15) because it needs to be user-aware and survives across instances. The auth limiters here are different in kind: they protect *unauthenticated* endpoints, keyed by IP. Tracking those in `ActivityLog` would force `userId` to become optional and add a write on every login attempt — a lot of churn for a defense layer that just needs to throttle a misbehaving IP for a minute. An in-memory `Map` is one allocation per unique IP, no I/O, and easy to reason about.

**Trade-off:** Buckets reset on server restart, and the limit is per-process (no clustering). Both are fine for a single-instance assignment. A production deployment with horizontal scaling would back the map with Redis or use a sticky-session/edge rate-limit (Cloudflare, nginx) — neither of which the assignment allows.

**Why fixed window, not sliding?** Sliding is more accurate but requires tracking individual timestamps per key. Fixed window is one integer per key — simpler, and the limit "snaps" cleanly on a boundary which is plenty for an abuse-deterrent. The activity endpoint uses sliding because it has stricter requirements (the assignment specifies "5 in 10 seconds" as a sliding rule), and the DB index makes sliding free there.

---

## 19. Replay protection: clock-skew window + recent-duplicate check, both against `ActivityLog`

**Decision:** `POST /api/activity/replay-check` accepts `{ action, clientTime }`. The handler delegates to `services/replay.service.ts#checkReplay` which (1) rejects if `|serverTime - clientTime| > 30s`, (2) rejects if any `ActivityLog` entry for the same `(userId, action)` exists within the last 3 seconds, and (3) on success inserts a new `ActivityLog` row tagged `meta.source: 'replay-check'` and returns `{ serverTime }`. The controller returns the assignment-specified shape `{ allowed: true, serverTime }`.

**Why both checks against `ActivityLog`?** It's already the source of truth for user actions (ADR 14). The 3-second duplicate check is a one-shot indexed lookup (`{ userId, action, createdAt >= now - 3s }`) — fast on the existing compound index. Storing the accepted attempt back to `ActivityLog` means the *next* call's check just works without any extra state.

**Why throw `AppError` for rejections instead of `{ allowed: false }`?** The assignment specifies only the allowed-true response shape. Throwing routes failures through the central error middleware, keeping rejection format consistent with every other endpoint (`{ success: false, message }` + appropriate status). Clients distinguish "allowed" from "rejected" by status code (200 vs 409), which is more standard than a 200-with-flag pattern and avoids two parsing paths.

**Why 409 for both rejections (not 400 or 401)?** Both failure modes are state conflicts: the request is well-formed and authenticated, but conflicts with either real-world time or a recent prior action. `409 Conflict` captures that better than `400` (malformed) or `429` (rate limit).

**Side note: replay-check entries do count toward the Phase 2 `5-in-10s` activity limit**, because both endpoints write to the same `ActivityLog`. This is intentional — a user hammering replay-check is just as "active" as one hammering `/api/activity`, and the activity-rate-limit's purpose is to throttle overall per-user write volume.

---

## 20. Analytics: four aggregation pipelines run in parallel

**Decision:** `GET /api/activity/stats` is served by `services/analytics.service.ts#computeActivityStats`, which fires four queries against `ActivityLog` in `Promise.all`:

1. `countDocuments({})` → `totalActions`.
2. `$group($action) + $sort + $limit 1 + $project` → `mostCommonAction` shaped `{ action, count }`.
3. `$match(createdAt ≥ 10m ago) + $group($dateToString minute) + $sort + $project` → `actionsPerMinute` array of `{ minute, count }`.
4. `$group($userId) + $sort + $limit 1 + $project` → `mostActiveUser` shaped `{ userId, count }`.

**Why parallel?** All four queries are independent. Total latency is `max(pipeline)` instead of the sum.

**Why no zero-fill for `actionsPerMinute`?** The aggregation only returns minutes that had activity. The client can interpret missing buckets as zero — no need for the server to pad an array. Simpler code, smaller payload.

**Why no `$lookup` for the user's email?** Returning the bare `userId` is enough for the assignment, and skipping the join keeps the pipeline tighter and the response shape minimal. A future "show me the user's name on the dashboard" use case can add the lookup in one extra stage.

**Why `$project` to rename `_id`?** The grouped result naturally lands in `_id`; renaming to a meaningful field name (`action`, `minute`, `userId`) is more readable in the response than `_id`. It's a one-line stage and worth it.

**Why no auth-scope filtering (i.e., why does any user see global stats)?** The assignment specifies "Most active user" as a global metric — these stats are intentionally cross-user. The endpoint still requires `requireAuth` so anonymous callers can't scrape. A real product would gate behind an admin role.

---

## 21. Suspicious detection: two pipelines + in-memory merge by `userId`

**Decision:** `GET /api/activity/suspicious` runs two aggregations in parallel:

1. **High frequency** — `$match(createdAt ≥ 1m ago) + $group($userId) + $match(count > 20)`.
2. **Multiple IPs** — `$match(createdAt ≥ 5m ago) + $group($userId, $addToSet ips) + $project(count: $size of ips) + $match(count > 2)`.

The service then merges results in a `Map<userId, …>`. A user that appears in both pipelines gets the combined `reason: "High frequency / Multiple IPs"` and keeps the action count (more user-facing than IP count).

**Why two separate pipelines instead of one combined?** The two rules use different time windows (1 minute vs 5 minutes) and different aggregations (count vs $addToSet/$size). A single pipeline would either need `$facet` or repeated `$lookup`-style joins on the same collection — more complex than two clean parallel queries. `Promise.all` keeps latency at `max(pipeline)`.

**Why `$addToSet` for IPs?** It deduplicates inside the group stage — no need to fetch all rows and `Set`-ify in JS. `$size` then gives the distinct count in the pipeline itself.

**Why a bare array response (no `{ success, data }` wrapper)?** The assignment specifies `[{ userId, reason, count }]` directly. We match the spec verbatim — same approach as Phase 4 (which specified `{ allowed, serverTime }` shape). Error paths still flow through the central error middleware with the standard `{ success: false, message }` shape.

**Why combine reasons with " / " when both rules match?** It mirrors the assignment's example literally (`"High frequency / Multiple IPs"`), and keeps the response shape flat (one row per user, not duplicates). Clients can split the string if they need structured reasons.
