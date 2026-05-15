# Smart Activity Tracker — Frontend

Minimal React + TypeScript + Tailwind frontend for the Smart Activity Tracker backend.

## Stack
- React 18 + TypeScript + Vite
- Tailwind CSS v3
- React Router v6
- Native `fetch` (no axios, no state-management library)

## Setup

```bash
cp .env.example .env   # set VITE_API_URL if backend is not on localhost:8080
npm install
npm run dev
```

Open http://localhost:5173. The backend (on `VITE_API_URL`) must allow this origin in CORS with `credentials: true` — already configured in `backend/src/app.ts`.

## Folder Structure

```
src/
├── context/AuthContext.tsx    # auth state via Context API
├── layouts/AppLayout.tsx      # top nav for protected pages
├── pages/                     # one file per page
│   ├── Login.tsx
│   ├── Register.tsx
│   ├── Dashboard.tsx
│   ├── ActivitySimulator.tsx
│   ├── Stats.tsx
│   └── Suspicious.tsx
├── routes/                    # ProtectedRoute + PublicRoute
├── services/api.ts            # fetch wrapper, Bearer token, refresh on 401
├── types/index.ts
├── App.tsx                    # route tree
├── main.tsx
└── index.css
```

## Auth

- Access + refresh tokens are stored in `localStorage`.
- `services/api.ts` attaches `Authorization: Bearer <accessToken>` to every request.
- On 401, the wrapper tries `POST /api/auth/refresh` once and retries the original request. If refresh fails, tokens are cleared and the user is bounced to `/login`.
- `AuthContext` restores the session on app mount by calling `GET /api/auth/me`.

## Routes

| Path           | Access                | What it does                                                         |
| -------------- | --------------------- | -------------------------------------------------------------------- |
| `/login`       | Public                | Sign in form; redirects to `/dashboard` if already signed in         |
| `/register`    | Public                | Create account; same redirect                                        |
| `/dashboard`   | Protected             | User info + links                                                    |
| `/activity`    | Protected             | Buttons for login/logout/click/view/custom → POST /api/activity + replay-check section |
| `/stats`       | Protected             | Auto-refreshes /api/activity/stats every 5s                          |
| `/suspicious`  | Protected             | List of flagged users; refreshes every 5s                            |

## Pages

- **Login / Register** — single email + password form; inline error message.
- **Dashboard** — user info card + three links.
- **Activity Simulator** — two sections: "Log Action" (POST `/api/activity`) and "Replay Check" (POST `/api/activity/replay-check`, sends `clientTime: new Date().toISOString()` and displays the `driftMs` between server and client time). Logs the last 20 calls. When `/api/activity` returns 429 with "Rate limit", the action buttons are disabled for 10 seconds.
- **Stats** — three cards (total / most common / most active user) + a per-minute list, polled every 5 seconds.
- **Suspicious users** — table of `userId · reason · count`, polled every 5 seconds.

## Notes

- No design-system abstractions — `<button>`, `<input>` are styled directly with Tailwind.
- No charts or table libraries — `div` grids do the job for an admin tool.
- Cookies (`accessToken`, `refreshToken`) are set by the backend as well, but this frontend uses the JSON-body tokens + `Authorization` header for simplicity. The `credentials: 'include'` flow isn't enabled here.
