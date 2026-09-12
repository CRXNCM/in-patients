# Coding Standards

Inferred from the current codebase. These are conventions to follow so new code matches existing style. Related: [AI_CONTEXT.md](./AI_CONTEXT.md) · [ARCHITECTURE.md](./ARCHITECTURE.md)

---

## Language and modules

- JavaScript only (no TypeScript).
- ES modules (`"type": "module"`, `import` / `export`).
- Frontend components: function components + hooks. Default-export pages; named-export shared components and hooks.
- Backend: named Mongoose model exports (`export const Patient = ...`); default-export each Express router.

---

## Naming

| Kind | Convention | Examples |
|------|------------|----------|
| React components | PascalCase | `PatientBilling`, `RequireAuth` |
| Hooks / context consumers | `use` prefix | `usePatients`, `useAuth` |
| Context objects | `*Context` / `*Provider` | `AuthProvider` |
| API helpers | camelCase verb | `getPatientsFull`, `addDeposit` |
| Route files | `*.routes.js` | `patients.routes.js` |
| Models | singular PascalCase | `ServiceRecord` |
| Patient public id | `PAT-` + 3+ digits | `PAT-001` |
| Bed labels | `{prefix}-{nn}` | `GW-12` |
| Frontend role paths | lowercase | `/reception` |
| API role enum | capitalized | `Reception` |
| session keys | `medbill_*` | `medbill_token` |
| Env vars | SCREAMING_SNAKE | `MONGODB_URI`, `VITE_API_URL` |

Dates in business data are **`YYYY-MM-DD` strings**, not Date objects (except `recordedAt` / Mongoose timestamps).

---

## Folder organization

- Pages by **role folder**, not by feature folder.
- Shared widgets in `src/components/shared`; primitives in `src/components/ui`.
- One Express router per resource prefix.
- Models are flat files in `server/models`.
- Do not introduce `controllers/` or `repositories/` unless the project is later restructured — current code keeps handlers in routers.

---

## Imports

- Frontend path alias: `@/` → `src/` (Vite + jsconfig).
- Prefer `@/context/...`, `@/lib/utils`, `@/api/client`.
- Backend uses relative imports (`../models/Patient.js`) including the `.js` extension.

---

## Dependency injection

**Not used.** Modules import Mongoose models and helpers directly. Do not add a container unless explicitly requested.

---

## Repository pattern

**Not used.** Routes call `Patient.findOne`, `Bed.findOne`, etc. Keep that pattern unless a broader refactor is requested.

---

## Async conventions

- Express handlers: `async (req, res)` with `try/catch` and `res.status().json()`.
- Frontend mutations: `async` context callbacks; pages `try/catch` and `useToast`.
- `apiFetch` is async and **throws** on `!res.ok`.
- Effects that fetch set a `cancelled` flag or ignore stale updates.

---

## Validation

- Client: `src/lib/validation.js` returns `{ field: message }` objects plus `firstError` / `hasErrors`.
- Server: `server/utils/validation.js` returns **string arrays**; handlers send `errors[0]` as `{ error }`.
- Duplicate important rules on both sides (min deposit, transfer dates). When adding a rule, update **both** files and [BUSINESS_RULES.md](./BUSINESS_RULES.md).
- Mongoose enums/required are a second line of defense, not the UX layer.

---

## Error handling

- API: `{ error: string }` only. No error codes or stack traces to the client.
- Log with `console.error(err)` in catch blocks.
- Frontend: toast `variant: 'destructive'` with `err.message`.
- Context hooks throw if used outside their provider (`useAuth must be used within AuthProvider`).

Details: [ERROR_HANDLING.md](./ERROR_HANDLING.md).

---

## Logging

- Server: `console.log` for listen/Mongo connected; `console.error` for failures.
- No structured logger (pino/winston) and no request-id middleware.
- Do not log passwords or full JWT tokens.

---

## Formatting and UI

- JSX 2-space indent; many files omit trailing semicolons inconsistently — match the file you edit.
- Tailwind utility classes; `cn()` (`clsx` + `tailwind-merge`) for conditional classes.
- Currency via `formatCurrency` (`en-ET`, `ETB`).
- shadcn-style Card / Dialog / Button rather than new CSS frameworks.
- Print UI uses `no-print` and body classes `print-invoice-mode` / `print-deposit-mode`.

---

## State and data mapping

- Keep dual-mode (`if (USE_API)`) when changing contexts, unless mock mode is being removed in that change.
- Server responses must stay compatible with mappers in `server/utils/mappers.js` and the fields the SPA already reads (`id` not `patientId` on the client patient object, `type: 'daily_services'`, snake_case assignment fields, etc.).
- Do not invent new collections when an existing string/enum field already models the concept (e.g. role on User).

---

## Architecture principles visible in the code

1. **Role UIs are separate page trees** sharing builders (ServiceRecordBuilder).
2. **Approved records are the bill.** Pending is informational.
3. **Rates lock on RoomAssignment**, not live Bed updates for past days.
4. **Balance is computed**, never stored.
5. **Thin API client**, fat contexts.
6. **Fat routes**, thin models.

---

## Things not to “clean up” casually

- Dual mock/API branches (product still supports `VITE_USE_API=false`).
- Mapper field names that look inconsistent (`admission_id`, `bed_id`) — the SPA depends on them.
- Demo password display on the login page (intentional for local demo).
