# Discharge Workflow

Related documents: [BUSINESS_RULES.md](./BUSINESS_RULES.md) · [DATABASE.md](./DATABASE.md) · [API_REFERENCE.md](./API_REFERENCE.md) · [ARCHITECTURE.md](./ARCHITECTURE.md) · [TESTING.md](./TESTING.md)

This document records an inspection of the existing InCare codebase and the discharge workflow implemented to fit it. Functionality listed under **Implemented** is what the code actually does.

---

## Existing architecture (inspection)

The app is a React SPA (`src/`) plus Express + Mongo API (`server/`). There are no controllers, DTOs, or a repository layer. Routes hold handlers. The only extracted service before this work was `server/services/autoCharges.js`. Dual-mode contexts use `USE_API` vs `src/data/mockData.js`.

### Relevant files

| Area | Files |
|------|--------|
| Patient model | `server/models/Patient.js` |
| Bed / assignment | `server/models/Bed.js`, `RoomAssignment.js` |
| Deposits / records | `server/models/Deposit.js`, `ServiceRecord.js` |
| Patient APIs | `server/routes/patients.routes.js` |
| Records APIs | `server/routes/records.routes.js` |
| Authz | `server/middleware/auth.js` (`authRequired`, `requireRole`) |
| Balance / daily charges | `server/services/autoCharges.js` |
| Validation | `server/utils/validation.js`, `src/lib/validation.js` |
| Mappers | `server/utils/mappers.js` |
| SPA state | `src/context/PatientsContext.jsx`, `ServiceEntriesContext.jsx` |
| API client | `src/api/client.js` |
| Reception UI | `ReceptionDashboard.jsx`, `PatientsList.jsx`, `PatientBilling.jsx` |
| Nurse UI | `NurseDashboard.jsx`, `NursePatientsList.jsx`, `PatientServiceEntry.jsx` |
| Room transfer | `src/components/shared/RoomTransferPanel.jsx` |
| Status badges | `src/components/shared/CommonComponents.jsx` |
| Mock pending flag | `src/data/mockData.js` (`PAT-005`) |
| Tests | **None** (no runner, no `*.test.js`) |

### Existing models (pre-change)

- **Patient:** `status` enum `admitted | pending-discharge | discharged`; unused `pendingDischarge` boolean; no discharge request/approval fields.
- **Admission:** not a separate collection. One Patient document is one stay.
- **Room:** no Room collection. Beds have `roomType`.
- **Bed:** `available | occupied`, `patientId`.
- **RoomAssignment:** `startDate`, `endDate` (null = open), `dailyRate`, `reason`. History is kept by closing (`endDate`), not deleting.
- **Transfer:** same assignment model; transfer route closes the open row and opens a new one.
- **ServiceRecord:** `pending | approved | rejected`; `auditTrail` `{ action, by, at, note }`.
- **Deposit:** increments `Patient.depositTotal`. Overpayment allowed. No refund API.

### Existing APIs (pre-change)

No discharge endpoints. `GET /api/patients` excludes `status === 'discharged'`. `GET /api/patients/:id` still returns a discharged patient if requested by id. Transfer rejects only `discharged`. Records and deposits did not check stay status.

### Existing frontend

- Dashboard **Pending Discharges** card counted `p.pendingDischarge` (boolean). In API mode that flag was never set, so the count was 0.
- Card was not clickable. No pending-discharge list page. No discharged-patients page.
- Nurse had no Request Discharge action. Reception had no review/approve/reject.
- `StatusBadge` already styled `pending-discharge`.
- Patient lists exclude discharged because the API omits them.

### Existing patient lifecycle

`admitted` on create. `pending-discharge` existed only on the schema and mock `PAT-005`. No transition to `discharged`.

### Existing room/bed lifecycle

Occupied on admit and transfer. Freed on transfer. Discharge did not free beds.

### Existing financial logic

`remaining = depositTotal − sum(approved record totals)`. Pending records do not affect the bill. VAT is unused. `ensureAutomaticDailyCharges` skips `status === 'discharged'` and upserts room/doctor lines by `{ patientId, date, autoType }`. Assignment coverage: `startDate <= date` and (`endDate` is null or `endDate > date`). Triggered on admit and transfer, not on GET patient.

There is **no** rule that discharge requires a zero balance. Payments may exceed charges.

### Existing permission structure

Roles: `Reception`, `Nurse`, `Admin`, `Manager`. Frontend gates routes by `roleKey`. Almost all patient/record writes required only JWT. `requireRole` is used for settings (Admin) and manager reports (Manager or Admin). Nurse money hiding is UI-only.

### Current gaps (pre-implementation)

1. No request / approve / reject APIs or UI.
2. No occupancy close or bed release on discharge.
3. Auto charges never stop via a real discharge.
4. Dashboard pending count used a stale boolean.
5. No historical discharged list.
6. Discharged/pending patients could still receive services, deposits, and transfers via API.
7. No concurrency protection.
8. No automated tests.

---

## Proposed and implemented workflow

```
admitted
   │  Nurse: POST .../discharge-request
   ▼
pending-discharge   (bed still occupied, assignment still open, charges continue)
   │
   ├─ Reception reject: POST .../discharge/reject  →  admitted
   │
   └─ Reception approve: POST .../discharge/approve  →  discharged
         ├── close open RoomAssignment (endDate = discharge date)
         ├── free bed (available, patientId null)
         ├── generate auto charges through discharge date, then skip further days
         └── keep patient, deposits, records, assignment history
```

Nurse does not complete discharge. Reception does not create the nurse request (API `requireRole('Nurse')`). Admin may approve/reject (`requireRole('Reception', 'Admin')`) using the existing Admin override pattern. Manager cannot write discharge.

Request does **not** free the bed or stop charging.

---

## Files created

| File | Role |
|------|------|
| `docs/discharge-workflow.md` | This document |
| `server/services/discharge.js` | Request / reject / complete discharge |
| `src/components/shared/DischargeWorkflow.jsx` | Nurse request dialog + reception review |
| `src/pages/reception/PendingDischarges.jsx` | Pending list |
| `src/pages/reception/DischargedPatients.jsx` | Historical list |
| `server/utils/dischargeRules.test.js` | `node:test` unit tests |

## Files modified

Backend: `Patient.js`, `validation.js`, `mappers.js`, `patients.routes.js`, `records.routes.js`, `package.json`.

Frontend: `client.js`, `PatientsContext.jsx`, `App.jsx`, `Sidebar.jsx`, `CommonComponents.jsx`, `RoomTransferPanel.jsx`, `ReceptionDashboard.jsx`, `PatientsList.jsx`, `PatientBilling.jsx`, `NurseDashboard.jsx`, `NursePatientsList.jsx`, `PatientServiceEntry.jsx`, `src/lib/validation.js`, `src/lib/utils.js`.

Docs: this file plus BUSINESS_RULES, DATABASE, API_REFERENCE, MODULES, KNOWN_ISSUES, TESTING, SECURITY, ROADMAP, FOLDER_STRUCTURE, CHANGELOG_AI, AI_CONTEXT.

No Mongo migration script: new Patient fields are optional; Mongoose applies them on write.

---

## Model / schema changes

On `Patient` (same collection, no new tables):

| Field | Purpose |
|-------|---------|
| `pendingDischarge` | Kept and **synced** with `status === 'pending-discharge'` for older UI |
| `dischargeRequestedBy` / `At` / `Notes` | Current request |
| `dischargeRejectedBy` / `At` / `Reason` | Last rejection (cleared on a new request) |
| `dischargeCompletedBy` / `At` | Final approval |
| `dischargeFinalCharges` / `Deposits` / `Balance` | Snapshot at completion (`calcPatientBalance`) |
| `dischargeEvents[]` | `{ action, by, at, note }` — same shape as `ServiceRecord.auditTrail` |

Room, bed, deposit, and service-record schemas are unchanged. Assignments are closed, never deleted.

---

## API changes

Static paths are registered **before** `GET /:id`.

| Method | Path | Role | Effect |
|--------|------|------|--------|
| GET | `/api/patients/pending-discharge` | JWT | Patients with `status: pending-discharge` + balance |
| GET | `/api/patients/discharged` | JWT | Discharged stays + balance + discharge metadata |
| POST | `/api/patients/:id/discharge-request` | Nurse | `admitted` → `pending-discharge`; bed unchanged |
| POST | `/api/patients/:id/discharge/approve` | Reception or Admin | Complete discharge |
| POST | `/api/patients/:id/discharge/reject` | Reception or Admin | Body `{ reason }` required → `admitted` |

Guards added on existing writes:

- Records / returns: rejected when `discharged`.
- Deposits: rejected when `discharged`.
- Transfer: rejected when `discharged` or `pending-discharge`.
- Doctor-visit toggle: rejected when `discharged`.

---

## Frontend changes

- Nurse patient page: **Request Discharge** (not “Discharge”) + confirmation with stay summary and optional note.
- Reception dashboard card uses `status === 'pending-discharge'` and navigates to `/reception/pending-discharges`.
- Pending Discharges table: Review → patient billing (review panel).
- Patient billing: review panel when pending; historical read when discharged (fetch by id if missing from the active list).
- `/reception/discharged`: historical list.
- Sidebar: Pending Discharges, Discharged.
- Transfer / new services / deposits hidden when they are not allowed.
- Mock mode implements the same transitions locally.

---

## Validation rules

| Action | Allowed when |
|--------|----------------|
| Request | `status === 'admitted'` |
| Approve / reject | `status === 'pending-discharge'` |
| Reject body | non-empty `reason` |
| Approve | patient exists; open assignment exists; bed exists (or is already free for this patient) |

Financial state is **not** a hard block (no existing clearance policy). Outstanding and overpayment are allowed; the snapshot is stored.

---

## Financial behavior

Uses `calcPatientBalance` only. Before approve, `ensureAutomaticDailyCharges(patient, dischargeDate)` runs while the assignment is still open so the final day is upserted. After `status` is `discharged`, auto-charge generation skips the patient. Previous deposits and records are never deleted. Overpayment remains as positive remaining balance; there is still no refund document type.

**Assumption:** Reception may complete discharge with a non-zero outstanding or credit. Pending (unapproved) records stay in history and do not change the snapshot.

---

## Room / bed behavior

- Request / reject: occupancy unchanged.
- Approve: open assignment `endDate =` discharge date (`YYYY-MM-DD`); bed `available`, `patientId` null. Patient `room` / `bed` labels stay for history.
- Occupancy counts come from bed documents, so they update when the bed is freed.

---

## Audit / history

`dischargeEvents` appends `requested`, `rejected`, `approved`. No new audit collection. Service-record and deposit history unchanged.

---

## Permission changes

New uses of existing `requireRole` only. No new roles or permission documents.

| Action | Nurse | Reception | Admin | Manager |
|--------|-------|-----------|-------|---------|
| Request discharge | yes | no | no | no |
| Approve / reject | no | yes | yes | no |
| View pending / discharged lists | yes (API) | yes | yes | yes |

---

## Edge cases

| Case | Behavior |
|------|----------|
| Already discharged | 400; cannot request / approve / reject / transfer / charge / deposit |
| Already pending | 400 on second request |
| Missing open assignment on approve | 400, no status change |
| Missing bed on approve | 400 if no bed row; if bed already available for this patient, discharge continues |
| Pending charges | Shown in review; do not block |
| Zero / outstanding / overpay | All allowed; snapshot stored |
| Active services | Existing records kept; new daily records blocked only after discharged |
| Transfer while pending | 400 |
| Concurrent request | `findOneAndUpdate` on `status: admitted` → 409 if lost |
| Concurrent approve | claim `pending-discharge` → `discharged`; loser 409; bed/assignment not double-freed |
| Transaction unsupported (standalone Mongo) | Same steps without a session; status claim is the lock |
| Transaction supported (replica set) | `session.withTransaction` |
| Unauthorized roles | 403 |
| Reject | Back to admitted; bed stays occupied; reason stored |
| Data change between request and approve | Review shows current room, bed, and `calcPatientBalance` |

---

## Testing

Existing repo had no test runner. Server now has `npm test` → `node --test` on `dischargeRules.test.js` (status transitions, reject reason, inpatient write guards). No frontend test runner was added (no Vitest in the project). Full API/E2E cases remain manual (see TESTING.md).

---

## Known assumptions

1. One Patient document = one stay. Re-admission of the same person is a new patient id (existing admit rules).
2. Discharge does not require zero balance.
3. Deposits remain allowed while `pending-discharge` so reception can take clearance payments; they are blocked after `discharged`.
4. Nurse services remain allowed while `pending-discharge` (care continues); blocked after `discharged`.
5. Room transfer is blocked while `pending-discharge`.
6. Admin may approve/reject; Admin cannot create the nurse request.
7. `pendingDischarge` boolean is legacy compatibility, not the source of truth. Canonical field is `status`.
8. No refund workflow was added.
9. Standalone Mongo may not support multi-document transactions; optimistic status claim is the fallback.
