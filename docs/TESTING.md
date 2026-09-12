# Testing

Related documents: [KNOWN_ISSUES.md](./KNOWN_ISSUES.md) · [ROADMAP.md](./ROADMAP.md)

---

## Existing tests

**Server unit tests:** `server/utils/dischargeRules.test.js` via `npm test` in `/server` (`node --test`). Covers discharge status transitions, reject-reason validation, and inpatient write guards.

There is still no frontend test runner and no API/E2E suite.

---

## Coverage

**Unknown from current implementation** — no coverage tool (Jest, Vitest, c8, Cypress, Playwright) is configured.

---

## Frameworks

| Kind | Present |
|------|---------|
| Unit test runner | `node:test` (server discharge rules only) |
| React Testing Library | No |
| API integration tests | No |
| E2E | No |
| MSW / API mocks for tests | No (runtime mock data is not a test harness) |

`node --watch` and Vite HMR are development tools, not tests.

---

## Missing tests (high value)

Given current business rules, the following have **no automated protection**:

1. `validateAdmitBody` / `validateAdmission` — min deposit 15000, future admission date, age bounds
2. `validateDepositBody` — non-cash reference, duplicate ref
3. `validateTransferBody` — date window, discharged patient
4. `calcPatientBalance` — approved vs pending; pharmacy return credits
5. `ensureAutomaticDailyCharges` — one room/doctor per day; disabled doctor dates; rate after transfer
6. Admit route — bed occupancy, PAT- id allocation, MRN clash
7. Transfer route — old bed freed, same-bed rejection
8. Approve/reject — only pending; audit trail
9. Auth — inactive user, requireRole 403
10. `RequireAuth` redirects
11. Mapper contract (`toFrontendRecord` type mapping)

---

## Recommended strategy

When tests are added, prefer the existing stack rather than a new language:

| Layer | Suggested tool | Scope |
|-------|----------------|-------|
| Pure functions | Vitest (frontend) + Node test or Vitest (server utils) | validation, mappers, `computeRecordTotal` |
| API | Supertest + mongodb-memory-server | routes with seeded fixtures |
| UI | Vitest + Testing Library | Login, RequireAuth, ServiceRecordBuilder cart |
| E2E | Playwright against seed data | Admit → nurse submit → approve → balance |

Keep `VITE_USE_API=false` paths either tested separately or deleted later so they do not double the matrix.

---

## Manual verification currently used

- Login demo accounts
- Seed script stdout counts
- `GET /api/health`
- Browser clicks through role dashboards

These are not repeatable CI checks. CI configuration is **Unknown from current implementation** (no `.github/workflows` in the documented tree).
