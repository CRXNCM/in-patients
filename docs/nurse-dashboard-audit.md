# Nurse Dashboard Audit

Status: **audit only**. No application, API, model, or shared-component code was changed.

Labels used below:

- **CONFIRMED FROM CODE** — observed in the current repository
- **RECOMMENDED** — suggested for a later production Nurse Dashboard; not implemented
- **NEEDS HOSPITAL CONFIRMATION** — product/workflow decision, not implied by code

---

## 1. Current Dashboard

**CONFIRMED FROM CODE**

| Item | Location |
| --- | --- |
| Page | `frontend/src/pages/nurse/NurseDashboard.jsx` |
| Route | `/nurse` (index under `RequireAuth role="nurse"`) |
| Layout | `AppLayout role="nurse"` |
| Sidebar | Dashboard (`/nurse`), Patients (`/nurse/patients`, gated `patients.view`) |
| Related pages (not the dashboard) | `NursePatientsList.jsx`, `PatientServiceEntry.jsx` |

There is **no** `useNurseDashboard` hook and **no** `GET /api/nurse/dashboard`.

### Header

- Title: “Nurse Dashboard”
- Description: “Record daily patient services — no billing or payment access”
- Action: **View All Patients** → `/nurse/patients`

### Stat cards (`StatCard`)

| Card | Value | Source type |
| --- | --- | --- |
| Admitted Patients | `patients.length` | Derived from shared patient list (API when `USE_API`, else mock patients). Subtitle **“Under your care”** is not backed by any nurse-assignment field. |
| My Pending Records | Count of records in last 30 (by `recordedAt`) where `status === 'pending'` **and** `recordedBy === CURRENT_NURSE` | Derived + **hardcoded identity** |
| Hospital Pending Queue | All records with `status === 'pending'` | Derived from hospital-wide records list |
| Recent Activity | `getRecentRecords(6).length` (0–6) | Derived; this is “how many of the latest 6 exist”, not a meaningful hospital KPI |

### Admitted Patients table

- First **5** rows of `patients` (`slice(0, 5)`), not filtered to `status === 'admitted'`
- Columns: Patient ID, name, room/bed, admission date (`formatDate`), status (`StatusBadge`), record counts (total + pending), **Record Services**
- Row click and button → `/nurse/patient/:id`
- **View All** → `/nurse/patients`

### Recent Records list

- Latest 6 records hospital-wide (`getRecentRecords(6)`)
- Shows `recordName`, type (Daily Services / Pharmacy Return), item count, `StatusBadge`
- No empty-state copy if the list is empty
- Not scoped to the signed-in nurse

### Fake / demo values on this page

| Item | Classification |
| --- | --- |
| `CURRENT_NURSE = 'Nurse Almaz Tsegaye'` | **Hardcoded demo name** (`ServiceEntriesContext.jsx`). Used for “My Pending Records” and as `recordedBy` on `PatientServiceEntry`. |
| “Under your care” | **Misleading copy**. List is all non-discharged inpatients. |
| Mock branch | If `VITE_USE_API=false`, patients and records come from `mockData.js`. Default app mode uses the API. |

The dashboard does **not** import `DashboardChrome` or `mockData.js` directly. It uses `StatCard` / `PageHeader` / `Card` / `DataTable`.

---

## 2. Current Data Flow

**CONFIRMED FROM CODE**

There is no Nurse-specific aggregate.

```
Login
  → AuthContext (JWT)
  → PatientsProvider.refreshFromApi
       GET /api/patients?view=full
       GET /api/patients/discharged  (loaded for all roles; unused on Nurse dashboard)
  → ServiceEntriesProvider.refreshRecords
       GET /api/records
  → NurseDashboard reads context
       patients, getPendingCount, getRecentRecords, getPatientRecords, CURRENT_NURSE
```

| Layer | File |
| --- | --- |
| Page | `NurseDashboard.jsx` |
| Client | `frontend/src/api/client.js` — `getPatientsFull`, `getRecords` |
| Hook | None dedicated. Shared contexts only. |
| Routes | `server/routes/patients.routes.js` (`GET /`), `server/routes/records.routes.js` (`GET /`) |
| Queries | `Patient.find({ status: { $ne: 'discharged' } })`, `Bed.find()`, `Deposit.find()`, `RoomAssignment.find()`, per-patient `calcPatientBalance`, doctor + baby maps; `ServiceRecord.find({})` |

**Freshness:** contexts load once after login. Submitting a record updates local state. There is no interval refresh and no dashboard-level retry.

**Duplicate / heavy work (CONFIRMED):**

- Every authenticated user (including Nurse) loads **full** inpatient payload: balances, **all deposits**, all room assignments, all beds, discharged list.
- Every authenticated user loads **all** service records.
- Nurse Dashboard then reduces those lists in the browser.

This is the opposite of Admin’s `GET /api/admin/dashboard` (permission-scoped counts + `limit(8)`).

---

## 3. Current API Response

**CONFIRMED FROM CODE** — Nurse Dashboard does not consume a dedicated payload. It consumes two shared responses.

### `GET /api/patients?view=full`

Auth: `authRequired` + `patients.view`

```json
{
  "patients": [ /* toFrontendPatient + roomHistory + assignedDoctors + baby */ ],
  "deposits": { "PAT-001": [ { "id", "date", "amount", "method", "receivedBy", "isInitial" } ] },
  "assignments": [ /* room assignment rows */ ],
  "rooms": [ /* beds grouped by room type */ ]
}
```

`toFrontendPatient` includes **financial** fields: `deposit`, `requiredInitialDeposit`, `admissionPaymentMode`, `isCreditPatient`, `depositStatus`, `outstandingDeposit`, `totalCharges`, plus `phone`, `assignedDoctors`, `admissionType`, `baby`, `status`.

Inpatients are `status !== 'discharged'` (admitted **and** pending-discharge).

### `GET /api/records`

Auth: `authRequired` + `patients.view`

Array of `toFrontendRecord` (all records, optional `patientId` / `status` query unused by the context). Includes `recordedBy` mapped from `submittedBy`.

### Fields actually useful to a nurse (RECOMMENDED filter of what already exists)

Useful on a ward board: `id`, `name`, `status`, `admissionDate`, `admissionType`, `room`, `bed`, `assignedDoctors`, maternity/`baby`, pending vs submitted records for **this** stay.

Less useful / inappropriate on a **dashboard**: deposits, outstanding deposit, `totalCharges`, full deposit ledger, hospital-wide room inventory, discharged census.

---

## 4. Current Permissions

**CONFIRMED FROM CODE**

### Frontend access to `/nurse`

- `RequireAuth role="nurse"` compares `user.roleKey === 'nurse'` (`User.role` / `accessRole` is `Nurse`).
- **Not** permission-gated. A custom role with `accessRole: Nurse` and few keys still opens the dashboard.
- Sidebar “Patients” requires `patients.view`; the dashboard index does not.
- If `patients.view` is missing, `GET /api/patients?view=full` and `GET /api/records` return **403**. Contexts `catch(console.error)` and leave **empty arrays**. The page still renders zeros / empty table — looks like an empty ward, not Forbidden.

### Seeded Nurse role keys (`NURSE_PERMISSIONS`)

`patients.view`, `patients.edit`, `admissions.view`, `rooms.view`, `doctors.view`, `doctors.assign`

**Not** on the default Nurse set: `payments.view`, `credit.view`, `admissions.discharge` (approve), `admissions.create`, `rooms.assign_beds`, `users.*`, `system.*`.

### Backend vs frontend

| Action | Backend | Frontend Nurse UI |
| --- | --- | --- |
| List inpatients / records | `patients.view` | Dashboard assumes lists exist |
| Submit services / returns | `patients.edit` or `doctors.assign` | Service builder on stay page |
| Assign visiting doctor | `doctors.assign` | `AssignedDoctorsPanel` `canAdd` is only `status !== 'discharged'` — **no permission check** (API still 403) |
| Request discharge | `requireRole('Nurse')` — **role, not permission** | `RequestDischargeButton` shown for any `admitted` stay; **no** `admissions.discharge` check |
| Approve/reject discharge | `admissions.discharge` | Not on Nurse dashboard |
| Room transfer | `rooms.assign_beds` | Not on Nurse dashboard |
| View deposits API as part of `view=full` | Same `patients.view` as the list | Nurse context **downloads** deposits even though the dashboard does not display them |

**Doctor placeholder role** (`accessRole: Nurse` in the connectivity audit) lands on this same dashboard. **CONFIRMED** in `AuthContext` `ROLE_ROUTES.Nurse = '/nurse'` and `docs/dashboard-backend-audit.md`.

---

## 5. Existing Nurse Workflows

**CONFIRMED FROM CODE** — what exists, not what would be nice.

| Workflow | Exists? | Where |
| --- | --- | --- |
| See current inpatients | Yes | Context list = non-discharged; dashboard + `/nurse/patients` |
| Open a stay | Yes | `/nurse/patient/:patientId` |
| Record daily services / pharmacy return | Yes | `ServiceRecordBuilder` `source="nurse"`, `hideMoney`; pending until reception |
| Record history | Yes | `RecordTimeline` `hideMoney` |
| Mother/baby subjects on maternity | Yes | Stay page + `MaternityAdmissionPanel` (edit if not discharged) |
| Assign / end visiting doctors | Yes | `AssignedDoctorsPanel` on stay page |
| Request discharge | Yes | `RequestDischargeButton` on stay page; bed stays occupied |
| Approve discharge / billing | No | Reception |
| Admit patients | No | Reception |
| Room/bed transfer | API exists; Nurse default role **cannot** (`rooms.assign_beds` missing); dashboard has no transfer UI |
| Nurse-to-patient assignment (“my patients”) | **No model / field** |
| Clinical vitals, meds admin, care plans, handover notes | **No** |
| Dedicated nursing task list | **No** (only service records) |
| Dashboard-level maternity/pending-discharge widgets | **No** (only on stay / list pages) |

Nurse list page also shows **CreditBadge** (financial). Dashboard table does not.

---

## 6. Real Problems / Risks

**CONFIRMED FROM CODE**

1. **Hardcoded nurse name** — “My Pending Records” is wrong for any logged-in user whose `req.user.name` is not exactly `Nurse Almaz Tsegaye`. New records submitted from the stay page still stamp that demo name when `CURRENT_NURSE` is passed as `recordedBy`.
2. **Wrong census semantics** — `patients.length` includes `pending-discharge`. Card title says “Admitted”; Reception dashboard at least filters `status === 'admitted'` for its count.
3. **False “under your care”** — no nurse assignment.
4. **Financial payload on a clinical role** — `view=full` + `calcPatientBalance` + all `Deposit` documents. Dashboard copy says no billing access; the browser still receives money fields. Nurse patients list shows credit badges.
5. **Hospital-wide records** — pending queue and recent list are not “my work”.
6. **No loading / error / retry** — failed API → empty ward. Unlike Admin’s dedicated hook.
7. **No empty-state copy** on Recent Records.
8. **`formatDate(admissionDate)`** — `new Date('YYYY-MM-DD')` can show the previous calendar day in ET.
9. **Heavy queries** — N balance calculations + full deposits/beds/assignments for a page that shows 4 numbers and 5 rows.
10. **Dashboard not permission-aware** — 403 looks like zero patients.
11. **Discharge request** gated by **role name Nurse**, not a permission key; Admin SPA cannot call it, but any `accessRole: Nurse` can.
12. **Doctor accessRole** sharing this dashboard mixes two jobs.
13. **Recent Activity card** is a weak metric (length of a 6-item slice).

---

## 7. Useful Existing Data

**CONFIRMED FROM CODE** — already in models/APIs, usable later without inventing collections.

- `Patient.status`: `admitted` \| `pending-discharge` \| `discharged`
- `admissionDate`, `admissionType`, `room`, `bed`, `name`, `patientId`
- `ServiceRecord` status `pending` / `approved` / `rejected`, `submittedBy`, `date` / `recordedAt`, `source`, `subjectType` / `babyId`
- Doctor assignments (`DoctorAssignment`)
- Maternity baby (`MaternityBaby`)
- Discharge request timestamps/notes on `Patient`
- `todayStr()` / `localDayRange` for “today” (Admin already uses these; Nurse dashboard does not)

---

## 8. Missing Data

**CONFIRMED FROM CODE** (no such source):

- Nurse staff assignment to a stay or ward
- Shift / handover
- Vitals, MAR, nursing notes
- “My” records filter by `req.user.id` (records store a **name** string, not user id)

**NEEDS HOSPITAL CONFIRMATION** whether those should exist at all.

**RECOMMENDED** if staying within current domain: server-side counts scoped by `submittedBy === req.user.name` (or better, `submittedByUserId` if added later).

---

## 9. Recommended Nurse Dashboard Responsibilities

Think of the nurse as **ward operations + recording care charges**, not admin setup or revenue.

**RECOMMENDED** (only using capabilities that already exist):

1. How many stays are **admitted** vs **pending discharge** (honest labels).
2. Work queue: **my** pending records (logged-in user), plus maybe hospital pending if the hospital wants visibility.
3. Today: who still needs a daily service record (if product confirms that rule).
4. Short list of current inpatients with room/bed, status, maternity flag, entry to record services.
5. Recent **my** submissions (not the whole hospital).
6. Entry points already real: patients list, stay page (records, doctors, discharge request, maternity).

**NEEDS HOSPITAL CONFIRMATION**

- Should nurses see every inpatient or only a ward/team?
- Should “hospital pending queue” stay visible (helps coverage) or be Reception-only?
- Is requesting discharge a core dashboard action or stay-page-only?

---

## 10. What Should NOT Be On Nurse Dashboard

**RECOMMENDED** (aligned with existing copy and Manager/Admin split):

- Revenue, deposits, outstanding balance, credit ledgers, Manager charts
- Admin setup: departments/wards/users/catalog size, medicine stock
- Full deposit history / `view=full` money blob
- Fake trends, “under your care” without an assignment model
- Approving billing records (Reception)
- Creating admissions (Reception)
- Invented clinical modules (vitals, MAR) until they exist

**CONFIRMED** dashboard already avoids showing currency; stay builder uses `hideMoney`. Do not add money to the home page.

---

## 11. Recommended Dashboard Information Hierarchy

**RECOMMENDED**

1. **Work status (fold)** — admitted count, pending-discharge count, my pending records (real user). Optional hospital pending if confirmed.
2. **Needs attention** — pending discharge list and/or stays with no record today (**needs confirmation** of the “today” rule).
3. **Current inpatients** — compact table (room/bed, status, maternity), link to stay. Not five random cards of finance.
4. **My recent submissions** — small list.

Do **not** copy Admin’s occupancy + configuration + catalog + deposits row unless the hospital asks nurses to watch empty beds (`rooms.view` exists but is unused on this page).

---

## 12. Recommended API Changes

**RECOMMENDED**

- Add `GET /api/nurse/dashboard` (same family as Admin): `authRequired` + `requireAnyPermission('patients.view', …)` or `patients.view` only.
- Return **counts and short lists**, not all deposits/beds.
- Scope “mine” with `submittedBy: req.user.name` until a user-id field exists.
- Census: `status: 'admitted'` vs `pending-discharge` separately.
- Recent inpatients: `find` + `sort` + `limit`, lean projection (no balance).
- **Omit** finance/credit unless a future permission says otherwise.
- Do **not** reuse Admin or Manager payloads.

**NEEDS HOSPITAL CONFIRMATION** before adding indexes or `submittedByUserId`.

Optional later: stop sending `view=full` deposits to Nurse by splitting a clinical list endpoint. That is a context change, not required to ship a dashboard aggregate.

---

## 13. Recommended Frontend Changes

**RECOMMENDED** (later implementation; not this audit)

- `api.getNurseDashboard()` + `useNurseDashboard` (Admin pattern: loading, error, Retry, **no mock fallback**).
- Stop using `CURRENT_NURSE` for metrics and `recordedBy`; use `useAuth().user.name`.
- Fix admitted vs pending-discharge labels.
- Empty / 403 / error states.
- After visual approval, wrap with `DashboardChrome` (`docs/dashboard-visual-style.md`) — **do not** restyle in the audit phase.
- Keep stay-page workflows; dashboard only links into them.
- Do not put `CreditBadge` on the Nurse home table unless the hospital wants credit visible to nurses.

Do **not** modify `DashboardChrome.jsx` or Admin as part of Nurse work unless a later step says so.

---

## 14. Open Business/Workflow Questions

**NEEDS HOSPITAL CONFIRMATION**

1. Is every inpatient on every nurse’s board, or is there (or should there be) ward/team assignment?
2. Should “My pending” mean submitted by me, or pending on patients I work with?
3. Should nurses see the hospital-wide pending queue?
4. Is “no daily record today” a required work item?
5. Should pending-discharge be a first-class dashboard strip?
6. Should nurses see credit flags?
7. Should discharge request stay stay-page-only?
8. Should the Doctor `accessRole` keep sharing `/nurse`?
9. Should `recordedBy` become a user id?
10. Should `GET /api/patients?view=full` be split so nurses never download ledgers?

---

## Summary (most important findings)

1. The Nurse “dashboard” is a **client-side mash-up** of two hospital-wide APIs. There is no Nurse aggregate endpoint.
2. **“My Pending Records” is demo-broken** unless the user’s display name is `Nurse Almaz Tsegaye`. The same string is sent as `recordedBy` from the stay page.
3. **“Admitted” / “under your care” are inaccurate** — count is all non-discharged stays, not assigned to the nurse.
4. Nurses **download financial and inventory data** they do not show on this page (`view=full`).
5. **No loading/error/permission UI** — API failure looks like an empty hospital.
6. Real nurse work already lives on the **stay page** (services, maternity, doctors, discharge request). The home page should point at that work, not invent new clinical modules.
7. For production, **copy Admin’s architecture** (dedicated GET, hook, omit unauthorized sections, counts in Mongo, no mock fallback). **Do not copy** Admin’s census/setup/catalog/finance content or occupancy-as-admin-inventory.

STOP. No code was changed.
