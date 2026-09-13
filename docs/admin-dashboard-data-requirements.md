# Admin Dashboard Data Requirements

Date: 2026-09-12  
Status: architecture / data audit only. No application code was changed.

## Architecture notes used in this audit

- There is **no separate Admission model**. `Patient` is the inpatient stay (`status`, `admissionDate`, discharge fields, room/bed).
- Billing catalog items live on `ServiceCategory.services[]` (name + price). There is **no** standalone Service document and **no** medicine inventory/stock field.
- Hospital structure is `Department` → `Ward` → `Room` → `Bed`.
- Money in is `Deposit`. There is no separate Payment collection. Credit is flags on `Patient` (`admissionPaymentMode`, `isCreditPatient`, `depositTotal`).
- Maternity is `Patient.admissionType === 'maternity'` plus optional `MaternityBaby`.
- Manager already has `GET /api/manager/dashboard` for executive finance. Admin home should stay **operational**, not a second copy of that report.
- Admin and Super Admin use the `/admin` shell (`accessRole: Admin`). The predefined Admin role has every catalog permission.

## Current Dashboard Audit

Source page: `frontend/src/pages/admin/AdminDashboard.jsx`  
All values today come from `frontend/src/data/mockData.js`.

### Total Services

- Current source: `services.length` (10 hardcoded rows)
- Mock/static/real: **Mock**
- Required real source: flatten `ServiceCategory.services` (catalog lines), not a hospital Department
- Already in DB: **Yes** — `ServiceCategory`
- Existing API: `GET /api/settings/categories` (also exposed as `api.getCategories()`)
- New API needed: not required to *count*, but a dashboard aggregate is cleaner
- Status: **A — can be connected immediately** (count only)
- Caveat: catalog items have **no `status` field**. The subtitle “N active” cannot be calculated honestly. Do not invent an active/inactive count until the catalog supports it.

### Total Medicines / in stock

- Current source: `medicines.length` and `stockStatus === 'in-stock'`
- Mock/static/real: **Mock**
- Required real source: pharmacy stock inventory — **does not exist**
- Already in DB: Pharmacy prices exist as lines under the `pharmacy` `ServiceCategory`. No quantity-on-hand, no `stockStatus`
- Existing API: categories API can list pharmacy *prices* only
- Status: **C / D**
  - **C** if the hospital later wants real stock
  - **D** for the current “in stock” card — it is demo inventory and would be fake if wired to the price list

### Active Users / total users

- Current source: mock `users` (4 demo accounts)
- Mock/static/real: **Mock**
- Required real source: `User.status` (`active` | `inactive`)
- Already in DB: **Yes**
- Existing API: `GET /api/users` (`users.view`)
- Status: **A — can be connected immediately**

### Departments

- Current source: mock `departments` (Laboratory, Pharmacy, Radiology, Doctors, …) with invented `staff` and `services` counts
- Mock/static/real: **Mock, and the wrong entity**
- Required real source: `Department` documents (Internal Medicine, Surgery, Obstetrics & Gynecology, …)
- Already in DB: **Yes**
- Existing API: `GET /api/departments` (`departments.view`); each row already includes `wardCount`
- Status: **A — department count can be connected immediately**
- Cannot support without new data: `staff` per department, `services` per department, and the colored “billing department” list

### Recent Services (list + prices)

- Current source: first 5 mock `services`
- Mock/static/real: **Mock**
- Ambiguous meaning:
  1. Recent **catalog** items — `ServiceCategory` (no useful “recent” unless using `updatedAt`)
  2. Recent **recorded charges** — `ServiceRecord` lines (operational activity)
- Status: **E — needs clarification**
- Recommendation: do **not** keep a priced catalog teaser on the Admin home. If a list is needed, show **recent admissions** (real `Patient` rows), not fake CBC/X-Ray prices.

### Department Overview (staff · services)

- Current source: mock `d.staff` and `d.services`
- Mock/static/real: **Mock**
- Required real source: staff assignment to departments, and services linked to departments
- Already in DB: `Department` has `name`, `description`, `active`, timestamps only. `Doctor.department` is a free-text string, not `departmentId`. Users have `role`, not a department. Services are not linked to `Department`.
- Status: **C — missing model capability** (staff/services per department)  
  Fallback that is honest: list real departments with **ward count** (already on `GET /api/departments`).

---

## Classification of every current metric

| Metric | Class |
| --- | --- |
| Total Services (count of catalog lines) | **A** count only; drop “active” until catalog has status |
| Total Medicines + in-stock | **D** (remove from dashboard) until a stock model exists (**C**) |
| Active / total users | **A** |
| Department count | **A** (use `Department`, not mock billing groups) |
| Recent Services price list | **D** or **E**; prefer replace with recent admissions |
| Department staff · services | **C**; replace with ward counts (**A**) |

Proposed metrics below are classified the same way.

---

## Recommended Production Dashboard

Admin home should answer: *Can we admit? Who is in the building? Is setup complete? Which staff and doctors are active?*  
Leave executive revenue charts on the Manager dashboard.

### Recommended cards (all Class A unless noted)

**Census (Patient = admission)**

| Widget | Query | Notes |
| --- | --- | --- |
| Active inpatients | `Patient` where `status !== 'discharged'` | Same definition as current list APIs |
| Admitted (in bed) | `status === 'admitted'` | |
| Pending discharge | `status === 'pending-discharge'` | |
| Today’s admissions | `admissionDate === today` | Date string `YYYY-MM-DD` already on the model |
| Today’s discharges | `status === 'discharged'` and `dischargeCompletedAt` on today | Use completed timestamp, not `updatedAt` |
| All-time registered stays | `Patient.countDocuments()` | This is stays/admissions, not a lifelong MPI. **E** if product later wants unique persons by MRN |

**Beds / rooms**

| Widget | Query |
| --- | --- |
| Total beds | `Bed.countDocuments()` |
| Available / occupied / maintenance / out of service | `Bed` grouped by `status` |
| Occupancy rate | occupied / total, or occupied / (available + occupied) — **E**, pick one definition and label it |
| Rooms / wards / departments | `Room`, `Ward`, `Department` counts, optionally `active: true` |

**Doctors**

| Widget | Query |
| --- | --- |
| Active doctors | `Doctor` where `active === true` |
| Total doctors | `Doctor.countDocuments()` |

**Staff**

| Widget | Query |
| --- | --- |
| Active users | `User` where `status === 'active'` |
| Total users | `User.countDocuments()` |

**Catalog (setup health, not clinical stock)**

| Widget | Query |
| --- | --- |
| Service categories | `ServiceCategory` count |
| Priced catalog lines | sum of `services.length` |

**Limited finance (only if permission allows)**

Supported today without a new money model:

| Widget | Query | Permission |
| --- | --- | --- |
| Today’s deposits | `Deposit` where `date === today`, sum `amount` | `payments.view` |
| Active credit admissions | `Patient` where `status !== 'discharged'` and `isCreditPatient === true` | `credit.view` |

Do **not** put monthly revenue, department revenue charts, or top medicines on Admin home. Those already exist on `GET /api/manager/dashboard` and mix deposits with approved charges.

**Operations lists**

| Widget | Query |
| --- | --- |
| Recent admissions | latest non-discharged (or all) `Patient` by `admissionDate` / `createdAt`, limit 8 |
| Recent deposits | latest `Deposit`, limit 8 — only with `payments.view` |

### Optional later (not required for first production Admin home)

| Widget | Class | Why wait |
| --- | --- | --- |
| Maternity cases / babies still admitted | **A** (counts exist) | Useful but secondary; `MaternityBaby.status` |
| Available beds by room type | **A** | Can add after occupancy totals |
| Medicine in stock | **C** | No inventory |
| Department staffing | **C** | No staff–department link |
| Today’s payments vs deposits | **C** / **E** | Only `Deposit` exists |
| Unique registered persons | **E** | Stay vs person (MRN/nationalId sparse) |

### Explicitly do not show

- Fake “in stock” medicines
- Mock Laboratory/Pharmacy/Radiology department tiles with staff counts
- Hardcoded service price teasers
- Full executive revenue suite (Manager already owns this)

---

## Backend Requirements

### Existing APIs that can be reused (not ideal as the only source)

The frontend *could* fan out:

- `GET /api/patients?view=full`
- `GET /api/patients/discharged`
- `GET /api/beds`
- `GET /api/rooms`
- `GET /api/wards`
- `GET /api/departments`
- `GET /api/doctors`
- `GET /api/users`
- `GET /api/settings/categories`

Problems with reuse-only:

- Over-fetch (full patient + deposit + assignment payloads just to count)
- Inconsistent dates (client “today” vs server)
- Easy to miss discharged-today (discharged list is a separate call)
- Finance would require scanning every deposit client-side
- RBAC is per-list; a single dashboard response can omit sections the user cannot see

`GET /api/manager/dashboard` should **not** be the Admin home API. It is finance-shaped, requires `reports.view`, and does not return bed status breakdowns, user counts, doctor counts, or hospital-department counts.

### APIs that need modification

None required for a first version. Optional later: have list endpoints accept `countOnly` — not necessary if a dedicated dashboard route is added.

### New API required

Recommend following the Manager pattern: one authenticated aggregate route.

Conceptual:

`GET /api/admin/dashboard`

Mount next to existing admin resources, e.g. `server/routes/admin.routes.js` or a small handler beside departments — **not** by expanding `manager.routes.js`.

Suggested response (omit keys the caller is not allowed to see):

```json
{
  "census": {
    "activeInpatients": 0,
    "admitted": 0,
    "pendingDischarge": 0,
    "admittedToday": 0,
    "dischargedToday": 0,
    "totalStays": 0
  },
  "beds": {
    "total": 0,
    "available": 0,
    "occupied": 0,
    "maintenance": 0,
    "outOfService": 0,
    "occupancyRate": 0
  },
  "setup": {
    "departments": 0,
    "wards": 0,
    "rooms": 0
  },
  "doctors": { "active": 0, "total": 0 },
  "staff": { "active": 0, "total": 0 },
  "catalog": { "categories": 0, "pricedItems": 0 },
  "finance": {
    "depositsToday": 0,
    "creditAdmissions": 0
  },
  "recentAdmissions": [],
  "recentDeposits": []
}
```

`finance` and `recentDeposits` should be absent (not zero-filled) without `payments.view` / `credit.view`.

### Database queries required

All are counts or small sorts on existing collections:

- `Patient.countDocuments` with status / `admissionDate` / `admissionPaymentMode` / `isCreditPatient`
- `Patient.find` for recent admissions (projection: `patientId`, `name`, `status`, `admissionDate`, `room`, `bed`, `admissionType`)
- `Patient` discharged today via `dischargeCompletedAt` range
- `Bed.aggregate` `$group` by `status`
- `Department` / `Ward` / `Room` / `Doctor` / `User` counts
- `ServiceCategory.find` to sum nested `services.length`
- `Deposit.aggregate` match today’s `date` (string `YYYY-MM-DD`, same convention as manager)
- `Deposit.find` recent, limit 8

No schema change is required for the recommended first dashboard.

---

## Missing Data

The current database **cannot** honestly support:

| Desired metric | Gap |
| --- | --- |
| Medicine stock / in-stock count | No inventory fields; pharmacy is a price list |
| Active vs inactive catalog services | `ServiceCategory.services[]` has only `name`, `price` |
| Staff per department | `User` has no `departmentId`; `Doctor.department` is optional text |
| Services per hospital department | Catalog is not related to `Department` |
| Separate “today’s payments” vs deposits | Only `Deposit` |
| Refunds on the dashboard | `payments.refund` exists as a permission; no refund collection/flow audited as complete |
| Unique lifelong patient registry | Each `Patient` is a stay; MRN/nationalId are optional |
| Nurse-to-patient assignment census | No nurse assignment model |
| Bed occupancy excluding maintenance from denominator | Policy choice, not missing fields |

Maternity and credit **can** be counted already; they are optional extras, not blockers.

---

## Security / RBAC

Route `/admin` is already behind `RequireAuth role="admin"`. Night Reception, Nurse, and Manager never load this page.

Still enforce **server-side** permissions on any new dashboard API. Do not trust the Admin SPA.

Recommended gate for `GET /api/admin/dashboard`:

- `authRequired`
- `requireAnyPermission` of operational views, for example:  
  `users.view`, `departments.view`, `rooms.view`, `beds.view`, `doctors.view`, `patients.view`

Then **shape the payload**:

| Section | Include only if |
| --- | --- |
| `census`, `recentAdmissions` | `patients.view` |
| `beds` | `beds.view` or `rooms.view` |
| `setup` | matching `departments.view` / `wards.view` / `rooms.view` |
| `doctors` | `doctors.view` |
| `staff` | `users.view` |
| `catalog` | `system.view_settings` |
| `finance.depositsToday`, `recentDeposits` | `payments.view` |
| `finance.creditAdmissions` | `credit.view` |

Do **not** require `reports.view` for this endpoint. That permission is for Manager reports. An admin who is later given a slimmer custom role should not get monthly revenue just because they opened Admin home.

Do **not** return user emails/password hashes, deposit reference numbers beyond what list UIs already show, or full patient clinical notes.

Predefined Admin/Super Admin have all keys, so they will receive the full operational payload. That is acceptable if the UI stays operational (deposits today, credit count) and does not duplicate the executive dashboard.

---

## Implementation Order

Safest sequence (still not implemented in this task):

1. **Document occupancy and “registered patients” wording** (stay vs person; occupancy denominator).
2. Add `GET /api/admin/dashboard` with counts only (`census`, `beds`, `setup`, `doctors`, `staff`, `catalog`). No finance lists yet.
3. Point `AdminDashboard.jsx` at that API. Remove `mockData` imports from that page only. Loading + error + empty states. Do not delete `mockData.js`.
4. Add `recentAdmissions` (patient list projection).
5. Add `finance` / `recentDeposits` behind `payments.view` and `credit.view`.
6. Drop medicines-in-stock and fake department staff tiles.
7. Optional: maternity counts; beds-by-room-type.

Do not implement finance charts on Admin until there is a product reason to diverge from Manager.

---

## Fit with existing dashboard APIs

| API | Reuse for Admin home? |
| --- | --- |
| `GET /api/manager/dashboard` | No — different audience and metrics |
| List APIs (`/users`, `/departments`, `/beds`, …) | Possible but heavy; OK as a temporary client-side compose |
| New `GET /api/admin/dashboard` | **Recommended** — same style as Manager, operational payload, permission-shaped |

STOP. No code was modified except this document.
