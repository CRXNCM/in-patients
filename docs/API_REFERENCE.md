# API Reference

Related documents: [AUTHENTICATION.md](./AUTHENTICATION.md) · [DATABASE.md](./DATABASE.md) · [BUSINESS_RULES.md](./BUSINESS_RULES.md)

**Base URL:** `VITE_API_URL` or `http://localhost:5000`  
**Format:** JSON  
**Error shape:** `{ "error": "<message>" }`  
**Auth header:** `Authorization: Bearer <jwt>`

Unless noted, endpoints require a valid JWT. Role restrictions are listed per route. Many write endpoints only check that a user is logged in — not that they are Reception. See [SECURITY.md](./SECURITY.md).

There is no OpenAPI spec in the repository.

---

## Health

### `GET /api/health`

| | |
|-|-|
| **Auth** | None |
| **Description** | Liveness check |

**Response `200`:**

```json
{ "ok": true, "service": "medbill-api", "time": "2026-09-10T01:00:00.000Z" }
```

---

## Auth

### `POST /api/auth/login`

| | |
|-|-|
| **Auth** | None |
| **Description** | Verify credentials and issue JWT |

**Request body:**

| Field | Required | Validation |
|-------|----------|------------|
| email | yes | non-empty; looked up lowercased/trimmed |
| password | yes | bcrypt compare |

**Success `200`:**

```json
{
  "token": "<jwt>",
  "user": {
    "id": "<ObjectId>",
    "name": "Sara Bekele",
    "email": "reception@cc",
    "role": "Reception",
    "roleKey": "reception",
    "dashboardPath": "/reception",
    "initials": "SB"
  }
}
```

**Errors:**

| Status | When |
|--------|------|
| 400 | Missing email or password |
| 401 | Unknown user, inactive user, or wrong password (`Invalid email or password`) |
| 500 | `Login failed` |

JWT payload: `{ id, email, role, roleKey, name }`, expiry `7d`. Secret: `JWT_SECRET`.

---

### `GET /api/auth/me`

| | |
|-|-|
| **Auth** | Required |
| **Description** | Current user without password |

**Success `200`:** same user object as login (no token).  
**Errors:** `401` missing/invalid token; `404` user deleted after token issued.

---

## Patients

### `GET /api/patients`

| | |
|-|-|
| **Auth** | Required (any role) |
| **Description** | Non-discharged patients with computed charges |

**Query:** omit `view` for a flat array.

**Success `200`:** array of mapped patients:

```json
{
  "id": "PAT-001",
  "name": "Abebe Kebede",
  "age": 45,
  "gender": "Male",
  "phone": "+251 911 234 567",
  "room": "General Ward",
  "bed": "GW-12",
  "admissionDate": "2026-07-10",
  "deposit": 85000,
  "totalCharges": 0,
  "status": "admitted",
  "pendingDischarge": false,
  "disabledDoctorVisits": { "2026-07-11": true }
}
```

`mrn`, `address`, `admissionReason`, and similar fields are **not** included in this mapper.

**Errors:** `401`, `500` `Failed to load patients`.

---

### `GET /api/patients?view=full`

| | |
|-|-|
| **Auth** | Required |
| **Description** | Bootstrap payload for PatientsContext |

**Success `200`:**

```json
{
  "patients": [ { "id": "PAT-001", "roomHistory": [ { "room": "General Ward", "bed": "GW-12", "fromDate": "2026-07-10", "toDate": null } ] } ],
  "deposits": { "PAT-001": [ { "id": "...", "date": "2026-07-10", "amount": 85000, "method": "Cash", "referenceNumber": "", "receivedBy": "Sara Bekele", "isInitial": true, "createdAt": "..." } ] },
  "assignments": [ { "id": "...", "admission_id": "PAT-001", "room_id": "ROOM-GW", "bed_id": "BED-GW-12", "start_date": "2026-07-10", "end_date": null, "daily_rate": 1500, "transfer_reason": "Initial admission", "assigned_by": "Sara Bekele" } ],
  "rooms": [ { "id": "ROOM-GW", "roomType": "General Ward", "dailyRate": 1500, "beds": [ { "id": "BED-GW-01", "label": "GW-01", "status": "available", "patientId": null } ] } ]
}
```

---

### `GET /api/patients/:id`

`:id` is **`patientId`** (`PAT-001`), not Mongo `_id`.

| | |
|-|-|
| **Auth** | Required |
| **Description** | One patient plus deposits, assignments, records, balance |

Generates missing automatic room/doctor charges when the patient is not discharged.

**Success `200`:**

```json
{
  "patient": { },
  "deposits": [],
  "assignments": [],
  "records": [],
  "balance": { "totalCharges": 0, "depositTotal": 85000, "balance": 85000 }
}
```

**Errors:** `404` `Patient not found`; `500` `Failed to load patient`.

---

### `POST /api/patients`

| | |
|-|-|
| **Auth** | Reception or Admin |
| **Description** | Admit patient, occupy bed, deposit or credit, optional doctors, first auto charges |

**Request body (validated by `validateAdmitBody`):**

| Field | Required | Validation |
|-------|----------|------------|
| name | yes | non-empty trim |
| gender | yes | non-empty |
| age or dateOfBirth | one required | age 0–120 if provided |
| address | yes | non-empty |
| bedId | yes | bed label, with or without `BED-` prefix |
| depositAmount | yes | paid: ≥ `15000`; credit: ≥ 0 |
| admissionPaymentMode | no | `paid` (default) or `credit` |
| doctorIds | no | array of Doctor ids; inactive/missing ids rejected |
| admissionDate | no | if omitted, set to today; if provided, valid `YYYY-MM-DD` and not after today |
| phone, dateOfBirth, mrn, nationalId | no | |
| depositMethod | no | default Cash; required on credit only if amount &gt; 0 |
| referenceNumber | no | stored on initial deposit |

Additional checks: selected bed must be `available`; if `mrn` / `nationalId` provided, no other non-discharged patient may have the same value.

**Success `201`:** `{ patient, rooms }`.  
**Errors:** `400` first validation message or bed/MRN/National ID errors; `500` `Failed to admit patient`.

---

### `POST /api/patients/:id/deposits`

| | |
|-|-|
| **Auth** | Reception or Admin |
| **Description** | Additional deposit; increments `depositTotal`; recomputes credit flag |

**Body:**

| Field | Required | Validation |
|-------|----------|------------|
| amount | yes | > 0 |
| method | yes | non-empty; non-cash (`Bank Transfer`, `Ebirr`, `Other`) requires referenceNumber |
| referenceNumber | conditional | unique among existing refs |
| date | no | defaults to the hospital local calendar day (`todayStr()`), which is what dashboards match on |

**Success `201`:** `{ deposit, patient }`.  
**Errors:** `404` patient; `400` validation; `500` `Failed to add deposit`.

---

### `GET /api/doctors`

| | |
|-|-|
| **Auth** | Required |
| **Query** | `active=true` or `active=false` optional |

**Success `200`:** array of `{ id, name, specialty, visitPrice, active, phone, department, auditTrail, ... }`.

### `POST /api/doctors` / `PATCH /api/doctors/:id`

| | |
|-|-|
| **Auth** | Admin |
| **Body** | `name`, `specialty`, `visitPrice` (≥ 0), optional `active`, `phone`, `department` |

Deactivate does not rewrite historical assignments or billed visit lines.

### `GET /api/patients/:id/doctors`

Assigned doctors (active and ended) with snapshots.

### `POST /api/patients/:id/doctors`

| | |
|-|-|
| **Auth** | Nurse, Reception, or Admin |
| **Body** | `doctorId` required; `effectiveFrom` optional (`YYYY-MM-DD`, ≥ admission, ≤ today) |

Idempotent if that doctor is already active on the stay. **Success `201`:** `{ assignment, assignedDoctors, patient }`.

### `PATCH /api/patients/:id/doctors/:assignmentId/end`

Ends the assignment as of today. Historical visit lines remain.

### `POST /api/charges/daily`

| | |
|-|-|
| **Auth** | Admin or Reception |
| **Body** | optional `throughDate` |

Runs `ensureAutomaticDailyCharges` for every non-discharged patient.

---

### `POST /api/patients/:id/transfer-room`

| | |
|-|-|
| **Auth** | Required |
| **Body** | `bedId`, `transferDate`, `transferReason` |

**Validation:** patient exists and is not `discharged` or `pending-discharge`; bed + reason + date required; date ≥ admission and ≤ today; target bed available; not the same room+bed; an open assignment must exist.

**Success `200`:** `{ roomType, bedLabel, dailyRate, patient, assignments, rooms }`.  
**Errors:** `400` / `404` / `500` `Failed to transfer room`.

---

### `PATCH /api/patients/:id/doctor-visits/:date`

| | |
|-|-|
| **Auth** | Required |
| **Body** | `{ "disabled": true \| false }` |
| **Description** | Add/remove date from `disabledDoctorVisitDates`; delete or recreate doctor auto-record |

**Success `200`:** mapped patient.  
**Errors:** `404` / `400` if discharged / `500` `Failed to update doctor visit`.

---

### `GET /api/patients/pending-discharge`

| | |
|-|-|
| **Auth** | Required |
| **Description** | Patients with `status: pending-discharge` and computed balances |

**Success `200`:** array of mapped patients including `discharge` metadata.

---

### `GET /api/patients/discharged`

| | |
|-|-|
| **Auth** | Required |
| **Description** | Completed stays (excluded from the default patient list) |

**Success `200`:** array of mapped patients including `discharge` snapshot fields.

---

### `POST /api/patients/:id/discharge-request`

| | |
|-|-|
| **Auth** | JWT role `Nurse` |
| **Body** | `{ "notes": "optional" }` |
| **Description** | `admitted` → `pending-discharge`. Bed and assignment stay open. |

**Errors:** `403` wrong role; `400` invalid status; `409` concurrent second request; `404`.

---

### `POST /api/patients/:id/discharge/approve`

| | |
|-|-|
| **Auth** | JWT role `Reception` or `Admin` |
| **Description** | Final discharge: generate auto charges through today, close assignment, free bed, set `discharged`, store financial snapshot |

**Success `200`:** `{ patient, assignments, rooms, balance }`.  
**Errors:** `403`; `400` not pending or missing assignment/bed; `409` concurrent approve.

---

### `POST /api/patients/:id/discharge/reject`

| | |
|-|-|
| **Auth** | JWT role `Reception` or `Admin` |
| **Body** | `{ "reason": "required" }` |
| **Description** | `pending-discharge` → `admitted`. Occupancy unchanged. |

**Errors:** `403`; `400` missing reason or wrong status; `409` already reviewed.

---

### `GET /api/patients/:id/records`

| | |
|-|-|
| **Auth** | Required |
| **Description** | All service records for the patient, newest date first |

**Success `200`:** array of mapped records (see Records section).  
**Errors:** `404` / `500`.

---

### `POST /api/patients/:id/records`

| | |
|-|-|
| **Auth** | Required |
| **Description** | Submit a daily service record |

**Body:**

| Field | Required | Notes |
|-------|----------|-------|
| services | yes | non-empty array |
| source | no | default `nurse`; `reception` → status `approved` |
| recordDate | no | default today |
| recordName | no | default patient name |

Each service line: `id?`, `category`, `serviceName`, `quantity`, `unitPrice`, `total?`, `notes?`. Total defaults to `quantity * unitPrice`.

**Does not** update an existing pending record. Always inserts.

**Success `201`:** mapped record.  
**Errors:** `400` `Services required`; `404`; `500`.

---

### `POST /api/patients/:id/returns`

Same auth and source/auto-approve behavior as daily records.

**Body:** `returnItems` (required non-empty), `source?`, `recordDate?`.  
Each item: `serviceName`, `quantity`, `unitPrice`, `total?`, `reason?`.

**Success `201`.** **Errors:** `400` `Return items required`; `404`; `500`.

---

## Beds

### `GET /api/beds/rooms`

| | |
|-|-|
| **Auth** | Required |
| **Description** | Beds grouped by room type |

**Success `200`:** `buildRoomsFromBeds` array.

---

### `GET /api/beds/available`

| | |
|-|-|
| **Auth** | Required |
| **Query** | `roomType` optional |

**Success `200`:**

```json
[{ "id": "<ObjectId>", "label": "GW-01", "roomType": "General Ward", "dailyRate": 1500, "status": "available" }]
```

---

## Settings

One `HospitalSettings` document (`key: 'default'`) backs all six Admin Settings sections. Unset fields are
resolved to the behaviour the application already had, so a document written before a field existed keeps
working unchanged (`server/utils/settings.js`).

### `GET /api/settings`

| | |
|-|-|
| **Auth** | Required + any of `system.view_settings`, `patients.view`, `admissions.view` |
| **Description** | Stored values merged with resolved defaults. Returns `{}` when no document exists. |

**Success `200`** — grouped by settings section:

| Section | Fields |
|---------|--------|
| Hospital Information | `name`, `address`, `tin`, `phone`, `email` |
| Billing & Payment | `currency`, `vatPercent`, `paymentMethods[]`, `defaultPaymentMethod`, `referenceRequiredMethods[]`, `dailyDoctorVisitFee`, `dailyDoctorVisitName` |
| Receipt & Invoice | `receiptHeader`, `receiptFooter`, `receiptPrefix`, `receiptShowLogo`, `receiptShowAddress`, `receiptShowPhone`, `receiptShowTin`, `invoiceHeader`, `invoiceFooter`, `invoiceShowLogo`, `invoiceShowAddress`, `invoiceShowPhone`, `invoiceShowTin` |
| Financial Rules | `lowBalanceThreshold`, `minimumInitialDeposit`, `creditAdmissionsEnabled`, `allowDischargeWithOutstandingBalance` |
| System / General | `timezone`, `dateFormat`, `timeFormat`, `listPageSize` |

Defaults when unset: `paymentMethods` = `['Cash','Bank Transfer','Ebirr','Other']`, `defaultPaymentMethod` = `Cash`,
`referenceRequiredMethods` = the three non-cash methods, `receiptPrefix` = `DEP-`, `minimumInitialDeposit` = `15000`,
`creditAdmissionsEnabled` = `true`, `allowDischargeWithOutstandingBalance` = `true`, `dateFormat`/`timeFormat` = `locale`,
`listPageSize` = `10`, show-logo/address/TIN = `true`, show-phone = `false`.

---

### `PUT /api/settings`

| | |
|-|-|
| **Auth** | Required + `system.modify_settings` |
| **Body** | Partial patch. Only the keys listed above are accepted; anything else is dropped before `$set`. |

Validation (`400` with `{ error, errors[] }` on the first failure): hospital name non-empty, valid email,
currency non-empty, `vatPercent` 0–100, monetary fields ≥ 0, payment methods from the known set, at least one
enabled method, default method within the enabled list, `dateFormat` ∈ `locale|iso|dmy`, `timeFormat` ∈
`locale|12h|24h`, `timezone` a valid IANA name, `listPageSize` a whole number 5–100. A body with no known key
returns `400`. Omitted fields are left untouched.

**Success `200`:** mapped settings.  
**Errors:** `400` validation, `401`, `403` `Forbidden`, `500`.

**Where these settings take effect**

| Setting | Enforced by |
|---------|-------------|
| `minimumInitialDeposit` | `POST /api/patients` rejects a paid admission below it and stores it as the stay's `requiredInitialDeposit` |
| `creditAdmissionsEnabled` | `POST /api/patients` rejects `admissionPaymentMode: 'credit'` when false |
| `paymentMethods` | Admission deposits and `POST /api/patients/:id/deposits` reject a disabled method |
| `referenceRequiredMethods` | Those methods require a unique `referenceNumber` on deposits |
| `allowDischargeWithOutstandingBalance` | `POST /api/patients/:id/discharge/approve` returns `400` while approved charges exceed deposits |
| `lowBalanceThreshold` | Existing low-balance logic; Manager keeps its wider 2× attention band on top |
| `vatPercent`, receipt/invoice fields | Rendered invoice and deposit receipt |
| `timezone`, `dateFormat`, `timeFormat`, `listPageSize` | Frontend timestamp rendering and default list page size. Calendar-day records stay server-local (`todayStr()`). |

---

### `GET /api/settings/categories`

| | |
|-|-|
| **Auth** | Required |
| **Success `200`** | `[{ id: slug, name, description, billingType, services: [{ name, price }] }]` |

---

### `PATCH /api/settings/categories/:slug/billing-type`

| | |
|-|-|
| **Auth** | Required + role **Admin** |
| **Body** | `{ "billingType": "quantity" \| "selection" \| "automatic_daily" }` |

**Success `200`:** mapped category.  
**Errors:** `404` `Category not found`; `403`; `500`.

---

## Records

Mapped record shape:

```json
{
  "id": "<ObjectId>",
  "recordName": "Abebe Kebede",
  "patientId": "PAT-001",
  "recordDate": "2026-07-18",
  "type": "daily_services",
  "status": "pending",
  "source": "nurse",
  "services": [{ "id": "svc-1", "category": "Pharmacy", "serviceName": "Paracetamol 500mg", "quantity": 2, "unitPrice": 15, "total": 30, "notes": "" }],
  "returnItems": [],
  "autoGenerated": false,
  "autoType": null,
  "recordedAt": "...",
  "recordedBy": "Nurse Almaz Tsegaye",
  "reviewedAt": null,
  "reviewedBy": null,
  "rejectionReason": null,
  "auditTrail": [{ "action": "recorded", "by": "...", "at": "...", "note": "..." }]
}
```

`type` is `pharmacy_return` when `recordType === 'return'`, otherwise `daily_services`.

---

### `GET /api/records/pending`

| | |
|-|-|
| **Auth** | Required |
| **Description** | All pending records, newest first |

---

### `GET /api/records`

| | |
|-|-|
| **Auth** | Required |
| **Query** | `patientId`, `status` optional filters |

---

### `POST /api/records/:id/approve`

`:id` is Mongo `_id`.

| | |
|-|-|
| **Auth** | Required (any role) |
| **Body** | `{ "note": "optional" }` default `Approved by reception` |

**Errors:** `404` `Record not found`; `400` `Record is not pending`; `500`.

---

### `POST /api/records/:id/reject`

| | |
|-|-|
| **Auth** | Required |
| **Body** | `{ "reason": "optional" }` default `Rejected by reception` |

Frontend requires a reason; API does not. Sets `rejectionReason` and audit action `rejected`.

**Errors:** same as approve (`Record is not pending` if not pending).

---

## Admin

### `GET /api/admin/dashboard`

| | |
|-|-|
| **Auth** | Required (`authRequired`) |
| **Permission** | Any of `patients.view`, `beds.view`, `rooms.view`, `departments.view`, `wards.view`, `doctors.view`, `users.view`, `system.view_settings`, `payments.view`, `credit.view` (`requireAnyPermission`). Super Admin is included via `role.slug === 'super-admin'`. |
| **Notes** | Operational census and setup counts. Unauthorized sections are **omitted**, not zero-filled. Not the manager revenue payload. Admin SPA: `api.getAdminDashboard()` / `useAdminDashboard` — no mock fallback. |

**Success `200`** (keys present only when permitted):

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
  "recentAdmissions": [
    {
      "patientId": "PAT-006",
      "name": "Hana Bekele",
      "status": "admitted",
      "admissionDate": "2026-09-12",
      "admissionType": "normal",
      "room": "General Ward",
      "bed": "GW-01"
    }
  ],
  "finance": { "todayDeposits": 0 },
  "credit": { "creditAdmissions": 0 }
}
```

**Errors:** `401` `{ error: 'Unauthorized' }` or `{ error: 'Invalid or expired token' }`; `403` `{ error: 'Forbidden' }`; `500` `{ error: 'Failed to load dashboard' }`.

Details: [admin-dashboard-implementation-spec.md](./admin-dashboard-implementation-spec.md).

---

## Reception

### `GET /api/reception/dashboard`

| | |
|-|-|
| **Auth** | Required |
| **Permission** | `patients.view`. Super Admin bypass applies. |
| **Notes** | Front-desk counts and the current inpatient list. Today’s deposits come from `Deposit` on the local calendar day (`todayStr()`). Not Manager reports. |

Today’s deposits require `payments.view`. Balance columns and the low-balance count require `payments.view` or `credit.view`. Low balance uses the existing rule: remaining (`deposit − approved charges`) below **2 ×** `lowBalanceThreshold`. `canReview` is true when the caller has `admissions.edit` or `patients.edit`.

**Success `200`:** `{ generatedAt, census, workQueue, pendingRecords, currentInpatients, canReview, finance?, watchlist? }`

**Errors:** `401`; `403`; `500` `{ error: 'Failed to load dashboard' }`.

---

## Nurse

### `GET /api/nurse/dashboard`

| | |
|-|-|
| **Auth** | Required (`authRequired`) |
| **Permission** | `patients.view` (`requirePermission`). Super Admin is included via `role.slug === 'super-admin'`. |
| **Notes** | Operational census and the caller’s own records. Not the Admin or Manager dashboard payload. No deposits, balances, credit, or catalog. Nurse SPA is not wired yet. |

**Success `200`:**

```json
{
  "generatedAt": "2026-09-12T21:00:00.000Z",
  "census": { "admitted": 0, "pendingDischarge": 0 },
  "workQueue": { "myPendingRecords": 0, "pendingDischarge": 0 },
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
      "assignedDoctors": []
    }
  ]
}
```

`census.admitted` is `Patient.status === 'admitted'` only. `myPendingRecords` and `recentSubmissions` match `ServiceRecord.submittedBy` to `req.user.name`. `needsAttention` is pending-discharge stays (max 6). `currentInpatients` is admitted or pending-discharge (max 8, newest admission first).

**Errors:** `401` `{ error: 'Unauthorized' }` or `{ error: 'Invalid or expired token' }`; `403` `{ error: 'Forbidden' }`; `500` `{ error: 'Failed to load dashboard' }`.

Details: [nurse-dashboard-implementation-spec.md](./nurse-dashboard-implementation-spec.md).

---

## Search

### `GET /api/search`

| | |
|-|-|
| **Auth** | Required (`authRequired`) |
| **Query** | `q` — trimmed, 2–80 characters |
| **Permission** | Per resource. Super Admin (`role.slug === 'super-admin'`) receives every catalog key. |

The handler never queries a collection the caller cannot see. Frontend hiding is UX only.

| Group | Include when | Matched fields | Max rows |
| --- | --- | --- | --- |
| `patients` | `patients.view` or `admissions.view` | name, patientId, mrn, phone | 5 |
| `doctors` | `doctors.view` | name, specialty | 5 |
| `rooms` / `beds` | `rooms.view` or `beds.view` | room name/type; bed label/name | 5 each |
| `departments` | `departments.view` | name | 5 |
| `wards` | `wards.view` | name | 5 |
| `users` | `users.view` | name, username, email | 5 |

There is no separate Admission collection; a stay is a `Patient`. Payments, deposits, credit, and catalog prices are not searched.

`route` is an existing SPA path for the caller’s `accessRole`, or `null` (e.g. Admin has no patient stay page). Passwords, tokens, visit prices, deposits, and daily rates are never returned.

**Success `200`:**

```json
{
  "query": "abebe",
  "results": [
    {
      "type": "patient",
      "id": "PAT-001",
      "title": "Abebe Kebede",
      "subtitle": "PAT-001",
      "meta": "admitted · General Ward / GW-01",
      "route": "/nurse/patient/PAT-001"
    }
  ],
  "groups": {
    "patients": { "items": [], "hasMore": false }
  }
}
```

Unauthorized group keys are omitted.

**Errors:** `401`; `400` `{ error: 'Search query is required' | 'Search query is too short' | 'Search query is too long' }`; `500` `{ error: 'Failed to search' }`.

---

## Manager

Both routes: **Auth required + `reports.view`.** Super Admin (`role.slug === 'super-admin'`) bypasses the permission check via the existing RBAC helper. Access is **not** a Manager/Admin role-name check.

### `GET /api/manager/dashboard`

Built by `server/services/managerDashboard.js`. Dates use `todayStr()` / `localDayRange()` (hospital local calendar), not UTC `toISOString()` slices.

**Section permissions** (omit the key rather than sending zeros):

| Section | Permission |
|---------|------------|
| `census`, `recentAdmissions` | `patients.view` or `admissions.view` |
| `finance.deposits`, `finance.approvedCharges`, category/trend/top lists | `payments.view` |
| `finance.outstandingBalance`, `finance.creditAdmissions`, `watchlist` | `credit.view` |
| `occupancy`, `hospitalName`, `generatedAt` | included for any caller who passed `reports.view` |

**Finance definitions (not “revenue”):**

- `finance.deposits` — sum of `Deposit.amount` for today / current local month
- `finance.approvedCharges` — approved `ServiceRecord` totals (returns reduce the total)
- `finance.outstandingBalance` — sum of `max(0, approved charges − depositTotal)` for current inpatients (`admitted` + `pending-discharge`)
- `chargesByCategory` — approved service **line categories**, not `Department` documents
- `dailyChargesTrend` — last 7 **local** calendar days of approved charges only
- `watchlist` — current stays where `depositTotal − charges < 2 × HospitalSettings.lowBalanceThreshold` (existing product rule; labeled Balance Attention). Rows include `remaining` (`depositTotal − approved charges`).
- `creditAdmissions` — current stays with `isCreditPatient` (same count as Admin; not a new credit rule)

**Success `200`:**

```json
{
  "generatedAt": "2026-09-13T00:00:00.000Z",
  "hospitalName": "Central City Hospital",
  "census": {
    "admitted": 2,
    "pendingDischarge": 1,
    "admittedToday": 1,
    "dischargedToday": 0
  },
  "occupancy": {
    "occupied": 3,
    "available": 5,
    "maintenance": 1,
    "outOfService": 1,
    "total": 10,
    "percentage": 30
  },
  "finance": {
    "deposits": { "today": 0, "month": 0 },
    "approvedCharges": { "today": 0, "month": 0 },
    "outstandingBalance": 0,
    "creditAdmissions": 0
  },
  "chargesByCategory": [{ "name": "Pharmacy", "amount": 0 }],
  "dailyChargesTrend": [{ "date": "2026-09-12", "day": "Sat", "amount": 0 }],
  "topServices": [{ "name": "...", "count": 1, "amount": 0 }],
  "topMedicines": [{ "name": "...", "count": 1, "amount": 0 }],
  "watchlist": { "lowBalanceCount": 0, "lowBalancePatients": [] },
  "recentAdmissions": [{ "id": "PAT-001", "patientName": "...", "admissionDate": "...", "room": "...", "bed": "...", "status": "admitted" }]
}
```

Occupancy uses all beds as the denominator (same as Admin). Watchlist rows omit deposit and charge amounts.

**Errors:** `401`; `403` `{ error: 'Forbidden' }`; `500` `{ error: 'Failed to load dashboard' }`.

---

### `GET /api/manager/reports/:type`

Same gate as the dashboard (`reports.view` + Super Admin bypass). Report summaries still use the pre-existing blended `revenue` field (`deposits + approved charges`) via `buildManagerReportSnapshot` so export contracts stay compatible. That blend is **not** returned on `GET /api/manager/dashboard`.

| type | Title / rows |
|------|----------------|
| `daily` | Today’s revenue/deposits; `recentPatients` |
| `weekly` | Sum of last-7-days trend; trend rows |
| `monthly` | Monthly revenue; department rows |
| `annual` | Year title; **monthly** revenue; department rows |
| `department` | Department revenue rows |
| `deposit` | Last 50 deposits |
| `outstanding` | `recentPatients` with `balance < 0` |
| `billing` | `recentPatients` |
| `occupancy` | All beds + occupancyRate |

**Success `200`:** `{ title, summary, rows, generatedAt, hospitalName }`.  
**Errors:** `400` `Unknown report type`; `403`; `500`.

---

## Common client errors

`src/api/client.js` throws `Error` with `data.error` (or status text) when `!res.ok`. Network failures surface as native `fetch` exceptions.
