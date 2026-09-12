# Migration plan: separate `frontend/` and `server/`

**Status:** Executed 2026-09-12. Increment 1 (`frontend/`) and Increment 2 (flatten `server/src` → `server/server.js`) are done. No `controllers/` folder. No Vite proxy. Root helper scripts added.

Related: [FOLDER_STRUCTURE.md](./FOLDER_STRUCTURE.md) · [ENVIRONMENT.md](./ENVIRONMENT.md) · [DEPENDENCIES.md](./DEPENDENCIES.md)

---

## Inspection answers

| # | Question | Finding |
|---|----------|---------|
| 1 | Frontend files | Root `src/`, `public/`, `index.html`, `package.json`, `package-lock.json`, `vite.config.js`, `tailwind.config.js`, `postcss.config.js`, `jsconfig.json`. Build output `dist/`. Assets under `src/asset/`. |
| 2 | Backend files | Already a separate package: `server/package.json`, `server/src/**`, `server/.env.example`. No `controllers/` today. Entry: `server/src/index.js`. |
| 3 | Frontend start | From repo root: `npm run dev` → Vite on port **5173**. |
| 4 | Backend start | From `server/`: `npm run dev` → `node --watch src/index.js` on port **5000**. |
| 5 | API URLs | `src/api/client.js`: `VITE_API_URL` or `http://localhost:5000`, then `fetch(\`${API_URL}${path}\`)` e.g. `/api/patients`. |
| 6 | Env | Backend: `server/.env` (`MONGODB_URI`, `JWT_SECRET`, `PORT`, `CORS_ORIGIN`). Frontend: optional root `.env` with `VITE_*` (no committed example). |
| 7 | package.json | **Already two.** Root = SPA only. `server/` = Express only. No npm workspaces. |
| 8 | Vite proxy | **None.** SPA calls the API origin directly. CORS in `server/src/index.js` allows `CORS_ORIGIN` or `http://localhost:5173`. |
| 9 | Imports | Frontend uses `@/` → `./src` (Vite + jsconfig). Backend uses relative `../models` etc. inside `server/src/`. |
| 10 | Auth / API | JWT in `sessionStorage` (`medbill_token`). `Authorization: Bearer`. Dual mode: `VITE_USE_API !== 'false'` uses API; else `src/data/mockData.js`. |
| 11 | Socket.IO | **Not used.** HTTP + JSON only. |
| 12 | Frontend imports backend? | **No.** Grep found no `server` imports from `src/`. |
| 13 | Backend depends on frontend paths? | **No.** Seed/routes/models do not reference `../src` or the SPA. |

The two runtimes are already logically separate. The problem is **layout**: the React app lives at the repo root, so `server/` looks nested inside the frontend project.

---

## Current structure

```
in-patients/
├── src/                    React app
├── public/
├── index.html
├── package.json            name: in-patients-billing (Vite)
├── vite.config.js          alias @ → ./src; no proxy
├── tailwind.config.js      content: ./index.html, ./src/**
├── postcss.config.js
├── jsconfig.json
├── dist/                   Vite build (generated)
├── server/
│   ├── package.json        name: medbill-server
│   ├── .env.example
│   └── src/
│       ├── index.js
│       ├── config/
│       ├── middleware/
│       ├── models/
│       ├── routes/         handlers live here (no controllers/)
│       ├── services/
│       ├── utils/
│       └── scripts/seed.js
├── docs/
├── README.md
├── BACKEND_TODO.txt
├── users.txt
└── .gitignore
```

---

## Target structure (approved shape, with one deliberate omission)

```
in-patients/
├── frontend/
│   ├── src/
│   ├── public/
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   └── ...
├── server/
│   ├── config/
│   ├── models/
│   ├── routes/
│   ├── services/
│   ├── middleware/
│   ├── utils/
│   ├── scripts/
│   ├── server.js
│   └── package.json
├── docs/
└── README.md
```

**`controllers/` will not be created.** This app has no controller layer; routes are the handlers. Adding empty controllers would be a rewrite, not a split. If you want that folder later, it is a separate refactor.

**`server/src/` will be flattened** to match your diagram (`server/server.js` instead of `server/src/index.js`). Internal relative imports stay the same depth (routes still `../models`). Only the entry file path and npm scripts change.

---

## Recommended approach: two increments

### Increment 1 — Move the SPA into `frontend/` (required)

This is the actual frontend/backend separation.

| Move | From | To |
|------|------|-----|
| SPA source | `src/` | `frontend/src/` |
| Public assets | `public/` | `frontend/public/` |
| HTML shell | `index.html` | `frontend/index.html` |
| Frontend package | `package.json`, `package-lock.json` | `frontend/` |
| Vite / Tailwind / PostCSS / jsconfig | `vite.config.js`, `tailwind.config.js`, `postcss.config.js`, `jsconfig.json` | `frontend/` |
| Optional env example | (none today) | `frontend/.env.example` (new, no secrets) |

Leave at repo root: `docs/`, `README.md`, `.gitignore`, `server/`.

**Do not move as “source”:** `dist/` (regenerate with `frontend` build). `.VSCodeCounter/` (tool output). `node_modules/` (reinstall in `frontend/`).

Root leftovers to keep (not frontend runtime): `BACKEND_TODO.txt`, `users.txt`. They can stay at root or later move under `docs/` — not part of this split.

### Increment 2 — Flatten `server/src/` (matches your tree)

| Move | From | To |
|------|------|-----|
| Entry | `server/src/index.js` | `server/server.js` |
| Config | `server/src/config/` | `server/config/` |
| Middleware | `server/src/middleware/` | `server/middleware/` |
| Models | `server/src/models/` | `server/models/` |
| Routes | `server/src/routes/` | `server/routes/` |
| Services | `server/src/services/` | `server/services/` |
| Utils + tests | `server/src/utils/` | `server/utils/` |
| Seed | `server/src/scripts/` | `server/scripts/` |

Then delete empty `server/src/`.

---

## Imports that need updating

### Frontend (Increment 1)

Almost none inside `src/`. `@/` is resolved from `frontend/vite.config.js` and `frontend/jsconfig.json` as `./src` **relative to `frontend/`**, so `import from '@/api/client'` stays valid.

`index.html` still has `<script type="module" src="/src/main.jsx">` — still correct once `index.html` lives next to `frontend/src`.

### Backend (Increment 2)

All current files under `server/src/{routes,services,utils,scripts,middleware}` use `../models`, `../config`, etc. After lifting one directory, those relatives **stay valid**.

Only the entry file changes location:

```js
// server/server.js (same contents as today’s index.js)
import { connectDB } from './config/db.js'
import authRoutes from './routes/auth.routes.js'
// ...
```

`dotenv` still loads `server/.env` when you run commands from `server/`.

### Docs (after both increments)

Many docs say `src/` (SPA) and `server/src/...`. Update path strings only; no behavior change.

---

## package.json changes

### Root `package.json`

**Remove** the Vite app from the root (it moves to `frontend/`).

Optional small root helper (recommended, not required):

```json
{
  "name": "in-patients",
  "private": true,
  "scripts": {
    "dev:frontend": "npm run dev --prefix frontend",
    "dev:server": "npm run dev --prefix server",
    "build:frontend": "npm run build --prefix frontend"
  }
}
```

This is convenience only. No workspaces, no shared dependencies.

### `frontend/package.json`

Same as today’s root package (`in-patients-billing`). Scripts unchanged: `dev`, `build`, `preview`.

### `server/package.json`

```json
"scripts": {
  "dev": "node --watch server.js",
  "start": "node server.js",
  "seed": "node scripts/seed.js",
  "test": "node --test utils/dischargeRules.test.js"
}
```

No new dependencies. Mongo/Express stay as they are.

---

## Vite configuration

Move `vite.config.js` as-is. Alias stays:

```js
alias: { '@': path.resolve(__dirname, './src') }
```

`__dirname` becomes `frontend/`, so `@` → `frontend/src`. **No proxy will be added.** Current CORS + `VITE_API_URL` already works. Adding a proxy would change how the browser talks to the API and is unnecessary for this split.

Tailwind `content` paths stay `./index.html` and `./src/**/*.{js,jsx}` relative to `frontend/`.

---

## Environment variables

| Location | Change |
|----------|--------|
| `server/.env` | Stay at `server/.env`. Same keys. `CORS_ORIGIN=http://localhost:5173` still correct (Vite port unchanged). |
| `server/.env.example` | Unchanged. |
| Frontend env | After the move, Vite reads `frontend/.env` (not repo-root `.env`). Anyone who has a root `.env` with `VITE_*` must **copy it to `frontend/.env`**. |
| New | `frontend/.env.example` with `VITE_API_URL=http://localhost:5000` only. |

No new env names. No auth behavior change.

---

## API / proxy

- No Vite proxy today; none after.
- API base remains `http://localhost:5000`.
- Paths remain `/api/auth`, `/api/patients`, etc.
- `client.js` does not change unless we later add `frontend/.env` documentation.

---

## Startup / development commands

**After migration:**

```bash
# Backend (Mongo must be running)
cd server
npm install          # once
# ensure .env exists (copy .env.example)
npm run seed         # once / when resetting demo data
npm run dev          # http://localhost:5000

# Frontend (other terminal)
cd frontend
npm install          # once
npm run dev          # http://localhost:5173
```

If a root helper `package.json` is approved:

```bash
npm run dev:server
npm run dev:frontend
```

**Build:**

```bash
cd frontend && npm run build    # output: frontend/dist
cd server && npm start          # API only; does not serve the SPA
```

---

## Build / deployment implications

- Two deployables, as today: static SPA + Node API.
- SPA `dist/` moves from repo-root `dist/` to `frontend/dist/`.
- Hosting that currently runs `npm run build` at repo root must run it in `frontend/`.
- API process cwd should remain `server/` so `dotenv` finds `server/.env`.
- CORS must list the real SPA origin in production (already true).

---

## Risks

| Risk | Mitigation |
|------|------------|
| Local `VITE_*` in root `.env` stops applying | Copy to `frontend/.env`; document it. |
| Empty `controllers/` or new layers | Do not add them. |
| Flattening `server/src` breaks a missed relative import | Increment 2 is a mechanical lift; run `npm test` and `npm run dev` in `server/`. |
| Git / IDE open files point at old paths | Expected; reopen from `frontend/src`. |
| `dist/` and `node_modules` left at root | Delete generated root `dist/` and root `node_modules` after `frontend/npm install`. |
| README still says `npm run dev` at root | Update README + ENVIRONMENT.md in the same change. |
| Accidental logic rewrite | Move/rename only. No feature edits in this migration. |

---

## What will not change

- MongoDB
- JavaScript (no TypeScript)
- Roles / auth rules / JWT
- Discharge, billing, or other business logic
- Dual mock mode (`VITE_USE_API=false`)
- Socket.IO (still unused)
- Deleting files just because they look unused (`users.txt`, `BACKEND_TODO.txt`, mock catalog pages stay)

---

## Files expected to be modified (not moved)

- `.gitignore` — ignore `frontend/node_modules`, `frontend/.env`, `frontend/dist`; keep `server/.env`
- `README.md` — start commands
- `docs/ENVIRONMENT.md`, `FOLDER_STRUCTURE.md`, `AI_CONTEXT.md`, `ARCHITECTURE.md`, and other docs that hard-code `src/` or `server/src/`
- `server/package.json` scripts (Increment 2)
- New optional root `package.json` helper scripts
- New `frontend/.env.example`

---

## Approval checklist

Please confirm:

1. **Increment 1** (move SPA to `frontend/`) — proceed?
2. **Increment 2** (flatten `server/src` → `server/server.js`) — proceed, or keep `server/src/`?
3. **Omit `controllers/`** — agreed?
4. **Optional root helper scripts** — yes or no?
5. **No Vite proxy** — agreed?

No code will be moved until you approve.
