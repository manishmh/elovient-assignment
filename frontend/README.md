# Frontend

React + Vite + Tailwind admin UI for the activity tracker.

## Stack

- React 18, TypeScript
- Vite
- Tailwind CSS v3
- React Router v6
- Native `fetch` — no axios, no state-management library

## Setup

```bash
cp .env.example .env
npm install
npm run dev
```

Default: http://localhost:5173.

## Scripts

| Command           | What it does                          |
| ----------------- | ------------------------------------- |
| `npm run dev`     | Vite dev server with HMR              |
| `npm run build`   | Type-check + build to `dist/`         |
| `npm run preview` | Serve the built bundle                |

## Environment

| Key            | Default                 | Purpose          |
| -------------- | ----------------------- | ---------------- |
| `VITE_API_URL` | http://localhost:8080   | backend base URL |

The backend's `CORS_ORIGIN` must include the frontend URL.

## Routes

| Path           | Access       | What's there                                         |
| -------------- | ------------ | ---------------------------------------------------- |
| `/login`       | public       | sign-in form                                         |
| `/register`    | public       | register form                                        |
| `/dashboard`   | protected    | user info + page links                               |
| `/activity`    | protected    | action buttons + replay-check section + recent log   |
| `/stats`       | protected    | analytics; auto-refresh every 5s                     |
| `/suspicious`  | protected    | flagged users; auto-refresh every 5s                 |

- Public routes redirect to `/dashboard` when already signed in.
- Protected routes redirect to `/login` when not signed in.

## Folder layout

```
src/
├── context/AuthContext.tsx   auth state (Context API)
├── layouts/AppLayout.tsx     top nav for protected pages
├── pages/                    one file per page
├── routes/                   ProtectedRoute, PublicRoute
├── services/api.ts           fetch wrapper
├── types/index.ts
├── App.tsx                   route tree
└── main.tsx
```

No `components/` or `hooks/`. Pages render directly with Tailwind utilities.

## Auth / session

- Access + refresh tokens kept in `localStorage`.
- `AuthContext` calls `GET /api/auth/me` on mount to restore the session.
- `services/api.ts` attaches `Authorization: Bearer <accessToken>` to every request.
- On 401, it calls `/api/auth/refresh` once with the stored refresh token and retries. If refresh fails, tokens are cleared and the user lands on `/login`.
- Logout calls `/api/auth/logout`, clears tokens, clears the user state.

## Notes

- `services/api.ts` is the only fetch wrapper. Pages call `api(path, { method, body })` directly — no per-feature service layer.
- `AuthContext` is the only React context. Page-level state stays local with `useState`/`useEffect`.
- Styling stays minimal — thin borders, plain spacing, mono font for IDs and timestamps. No charts, no design system.
- Activity simulator disables the action row for 10 seconds when the backend returns 429.
