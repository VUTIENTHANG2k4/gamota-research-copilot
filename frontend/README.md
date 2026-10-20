# gamota-research-copilot frontend (MVP / prototype)

Next.js (App Router) + Tailwind, Vietnamese only. It reads and writes data ONLY through the FastAPI backend
(`NEXT_PUBLIC_API_URL`). It never calls OpenRouter and holds no API keys. Design: `docs/design/DESIGN.md`.
API contract: `docs/api.md`.

Pages: `/` (question box and history), `/runs/{id}` (Brief), `/runs/{id}/evidence`, `/runs/{id}/reconcile`,
`/runs/{id}/memo` (with Word export and a print stylesheet for "Lưu thành PDF"), `/limitations`.

## Configuration

| Variable | Meaning |
|---|---|
| `NEXT_PUBLIC_API_URL` | Base URL of the backend, no trailing slash. Default `http://localhost:8000`. It is baked into the build, so change it and rebuild/restart. |

The backend must allow the UI origin in `CORS_ORIGINS` (or `CORS_ORIGIN_REGEX`), see `docs/api.md`.

Sign-in: when the backend has `APP_USERS` set, every page except `/login` and `/limitations` asks the user to sign in (`components/AuthGate.tsx`, session in `lib/auth.ts`, kept in `localStorage`). A 401 from the API clears the session and returns to `/login`. With `APP_USERS` empty the UI behaves as before.

## Run locally

1. PostgreSQL: `docker compose up -d` from the repo root.
2. Backend, from `backend/`: `..\.venv\Scripts\python -m uvicorn api.main:app --port 8000`
3. UI, from `frontend/`: `npm install` (first time), then `npm run dev` (http://localhost:3000)
   or `npm run build && npm start`.

For a local backend, `frontend/.env.local` may contain `NEXT_PUBLIC_API_URL=http://localhost:8000` (gitignored).

## Deploy on Vercel

1. Import the repository in Vercel and set **Root Directory** to `frontend`.
2. Add the environment variable `NEXT_PUBLIC_API_URL` = the public URL of the deployed backend (for example
   `https://your-backend.example.com`), for the Production and Preview environments.
3. Deploy. Framework preset: Next.js (build `npm run build`). Then add the Vercel domain to the backend's
   `CORS_ORIGINS` (or `CORS_ORIGIN_REGEX` for preview domains).

No keys or secrets belong in `frontend/`; the browser only knows the backend URL.

## Checks

`npx tsc --noEmit`, `npm run lint`, `npm run build`.

### Local mock backend (UI tests only)

`tests/mock_api.py` starts the REAL FastAPI routes (`backend/api/main.py`) with an in-memory store instead of PostgreSQL runs,
fixture runs from saved results, and timed simulations instead of the model-backed jobs, so no model quota is spent. Chunk
passages still come from the real database (read-only). Fixtures: `mockq1` (Mission 2 run, `backend/runs/p4/round_1/Q1`),
`m3q1`..`m3q5`, `m3a`, `m3b` (Mission 3 code on saved M2 outputs, `backend/runs/m3/layer_a`), and `r1-<key>` for every finished
item under `backend/runs/m3/round_1` present when the mock starts (live M3 outputs; follow-ups such as T15 are linked to their
parent, with inherited decisions). The follow-up endpoint is the real one; the simulated follow-up run copies its parent's
results and rebuilds the memo with the real memo code from the saved sentences. A follow-up question containing `KHAC` is
treated as unrelated to its parent.

```
.venv\Scripts\python frontend\tests\mock_api.py                # from the repo root, listens on :8001
set NEXT_PUBLIC_API_URL=http://localhost:8001 && npm run dev   # UI on :3000
```

Switches (GET): `/mock/ingest?state=ingesting|ready|error`, `/mock/flag?name=busy|dbdown|memofail&on=1|0`,
`/mock/reset`. Questions containing `LOI` end in an error; questions containing `VAGUE` ask for clarification.

## Notes

- Screens live in `components/screens/`; the files under `app/runs/[id]/` only re-export them, because Tailwind's
  scanner skips directories with square brackets in the name.
- The repo-root `.gitignore` ignores `/runs/` and `/backend/runs/` (model logs). `frontend/.gitignore` re-includes `app/runs/`, the UI route.
  Do not remove that line or the run pages disappear from git (and from the Vercel build).
