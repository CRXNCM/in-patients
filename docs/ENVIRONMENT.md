# Environment

Related documents: [DEPENDENCIES.md](./DEPENDENCIES.md) · [AUTHENTICATION.md](./AUTHENTICATION.md) · [SECURITY.md](./SECURITY.md)

Do not commit real secrets. `server/.env` and root `.env` are gitignored. This document lists **variable names and behavior only**.

---

## Backend (`server/.env`)

Template: `server/.env.example`.

| Variable | Required | Default in code | Purpose |
|----------|----------|-----------------|---------|
| `MONGODB_URI` | **Yes** | none — process exits if missing | Mongo connection string |
| `JWT_SECRET` | **Yes in practice** | none — `jwt.sign` / `jwt.verify` use `process.env.JWT_SECRET` | HMAC secret for access tokens |
| `PORT` | No | `5000` | HTTP listen port |
| `CORS_ORIGIN` | No | `http://localhost:5173` | Allowed browser origin |

Example values in `.env.example` are local-dev placeholders (`mongodb://127.0.0.1:27017/medbill`, `JWT_SECRET=change-this-in-production`). **Do not reuse that secret in production.**

`dotenv` is loaded at the top of `server/src/index.js` and `server/src/scripts/seed.js`.

---

## Frontend (Vite)

There is **no** committed frontend `.env.example`. Vite exposes only variables prefixed with `VITE_`.

| Variable | Required | Default in code | Purpose |
|----------|----------|-----------------|---------|
| `VITE_API_URL` | No | `http://localhost:5000` | API origin (no trailing path) |
| `VITE_USE_API` | No | API **enabled** unless the value is exactly `'false'` | Set `false` to run mock-only SPA |

Examples:

```
VITE_API_URL=http://localhost:5000
VITE_USE_API=false
```

Any other value of `VITE_USE_API` (including unset) uses the live API.

---

## Runtime files that are not env vars

| Key | Storage | Purpose |
|-----|---------|---------|
| `medbill_token` | sessionStorage | JWT |
| `medbill_user` | sessionStorage | Cached user JSON |
| `theme` | localStorage | `dark` or unset/light |

---

## How to run locally

**API:**

```bash
cd server
npm install
# copy .env.example → .env and set MONGODB_URI, JWT_SECRET
npm run seed
npm run dev
```

**SPA:**

```bash
npm install
npm run dev
```

MongoDB must be reachable when API mode is on. Production host, TLS, and replica-set settings are **Unknown from current implementation**.

---

## Build-time vs runtime

- Frontend env is baked in at `vite build`. Changing `VITE_*` after build has no effect until rebuild.
- Backend reads `process.env` at process start (`node --watch` restarts on file change, not automatically on `.env` change unless the file is watched — **Unknown** whether `--watch` includes `.env`).
