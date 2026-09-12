# AI Context

Permanent memory for future AI sessions. Prefer this file plus the linked docs over `README.md`.

**Maintenance rule:** If a change affects architecture, database, API, business rules, authentication, folder structure, coding standards, modules, or project context, update the matching file in `/docs` in the same session. Append an entry to [CHANGELOG_AI.md](./CHANGELOG_AI.md). Do not leave `/docs` stale.

---

## What this project is

InCare — hospital **in-patient** billing and deposits for a demo hospital (Central City Hospital), currency **ETB**.

Two runtimes:

- React SPA at repo root (`in-patients-billing`)
- Express + Mongo API in `/server` (`medbill-server`)

Default SPA mode talks to the API (`VITE_USE_API !== 'false'`).

---

## Architecture (short)

- SPA + REST. Context API. No Redux, no repository layer, no DI.
- Routes **are** controllers. Only service: `server/src/services/autoCharges.js`.
- Response shaping: `server/src/utils/mappers.js`.
- Dual-mode contexts: `if (USE_API)` vs `src/data/mockData.js`.
- Provider order in `App.jsx`: Theme → Toast → Auth → Patients → BillingConfig → ServiceEntries → Router.

Details: [ARCHITECTURE.md](./ARCHITECTURE.md).

---

## Folder structure (short)

```
src/pages/{reception,nurse,admin,manager}/
src/context/   src/api/client.js   src/lib/   src/data/mockData.js
server/src/{index.js,models,routes,services,middleware,utils,scripts/seed.js}
```

No `controllers/`, `dto/`, `entities/`. See [FOLDER_STRUCTURE.md](./FOLDER_STRUCTURE.md).

---

## Naming conventions

- Patient id: `PAT-001` (field `patientId` in Mongo, `id` on the client).
- Roles API: `Reception | Nurse | Admin | Manager`. Frontend `roleKey`: lowercase.
- Record frontend `type`: `daily_services` | `pharmacy_return`. API `recordType`: `daily` | `return`.
- Dates: `YYYY-MM-DD` strings.
- Token key: `medbill_token`.
- Alias: `@/` → `src/`.

---

## Common patterns

```js
// API client
const data = await apiFetch(path, { method, body: JSON.stringify(...) })
// throws Error(data.error)

// Express
router.post('/', authRequired, async (req, res) => {
  try { /* ... */ res.json(...) }
  catch (err) { console.error(err); res.status(500).json({ error: 'Failed to ...' }) }
})

// Context
if (USE_API) { const res = await api.xyz(); setState(...) ; return }
// mock branch
```

Balance: `depositTotal - approvedRecordTotals` (returns negative). Pending does not affect the bill.

Auto room/doctor lines: upsert by `{ patientId, date, autoType }`.

---

## Important modules

| Need | Go here |
|------|---------|
| Login / JWT | `auth.routes.js`, `AuthContext.jsx`, `middleware/auth.js` |
| Admit / deposit / transfer | `patients.routes.js`, `PatientsContext.jsx` |
| Charges / approve | `records.routes.js`, `patients.routes.js` record posts, `ServiceEntriesContext.jsx` |
| Daily room/doctor | `autoCharges.js` |
| Settings | `settings.routes.js`, `BillingConfigContext.jsx` |
| Charge UI | `ServiceRecordBuilder.jsx` |
| Validation | `src/lib/validation.js` **and** `server/src/utils/validation.js` |

---

## Business rules the AI must not invent

- Min **initial** deposit is **15000** ETB (admit). Additional deposits only need amount > 0.
- Admit does **not** collect emergency contact or admission reason. Admission date is optional on the form and defaults to today if left blank.
- Do not assume one active admission per person unless MRN/National ID is supplied.
- Do not assume payments cannot exceed balance — they can.
- Do not assume VAT is in the balance — it is not.
- Do not assume GET patient regenerates daily charges — it does not.
- Do not assume API updates pending records — it inserts.
- Do not assume nurse is blocked at the API — only the UI hides money and omits reception screens.
- Seed logins: `reception@cc`, `nurse@cc`, `admin@cc`, `manager@cc` / `password` — not `@stgabriel.et`.

Full list: [BUSINESS_RULES.md](./BUSINESS_RULES.md).

---

## Design principles

1. Approved records = bill. Pending = queue.
2. Room rate locks on `RoomAssignment`.
3. Nurse batches a day into one record (product intent); API does not enforce uniqueness.
4. Reception entries auto-approve when `source === 'reception'`.
5. Manager is read-oriented (API also allows Admin).

---

## Things the AI should never change (unless the user asks)

- Production source **in a docs-only task**
- Mapper field names consumed by the SPA (`id`, `admission_id`, `type`, `recordDate`, …)
- Dual-mode flag behavior without an explicit request to drop mock mode
- Currency / `formatCurrency` locale without a request
- Demo seed wipe behavior without warning (`deleteMany` on all core collections)
- Git history, secrets, or `.env` values

---

## Frequently reused code

- `cn`, `formatCurrency`, `formatDate` — `src/lib/utils.js`
- `StatCard`, `DataTable`, `PageHeader`, `StatusBadge` — `CommonComponents.jsx`
- `computeRecordTotal` — `ServiceEntriesContext.jsx`
- `toFrontendPatient` / `toFrontendRecord` / `buildRoomsFromBeds` — `mappers.js`
- `MIN_INITIAL_DEPOSIT`, `NON_CASH_PAYMENT_METHODS` — both validation files
- `RequireAuth` for any new role route
- `api` object in `src/api/client.js` — add helpers here, do not scatter raw `fetch`

---

## Preferred implementation style

- JavaScript, ESM, match the file’s existing semicolon/style.
- Add API + client validation together.
- Keep handlers in `*.routes.js`; extract a service only when logic is reused (like auto charges).
- Toast failures; `{ error: string }` on the API.
- After behavior changes, update `/docs` and this file if conventions changed.

---

## Preferred docs to open first

| Question | File |
|----------|------|
| What is the product? | [PROJECT_CONTEXT.md](./PROJECT_CONTEXT.md) |
| How do pieces connect? | [ARCHITECTURE.md](./ARCHITECTURE.md) |
| Endpoint contract | [API_REFERENCE.md](./API_REFERENCE.md) |
| Schema | [DATABASE.md](./DATABASE.md) |
| Can we do X? | [BUSINESS_RULES.md](./BUSINESS_RULES.md) |
| What’s broken? | [KNOWN_ISSUES.md](./KNOWN_ISSUES.md) |
