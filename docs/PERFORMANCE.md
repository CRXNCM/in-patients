# Performance

Related documents: [DATABASE.md](./DATABASE.md) · [ARCHITECTURE.md](./ARCHITECTURE.md) · [KNOWN_ISSUES.md](./KNOWN_ISSUES.md)

---

## Database queries

### N+1 / per-row work

| Location | What happens |
|----------|----------------|
| `GET /api/patients` | For **each** patient, `calcPatientBalance` runs `ServiceRecord.find` + `Patient.findOne` |
| `GET /api/patients?view=full` | Same per-patient balance, plus in-memory filter of all assignments |
| `GET /api/manager/dashboard` | `calcPatientBalance` again per inpatient; then JS aggregation over **all** deposits and **all** approved records |
| `ensureAutomaticDailyCharges` | For every date in stay: `RoomAssignment.findOne` + upsert room + upsert/delete doctor |

`calcPatientBalance` re-loads the Patient even when the caller already has it.

### Full-collection reads

- `GET /api/records` with no filter loads all records.
- ServiceEntriesContext calls `api.getRecords()` with **no query** after login.
- Manager dashboard loads all deposits, all approved records, all non-discharged patients, all beds.
- Deposit uniqueness check loads **all** existing `referenceNumber` values via `distinct` on every add-deposit.

### Indexes that help

- `User.email` unique
- `Patient.patientId` unique
- `Deposit.patientId`
- `Deposit.referenceNumber` unique sparse
- `RoomAssignment.patientId`
- `ServiceRecord.patientId`
- `ServiceRecord { patientId, date, autoType }`
- `ServiceCategory.slug` unique
- `HospitalSettings.key` unique
- `Bed.label` unique

There is no index on `ServiceRecord.status` (pending queue) or `Deposit.date` (today’s totals).

---

## Caching

| Layer | Caching |
|-------|---------|
| HTTP | None (`Cache-Control` not set) |
| Server | None (no Redis, no memory cache for settings) |
| Frontend | Context holds lists until mutation or reload |
| Settings | Re-read from Mongo on every auto-charge run and every manager dashboard build |

`HospitalSettings.findOne({ key: 'default' })` is a frequent hot path.

---

## Large loops (application)

- `eachDateInclusive(admission, today)` × room lookup × doctor upsert — cost grows with length of stay.
- Manager `dailyRevenueTrend` loops 7 days, each filtering the full deposit and record arrays.
- `revenueByDepartment` / `topServices` iterate every approved line in memory.
- Frontend `getApprovedLineItems` flattens all approved records for one patient (acceptable at ward scale).

---

## Potential bottlenecks

1. Ward with many patients: list endpoint does 2N extra queries for balances.
2. Long admissions: auto-charge regeneration on every transfer walks every day again and upserts existing rows.
3. Unbounded `GET /api/records` as the hospital accumulates history.
4. Manager dashboard is a single synchronous request doing all analytics.
5. No pagination on patients, records, or deposits (deposit report caps at 50; others do not).
6. Dual Context tree re-renders: ServiceEntries holds all records globally.

---

## Frontend / build

- Vite code-splitting: **not configured** (single `index` bundle plus CSS in `dist/`).
- Recharts is in the main graph (loaded even for reception/nurse).
- Login background image is a static PNG import.
- Search box does not query — no extra network cost.
- Print paths open a new window or use `window.print` — fine for single documents.

---

## Optimization opportunities (not implemented)

- Compute balances with one `aggregate` grouped by `patientId`.
- Pass `depositTotal` into `calcPatientBalance` to skip the extra Patient fetch.
- Generate only **missing** auto-charge dates instead of upserting the full range.
- Call `ensureAutomaticDailyCharges` on GET patient (documented in BACKEND_TODO but not coded) **or** a daily job — with care for write amplification.
- Paginate records; default `GET /api/records` to pending + recent.
- Cache settings in memory with TTL.
- Add `status` index on ServiceRecord.
- Lazy-load Recharts / manager pages.
- Use Mongo transactions only if concurrent admit/transfer races appear.

---

## Expensive operations that are acceptable at current demo scale

Seeded dataset is 2 patients and 44 beds. The query patterns above become important once hundreds of stays and months of daily auto-records exist (2 auto records per patient per day).
