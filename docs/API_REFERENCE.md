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

Does **not** generate missing automatic charges.

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
| **Auth** | Required (any role — not limited to Reception) |
| **Description** | Admit patient, occupy bed, optional deposit, first auto charges |

**Request body (validated by `validateAdmitBody`):**

| Field | Required | Validation |
|-------|----------|------------|
| name | yes | non-empty trim |
| gender | yes | non-empty |
| age or dateOfBirth | one required | age 0–120 if provided |
| address | yes | non-empty |
| bedId | yes | bed label, with or without `BED-` prefix |
| depositAmount | yes | number ≥ `15000` |
| admissionDate | no | if omitted, set to today; if provided, valid `YYYY-MM-DD` and not after today |
| phone, dateOfBirth, mrn, nationalId | no | |
| depositMethod | no | default Cash |
| referenceNumber | no | stored on initial deposit |

Additional checks: selected bed must be `available`; if `mrn` / `nationalId` provided, no other non-discharged patient may have the same value.

**Success `201`:** `{ patient, rooms }`.  
**Errors:** `400` first validation message or bed/MRN/National ID errors; `500` `Failed to admit patient`.

---

### `POST /api/patients/:id/deposits`

| | |
|-|-|
| **Auth** | Required |
| **Description** | Additional deposit; increments `depositTotal` |

**Body:**

| Field | Required | Validation |
|-------|----------|------------|
| amount | yes | > 0 |
| method | yes | non-empty; non-cash (`Bank Transfer`, `Ebirr`, `Other`) requires referenceNumber |
| referenceNumber | conditional | unique among existing refs |
| date | no | default today UTC date |

**Success `201`:** mapped deposit.  
**Errors:** `404` patient; `400` validation; `500` `Failed to add deposit`.

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

### `GET /api/settings`

| | |
|-|-|
| **Auth** | Required |
| **Success `200`** | `{ name, address, tin, currency, lowBalanceThreshold, receiptFooter, vatPercent, dailyDoctorVisitFee, dailyDoctorVisitName }` or `{}` if missing |

---

### `PUT /api/settings`

| | |
|-|-|
| **Auth** | Required + role **Admin** |
| **Description** | `$set` of request body onto the `key: 'default'` document (upsert) |

No field whitelist. Unknown keys may be stored on the document.

**Success `200`:** mapped settings.  
**Errors:** `401`, `403` `Forbidden`, `500`.

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

## Manager

Both routes: **Auth required + role `Manager` or `Admin`.**

### `GET /api/manager/dashboard`

**Success `200`:**

```json
{
  "stats": {
    "todayRevenue": 0,
    "monthlyRevenue": 0,
    "totalDeposits": 0,
    "outstandingBalance": 0,
    "inpatientCount": 2,
    "nearLowBalance": 0,
    "todayDeposits": 0,
    "occupancyRate": 5
  },
  "revenueByDepartment": [{ "name": "Pharmacy", "revenue": 0 }],
  "dailyRevenueTrend": [{ "day": "Thu", "date": "2026-09-10", "revenue": 0 }],
  "topServices": [{ "name": "...", "count": 1, "revenue": 0 }],
  "topMedicines": [{ "name": "...", "count": 1, "revenue": 0 }],
  "recentPatients": [{ "id": "PAT-001", "name": "...", "deposit": 0, "balance": 0, "admissionDate": "...", "room": "...", "bed": "..." }],
  "hospitalName": "Central City Hospital"
}
```

`nearLowBalance` counts patients whose `deposit − charges < threshold * 2`.  
`outstandingBalance` sums `max(0, charges − deposit)` for current inpatients.

---

### `GET /api/manager/reports/:type`

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
