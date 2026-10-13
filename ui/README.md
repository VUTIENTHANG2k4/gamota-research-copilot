# gamota-research-copilot UI (MVP / prototype)

Next.js (App Router) + Tailwind, Vietnamese only. It reads data ONLY from the FastAPI backend
(`NEXT_PUBLIC_API_URL`, default `http://localhost:8000`). It never calls OpenRouter and holds no API keys.
Design: `docs/design/DESIGN.md`. API contract: `docs/api.md`.

## Run

1. PostgreSQL (needed to open source passages): `docker compose up -d` from the repo root.
2. Backend, from the repo root: `.venv\Scripts\python -m uvicorn api.main:app --port 8000`
3. UI, from `ui/`: `npm install` (first time), then `npm run dev` (http://localhost:3000)
   or `npm run build && npm start`.

`ui/.env.local` must contain `NEXT_PUBLIC_API_URL=http://localhost:8000` (the file is gitignored; recreate it if missing).
The backend only allows CORS from `http://localhost:3000`.

## Checks

`npx tsc --noEmit`, `npm run lint`, `npm run build`.
`node tests/mock-api.mjs` starts a local mock on :8001 (proxies the real API) used only to exercise states the saved data
cannot show: a failed live run, a clarification run, and a database-down chunk (503). Point the UI at it with
`NEXT_PUBLIC_API_URL=http://localhost:8001 npx next dev -p 3001`.

## Notes

- Screens live in `components/screens/`; the files under `app/runs/[key]/` only re-export them, because Tailwind's
  scanner skips directories with square brackets in the name.
- Not implemented (not in the backend): analyst review (confirm/reject claims) and Word/PDF export. The UI says so
  instead of drawing buttons that do nothing.
