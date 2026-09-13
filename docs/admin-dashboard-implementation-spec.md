# Admin Dashboard Implementation Specification

Status: **backend implemented and Admin UI wired**. `AdminDashboard.jsx` loads `GET /api/admin/dashboard` via `useAdminDashboard`. It does not fall back to `mockData.js`.

---

## 1. Endpoint

| | |
|-|-|
| **Method / path** | `GET /api/admin/dashboard` |
| **Route file** | `server/routes/admin.routes.js` |
| **Mount** | `app.use('/api/admin', adminRoutes)` in `server/server.js` |
| **Service** | `server/services/adminDashboard.js` — `buildAdminDashboard(req.auth)` |
| **Tests** | `server/services/adminDashboard.test.js` (unit), `server/services/adminDashboard.http.test.js` (HTTP + Mongo) |
| **Frontend** | `frontend/src/api/client.js` — `api.getAdminDashboard()`; `frontend/src/hooks/useAdminDashboard.js`; `frontend/src/pages/admin/AdminDashboard.jsx` |

This is a separate payload from `GET /api/manager/dashboard`. The manager route was not changed.

Errors: `{ error: string }` (`Unauthorized`, `Invalid or expired token`, `Forbidden`, `Failed to load dashboard`).

---

## 2. Authentication and RBAC

- `authRequired` then `requireAnyPermission(...ADMIN_DASHBOARD_PERMISSIONS)`.
- Super Admin (`role.slug === 'super-admin'` and `role.active !== false`) still receives every catalog key via `roleHasPermission`.
- No `requireRole('Admin')`. A custom role with any listed view key can call the endpoint and receives only the sections it is allowed to see.

Gate keys (exact strings):

`patients.view`, `beds.view`, `rooms.view`, `departments.view`, `wards.view`, `doctors.view`, `users.view`, `system.view_settings`, `payments.view`, `credit.view`

There is no `admin.dashboard` permission.

### Section omission

If the caller lacks a section’s permission, that key is **absent**. Hidden finance is never returned as `0`.

| Section | Include when |
| --- | --- |
| `census` | `patients.view` |
| `recentAdmissions` | `patients.view` |
| `beds` | `beds.view` **or** `rooms.view` |
| `setup.departments` | `departments.view` |
| `setup.wards` | `wards.view` |
| `setup.rooms` | `rooms.view` |
| `setup.beds` | `beds.view` or `rooms.view` |
| `setup.doctors` | `doctors.view` |
| `setup.users` | `users.view` |
| `catalog` | `system.view_settings` |
| `finance` | `payments.view` (`todayDeposits` only) |
| `credit` | `credit.view` (`creditAdmissions` only) |

If `setup` would be `{}`, it is omitted. `finance` and `credit` are separate objects so a payments-only or credit-only caller never sees the other domain.

`isCreditPatient` on recent-admission rows is included only when `credit.view` is granted.

---

## 3. Date and time

| Field | Type | Rule |
| --- | --- | --- |
| `Patient.admissionDate` | string `YYYY-MM-DD` | compared to `todayStr()` from `server/utils/dates.js` |
| `Deposit.date` | string `YYYY-MM-DD` | same |
| `Patient.dischargeCompletedAt` | BSON Date | `{ $gte: start, $lt: end }` from `localDayRange(todayStr())` |

`localDayRange` lives in `server/utils/dates.js`. It uses the process local calendar (not `toISOString().slice(0, 10)`).

`generatedAt` is `new Date().toISOString()` (response timestamp only).

---

## 4. Response shape

```json
{
  "generatedAt": "2026-09-12T20:34:00.000Z",
  "census": {
    "currentlyAdmitted": 0,
    "admittedToday": 0,
    "pendingDischarge": 0,
    "dischargedToday": 0
  },
  "beds": {
    "total": 0,
    "occupied": 0,
    "available": 0,
    "maintenance": 0,
    "outOfService": 0,
    "unavailable": 0,
    "occupancyPercentage": 0
  },
  "setup": {
    "departments": 0,
    "wards": 0,
    "rooms": 0,
    "beds": 0,
    "doctors": 0,
    "users": 0
  },
  "catalog": {
    "serviceCategories": 0,
    "priceLines": 0
  },
  "recentAdmissions": [],
  "finance": {
    "todayDeposits": 0
  },
  "credit": {
    "creditAdmissions": 0
  }
}
```

Unauthorized keys are omitted. Empty hospital data is real zeros / `[]`, not mock numbers.

Field names follow this implementation step (`occupancyPercentage`, `todayDeposits`, `serviceCategories`, `priceLines`) rather than the earlier draft aliases (`occupancyRate`, `depositsToday`, `categories`, `pricedItems`). Meaning is unchanged.

`recentDeposits` was optional in the draft and is **not** shipped.

---

## 5. Queries (implemented)

Compute with `countDocuments`, one Bed `$group`, one catalog `$group`, one Deposit `$sum`, and `Patient.find().sort().limit(8)`. Collections are not loaded in full.

### Census — `Patient`

| Field | Filter |
| --- | --- |
| `currentlyAdmitted` | `{ status: 'admitted' }` |
| `pendingDischarge` | `{ status: 'pending-discharge' }` |
| `admittedToday` | `{ admissionDate: todayStr() }` (any status) |
| `dischargedToday` | `{ status: 'discharged', dischargeCompletedAt: { $gte, $lt } }` |

`pendingDischarge` boolean on the document is not used.

### Beds — `Bed.status`

`available` | `occupied` | `maintenance` | `out_of_service`

Aggregation: `{ $group: { _id: '$status', count: { $sum: 1 } } }`.

`occupancyPercentage = total === 0 ? 0 : Math.round(occupied / total * 100)` where `total` is **all** bed documents (maintenance and out-of-service stay in the denominator). `unavailable = maintenance + outOfService`.

### Setup

`countDocuments({})` on Department, Ward, Room, Bed, Doctor, User — **all** documents, including inactive (`active: false` / `User.status: 'inactive'`). Bed has no active flag.

### Catalog — `ServiceCategory`

`serviceCategories` = category documents. `priceLines` = `$sum` of `$size` of `services` (`{ name, price }` only). No `activeServices`.

### Recent admissions

```
Patient.find({})
  .sort({ admissionDate: -1, createdAt: -1 })
  .limit(8)
  .select('patientId name status admissionDate admissionType room bed isCreditPatient dischargeCompletedAt')
```

Room/bed labels are the strings stored on the stay (`Patient.room`, `Patient.bed`). Discharged stays are included.

Safe item: `patientId`, `name`, `status`, `admissionDate`, `admissionType`, `room`, `bed`, optional `dischargeCompletedAt` (ISO), optional `isCreditPatient`. No phone, MRN, address, or balance.

### Finance / credit

- `finance.todayDeposits`: `Deposit` `{ date: todayStr() }` then `$sum: '$amount'`. Operational date is `Deposit.date`, not `createdAt`.
- `credit.creditAdmissions`: `{ status: { $ne: 'discharged' }, isCreditPatient: true }` (stored flag).

---

## 6. Error handling

| Case | HTTP | Body |
| --- | --- | --- |
| No token | 401 | `{ error: 'Unauthorized' }` |
| Invalid token | 401 | `{ error: 'Invalid or expired token' }` |
| Inactive user | 401 | `{ error: 'Unauthorized' }` |
| None of the gate permissions | 403 | `{ error: 'Forbidden' }` |
| Query failure | 500 | `{ error: 'Failed to load dashboard' }` |
| Empty hospital | 200 | zeros / `[]` |

Internal Mongo errors are logged server-side only.

---

## 7. Indexes

Not added (project convention: only add when measured slow).

| Collection | Existing indexes | Still useful later |
| --- | --- | --- |
| Patient | unique `patientId`; sparse unique `mrn`, `nationalId` | `{ status: 1 }`, `{ admissionDate: -1 }`, `{ status: 1, isCreditPatient: 1 }`, `{ dischargeCompletedAt: 1 }` |
| Bed | unique `label`; sparse unique `{ roomId, nameKey }` | `{ status: 1 }` |
| Deposit | `patientId`; sparse unique `referenceNumber` | `{ date: -1 }` |

---

## 8. Tests performed

Unit (`adminDashboard.test.js`): occupancy denominator and rounding; local day range; recent-admission field stripping; section omission for `patients.view`, beds/rooms, payments-only, credit-only; Super Admin slug bypass; payload is not the manager shape.

HTTP (`adminDashboard.http.test.js`, requires `MONGODB_URI` + `JWT_SECRET`):

1. Super Admin (slug bypass, empty `permissions` array)
2. Custom role with all dashboard permissions
3. `patients.view` only
4. `patients.view` + `beds.view`
5. No authentication / invalid token
6. Authenticated user with only `reports.view` → 403
7. `payments.view` without `credit.view`
8. `credit.view` without `payments.view`

Frontend (`useAdminDashboard`): calls `GET /api/admin/dashboard` only. Loading shows “Loading dashboard...”. Failure shows the API error and Retry. `USE_API=false` shows an error (no mock numbers). Unauthorized sections are hidden when the corresponding response key is missing.

Live API checks after UI wiring (seeded + temporary roles, then deleted): Super Admin/admin@cc all sections; custom all-perms all sections; `patients.view` → census + recent only; `patients.view` + `beds.view` → + beds/setup.beds; payments-only → finance only; credit-only → credit only; `reports.view` → 403; no token → 401. Nurse seed payload has no finance/credit. Mock lists (medicines, department staff) are no longer rendered on this page.

---

## 9. Remaining limitations

- Admin UI layout is still the pre-redesign card grid (data is live).
- `recentDeposits` not implemented.
- Setup counts include inactive records (copy should say “configured”).
- Occupancy uses all beds as the denominator (as agreed).
- No new Mongo indexes.
- Older discharged stays without `dischargeCompletedAt` do not count as discharged today.
- `Patient` is a stay, not a lifelong identity.

---

## 10. Out of scope (unchanged)

Medicine stock, department staff/service counts, revenue charts, unique lifelong patient counts, mock statistics, visual redesign, `mockData.js` (still used by other pages), Manager/Reception/Nurse dashboards.
