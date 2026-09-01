# Copilot instructions for mensage-whatsapp-server

## Project overview
This repository is a full-stack industrial alert system that accepts failure events from PLCs/supervisory systems/IoT devices, stores them, and sends WhatsApp notifications through Baileys. The app mixes an Express/Socket.IO backend with a React + Vite frontend, all in one Node process during development.

The important runtime flow is:
- `server.ts` starts Express, Socket.IO, and the Vite dev server for the SPA.
- `server/config.ts` loads environment variables and exposes runtime config.
- `server/db/database.ts` is the persistence layer: it prefers MySQL (`DATABASE_HOST`/`DATABASE_URL`) and falls back to a local JSON store (`data_storage.json`) when MySQL is unavailable.
- `server/services/worker.ts` polls for pending `falhas` records and processes them asynchronously.
- `server/services/whatsapp.ts` manages the Baileys connection, QR code flow, session persistence under `auth_info_baileys`, and message sending.
- `server/services/auth.ts` handles the dashboard access code, in-memory session tokens, and login rate limiting.
- `src/` contains the React dashboard UI; it relies on Socket.IO and API calls to the backend.

## Build, run, and validation commands
Use the scripts in `package.json`:

```bash
npm install
npm run dev
npm run build
npm start
npm run lint
```

What each script does in this repo:
- `npm run dev`: starts the integrated backend/frontend stack via `tsx server.ts`.
- `npm run build`: runs Vite frontend build and then bundles the Node server into `dist/server.cjs` with esbuild.
- `npm start`: runs the built server from `dist/server.cjs`.
- `npm run lint`: currently aliases `vite build`, not a true linter. Treat it as a build-level validation step, not a lint-only check.

Test runner status:
- There is no dedicated test script or existing automated test suite configured in `package.json`.
- There is no repo-specific single-test command to document yet; validation is currently done via `npm run build` and by starting the app locally.
- For a smoke check during development, use `npm run dev` and verify `GET /health`.

## Architecture notes that matter for edits
- `falhas` is the central domain object. The system assumes a unified table with fields like `id`, `equipamento_id`, `setor`, `user`, `status`, `attempts`, `error_message`, `creat_at`, and `update_at`.
- Status semantics are part of the domain contract: `0 = Pendente`, `1 = Enviado`, `2 = Processando`, `3 = Erro`.
- `user` is expected to be a normalized WhatsApp destination in digits-only format (for example `5548999998888`), and the API validates the length before enqueuing.
- The app intentionally supports two database modes: `mysql` and `embedded`. If `DATABASE_HOST`/`DATABASE_URL` are not set, it silently uses the local JSON file and logs that mode.
- The WhatsApp service reconnects automatically when the session is closed unless the user logs out. QR codes are emitted through the UI via Socket.IO events.
- The dashboard is authenticated with a bearer token generated server-side; the token is checked in middleware before protected routes (`/api/stats`, `/api/falhas`, etc.).
- Runtime safety defaults are in `server/config.ts`: `ACCESS_CODE` defaults to `admin123` for local dev, but production warns if the default is left in place.

## Repo-specific conventions
- TypeScript files use ES module syntax and Node ESM import paths with explicit `.js` extensions in source files, even though the files are `.ts`.
- The project is intentionally a single-process dev app: backend + frontend are served from the same Node process via `tsx`/Vite.
- Data shaping is highly specific to the industrial alert domain; avoid treating values as generic CRUD entities. Field names are Portuguese/industrial (`equipamento_id`, `setor`, `user`, `creat_at`).
- Event processing is asynchronous and polling-based: `worker.tick()` looks for pending records and sends messages when WhatsApp is connected. The worker updates dashboard state and emits Socket.IO events (`worker:stats_changed`, `falha:updated`, `falha:status`).
- WhatsApp session storage is persisted under `./auth_info_baileys` unless overridden by `WHATSAPP_SESSION_PATH`.
- The repository uses `dotenv` via `config` and expects a local `.env` file derived from `.env.example`; keep environment variable names stable when editing config.
- The Express routes also accept both `user` and `recipient` and both `equipamento_id` and `codigo_equipamento`, which reflects compatibility with external sources sending slightly different payload keys.

## File/location guidance
When working in this repo, prefer the existing boundaries:
- Backend logic lives under `server/`.
- Frontend UI and client-side data handling live under `src/`.
- Keep the event contract consistent with the worker and not just the UI.
- If you change persistence behavior, update the corresponding database logic in `server/db/database.ts` and keep the local JSON fallback in sync.
- If you change the WhatsApp flow, check `server/services/whatsapp.ts` and the Socket.IO event contract in `server/socket.ts`.

## When making changes
- Preserve the dual-mode database behavior: MySQL-first, embedded fallback.
- Maintain the `falhas` status semantics and retry logic when altering worker behavior.
- Keep token/session and login-rate-limit logic consistent with `server/services/auth.ts` if modifying dashboard authentication.
- Respect the repo's local-first operational model: many flows are designed to run without MySQL configured, especially for local demos.
