# Nurse Dashboard Implementation Specification

Status: **backend implemented**. `GET /api/nurse/dashboard` is live. The Nurse SPA still uses shared patient/record contexts and was **not** changed in this step.

---

## 1. Endpoint

| | |
|-|-|
| **Method / path** | `GET /api/nurse/dashboard` |
| **Route file** | `server/routes/nurse.routes.js` |
| **Mount** | `app.use('/api/nurse', nurseRoutes)` in `server/server.js` |
| **Service** | `server/services/nurseDashboard.js` — `buildNurseDashboard(req.user)` |
| **Tests** | `server/services/nurseDashboard.test.js` (unit), `server/services/nurseDashboard.http.test.js` (HTTP + Mongo) |
| **Frontend** | Not wired yet. Do not call Admin or Manager dashboard endpoints. |

This payload is separate from `GET /api/admin/dashboard` and `GET /api/manager/dashboard`.

Errors: `{ error: string }` (`Unauthorized`, `Invalid or expired token`, `Forbidden`, `Failed to load dashboard`).

---

## 2. Authentication and RBAC

- `authRequired` then `requirePermission('patients.view')`.
- Super Admin (`role.slug === 'super-admin'` and `role.active !== false`) still receives every catalog key via `roleHasPermission` / `roleHasAllPermissions`. An empty `permissions` array on that role still passes.
- No `requireRole('Nurse')`. A custom role with `patients.view` can call the endpoint (including Admin/Reception users who have that key).
- There is no `nurse.dashboard` permission.

All sections are operational and require the same gate. The response does not omit keys by extra finance/setup permissions because those domains are never loaded.

---

## 3. Date and time

This endpoint does not compute “today” totals. Stored stay dates remain `YYYY-MM-DD` strings on `Patient.admissionDate`.

If a later revision adds “records today” or “admitted today”, use `todayStr()` and `localDayRange()` from `server/utils/dates.js` (process local calendar). Do not use UTC `toISOString().slice(0, 10)`.

`generatedAt` is `new Date().toISOString()` (response timestamp only).

`recentSubmissions[].recordedAt` is ISO from `ServiceRecord.recordedAt`, falling back to `createdAt`.

---

## 4. Response shape

```json
{
  "generatedAt": "2026-09-12T21:00:00.000Z",
  "census": {
    "admitted": 0,
    "pendingDischarge": 0
  },
  "workQueue": {
    "myPendingRecords": 0,
    "pendingDischarge": 0
  },
  "recentSubmissions": [
    {
      "id": "66f0…",
      "patientId": "PAT-001",
      "patientName": "Hana Bekele",
      "recordName": "Day 2 services",
      "type": "daily_services",
      "status": "pending",
      "recordedAt": "2026-09-12T08:00:00.000Z",
      "source": "nurse"
    }
  ],
  "needsAttention": [
    {
      "patientId": "PAT-002",
      "name": "Abebe Kebede",
      "room": "General Ward",
      "bed": "GW-01",
      "status": "pending-discharge",
      "admissionDate": "2026-09-10"
    }
  ],
  "currentInpatients": [
    {
      "patientId": "PAT-001",
      "name": "Hana Bekele",
      "room": "General Ward",
      "bed": "GW-01",
      "status": "admitted",
      "admissionDate": "2026-09-11",
      "admissionType": "normal",
      "assignedDoctors": [
        {
          "id": "66f1…",
          "doctorId": "66f2…",
          "doctorName": "Dr. Tesfaye",
          "specialty": "Surgeon",
          "subjectType": "mother",
          "babyId": null,
          "status": "active",
          "effectiveFrom": "2026-09-11"
        }
      ]
    }
  ]
}
```

Empty hospital / empty personal queue: real zeros and `[]`, not mock numbers.

### Field-name notes

| Area | Choice | Why |
| --- | --- | --- |
| Census admitted | `admitted` | Nurse-specific; not Admin’s `currentlyAdmitted` (Admin also has admitted-today / discharged-today). |
| Patient display on stay lists | `name` | Matches `Patient.name` and Admin recent-admission rows. |
| Patient display on record rows | `patientName` | Distinguishes the stay from `recordName`. |
| Record `type` | `daily_services` / `pharmacy_return` / `manual` | Same mapping as `toFrontendRecord` (`daily` → `daily_services`, `return` → `pharmacy_return`). |
| Room / bed | `string` or `null` | From `Patient.room` / `Patient.bed` only. No bed-inventory load. |

---

## 5. Queries (implemented)

Collections are not loaded in full. Counts use `countDocuments`. Lists use `sort` + `limit` + `select` + `lean`.

### Census — `Patient`

| Field | Filter |
| --- | --- |
| `census.admitted` | `{ status: 'admitted' }` |
| `census.pendingDischarge` | `{ status: 'pending-discharge' }` |

`pending-discharge` stays are **not** included in `admitted`. Discharged stays are in neither count. The boolean `pendingDischarge` on the document is not used.

### Work queue

| Field | Filter |
| --- | --- |
| `myPendingRecords` | `{ submittedBy: <authenticated user.name>, status: 'pending' }` |
| `pendingDischarge` | Same count as `census.pendingDischarge` |

Identity: `ServiceRecord.submittedBy` is a **display-name string** written as `req.user.name` on record create (see `patients.routes.js`). There is no `submittedByUserId`. If `user.name` is empty, both personal queries are skipped (`0` / `[]`) so unnamed users are not matched to `null` / missing submitters.

### Recent submissions — `ServiceRecord`

```
ServiceRecord.find({ submittedBy: user.name })
  .sort({ recordedAt: -1, createdAt: -1 })
  .limit(6)
  .select('patientId recordName recordType status recordedAt createdAt source submittedBy')
```

Then one `Patient.find({ patientId: { $in } }).select('patientId name')` to attach `patientName`. Hospital-wide records are not returned. Service lines, return lines, prices, and audit trails are not selected.

### Needs attention — `Patient`

```
Patient.find({ status: 'pending-discharge' })
  .sort({ dischargeRequestedAt: -1, admissionDate: -1, createdAt: -1 })
  .limit(6)
  .select('patientId name room bed status admissionDate')
```

Only this confirmed operational condition. No vitals, severity, or “no record today” rules.

### Current inpatients — `Patient` + active `DoctorAssignment`

```
Patient.find({ status: { $in: ['admitted', 'pending-discharge'] } })
  .sort({ admissionDate: -1, createdAt: -1 })
  .limit(8)
  .select('patientId name room bed status admissionDate admissionType')
```

Then one assignment query for those patient ids:

```
DoctorAssignment.find({ patientId: { $in }, status: 'active' })
  .select('patientId doctorId doctorNameSnapshot specialtySnapshot subjectType babyId status effectiveFrom')
```

`visitPriceSnapshot` is not selected and not mapped.

Balances, deposits, beds inventory, and credit flags are not queried.

---

## 6. Data visibility

**Included:** stay identity, status, admission date/type, room/bed labels on the stay, active visiting doctors (name/specialty), the caller’s own service records (name, type, status, time, source).

**Never included:** deposits, payments, outstanding balances, `isCreditPatient`, visit prices, revenue, catalog/setup counts, occupancy, user management.

---

## 7. Error handling

| Case | HTTP | Body |
| --- | --- | --- |
| No token | 401 | `{ error: 'Unauthorized' }` |
| Invalid token | 401 | `{ error: 'Invalid or expired token' }` |
| Inactive user | 401 | `{ error: 'Unauthorized' }` |
| Missing `patients.view` | 403 | `{ error: 'Forbidden' }` |
| Query failure | 500 | `{ error: 'Failed to load dashboard' }` |
| Empty hospital / empty personal queue | 200 | zeros / `[]` |

---

## 8. Indexes

Not added. Existing indexes: unique `Patient.patientId`; `ServiceRecord.patientId`; `DoctorAssignment.patientId`.

Useful later if measured slow: `{ status: 1 }` on Patient; `{ submittedBy: 1, status: 1 }` and `{ submittedBy: 1, recordedAt: -1 }` on ServiceRecord.

---

## 9. Tests

Unit (`nurseDashboard.test.js`): empty payload; admitted vs pending-discharge; submitter scoping; no record query without a name; needs-attention status; inpatient field allow-list; no finance/admin keys.

HTTP (`nurseDashboard.http.test.js`, requires `MONGODB_URI` + `JWT_SECRET`):

1. Nurse-like user with `patients.view` → 200
2. No token / invalid token → 401
3. Authenticated user with only `reports.view` → 403
4. Census matches `countDocuments` for `admitted` and `pending-discharge` separately
5. Pending-discharge stays are not added into `admitted`
6. `myPendingRecords` matches records for `user.name` only
7. `recentSubmissions` excludes another user’s records
8. `currentInpatients` length ≤ 8 and has no financial fields
9. `needsAttention` is pending-discharge only
10. Response JSON has no deposit/payment/balance/credit keys
11. Unit empty-hospital case returns zeros and `[]`

---

## 10. Known limitations

- “My” work is name-string equality. Two staff accounts with the same `User.name` share a queue. Seed/demo data that stored `submittedBy: 'Nurse Almaz Tsegaye'` only matches a user whose name is exactly that string.
- There is no nurse-to-patient or ward assignment. `currentInpatients` is hospital-wide (newest 8 non-discharged stays).
- Room/bed are denormalized strings on `Patient`, not a live join to `Bed`.
- Maternity baby rows are not listed separately; `admissionType` is included on current inpatients.
- The Nurse UI still loads `GET /api/patients?view=full` (including deposits) until a later frontend step.
- No new Mongo indexes.

---

## 11. Out of scope (this step)

Nurse/Admin/Reception/Manager dashboard UI, `DashboardChrome.jsx`, `mockData.js`, schema changes (`submittedByUserId`), vitals/MAR/handover, “no daily record today”, hospital-wide pending record queue, indexes.

---

## 12. Future considerations (not implemented)

- Persist `submittedByUserId` and query by id.
- Optional ward/team scope after the hospital defines assignment.
- Wire `api.getNurseDashboard()` + `useNurseDashboard` (Admin hook pattern: loading/error/retry, no mock fallback).
- Split clinical list APIs so nurses do not download ledgers.
