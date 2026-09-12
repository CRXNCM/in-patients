# Dependencies

Related documents: [ENVIRONMENT.md](./ENVIRONMENT.md) · [ARCHITECTURE.md](./ARCHITECTURE.md)

Versions below are from `package.json` / `server/package.json` at documentation time. Lockfiles may pin exact builds.

---

## Frontend runtime (`package.json`)

| Package | Version | Why it exists |
|---------|---------|----------------|
| `react` / `react-dom` | ^18.3.1 | UI runtime |
| `react-router-dom` | ^6.28.1 | Role-based client routing (`BrowserRouter`, `Outlet`, `Navigate`) |
| `lucide-react` | ^0.469.0 | Icons |
| `recharts` | ^2.15.0 | Manager dashboard charts |
| `clsx` | ^2.1.1 | Conditional class names |
| `tailwind-merge` | ^2.6.0 | Resolve Tailwind class conflicts in `cn()` |
| `class-variance-authority` | ^0.7.1 | Variant API for UI primitives (e.g. Button) |
| `tailwindcss-animate` | ^1.0.7 | Animation utilities used by the UI kit |
| `@radix-ui/react-alert-dialog` | ^1.1.6 | Delete / reject confirmations |
| `@radix-ui/react-avatar` | ^1.1.3 | User avatar fallback |
| `@radix-ui/react-dialog` | ^1.1.6 | Modals (deposit, record detail, add service) |
| `@radix-ui/react-dropdown-menu` | ^2.1.6 | Declared; **no `dropdown-menu` component file exists** — unused or reserved |
| `@radix-ui/react-label` | ^2.1.2 | Form labels |
| `@radix-ui/react-select` | ^2.1.6 | Select primitive (file exists; many forms still use native `<select>`) |
| `@radix-ui/react-separator` | ^1.1.2 | Visual separators |
| `@radix-ui/react-slot` | ^1.1.2 | `asChild` composition for Button |
| `@radix-ui/react-switch` | ^1.1.3 | Switch primitive |
| `@radix-ui/react-tabs` | ^1.1.3 | Charge-entry category tabs |
| `@radix-ui/react-toast` | ^1.2.6 | Toast viewport |
| `@radix-ui/react-tooltip` | ^1.1.8 | Declared; **no tooltip wrapper in `src/components/ui`** — unused or reserved |

There is **no** axios, react-query, redux, formik/yup, or date library. HTTP is `fetch`. Dates use `Date` / ISO strings.

---

## Frontend development

| Package | Version | Purpose |
|---------|---------|---------|
| `vite` | ^6.0.5 | Dev server and production bundler |
| `@vitejs/plugin-react` | ^4.3.4 | JSX / Fast Refresh |
| `tailwindcss` | ^3.4.17 | Utility CSS |
| `postcss` | ^8.4.49 | Tailwind pipeline |
| `autoprefixer` | ^10.4.20 | Vendor prefixes |

**Scripts:**

| Script | Command | Purpose |
|--------|---------|---------|
| `dev` | `vite` | SPA at port 5173 (Vite default) |
| `build` | `vite build` | Output to `dist/` |
| `preview` | `vite preview` | Serve production build |

**Vite configuration:** React plugin; alias `@` → `./src`. No proxy to the API is configured — the SPA calls `VITE_API_URL` directly (CORS).

---

## Backend runtime (`server/package.json`)

| Package | Version | Why it exists |
|---------|---------|----------------|
| `express` | ^4.21.2 | HTTP API |
| `mongoose` | ^8.9.3 | MongoDB ODM |
| `jsonwebtoken` | ^9.0.2 | Sign/verify access tokens |
| `bcryptjs` | ^2.4.3 | Password hashing (JS implementation, no native addon) |
| `cors` | ^2.8.5 | Browser access from the Vite origin |
| `dotenv` | ^16.4.7 | Load `server/.env` via `import 'dotenv/config'` |

No express-validator, helmet, morgan, express-rate-limit, multer, or test runner.

**Scripts:**

| Script | Command | Purpose |
|--------|---------|---------|
| `dev` | `node --watch src/index.js` | Restart on file change |
| `start` | `node src/index.js` | Production-style process |
| `seed` | `node src/scripts/seed.js` | Wipe and insert demo data |

---

## Important configuration

### CORS (`server/server.js`)

```js
app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:5173', credentials: true }))
```

Single origin string, not a list.

### Mongo (`server/config/db.js`)

`mongoose.set('strictQuery', true)` then `mongoose.connect(uri)`.

### JWT

Signed with `JWT_SECRET`, `expiresIn: '7d'`. Bcrypt cost in seed: **10**.

### Tailwind

`darkMode: ['class']` on `<html>`. Colors are CSS variables in `src/index.css`. Font: Inter (Google Fonts in `index.html`).

### Path alias

`jsconfig.json` + `vite.config.js` both define `@/*`.

---

## External / implicit dependencies

| Dependency | Notes |
|------------|-------|
| Node.js | Required; exact version **Unknown from current implementation** (no engines field) |
| MongoDB | Required for API mode |
| Browser `fetch`, `sessionStorage`, `localStorage`, `window.print` | Required |
| Google Fonts (Inter) | Loaded from fonts.googleapis.com in `index.html` |

---

## Why some libraries are absent

The stack favors a small surface: Context instead of Redux, `fetch` instead of axios, duplicated validation instead of a shared Zod package, browser print instead of pdfkit/jspdf.
