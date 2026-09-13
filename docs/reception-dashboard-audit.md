# Reception Dashboard Audit

Status: **audit only**. No application, API, model, or shared-component code was changed.

Labels used below:

- **CONFIRMED FROM CODE** — observed in the current repository
- **RECOMMENDED** — suggested for a later production Reception Dashboard; not implemented
- **NEEDS HOSPITAL CONFIRMATION** — product/workflow decision, not implied by code

Related pages (not this home page): Add Patient, Patients list, stay billing (`/reception/patient/:id`), Pending Approvals, Pending Discharges, Discharged.

---

## 1. Current Dashboard

**CONFIRMED FROM CODE**

| Item | Location |
| --- | --- |
| Page | `frontend/src/pages/reception/ReceptionDashboard.jsx` |
| Route | `/reception` (index under `RequireAuth role="reception"`) |
| Layout | `AppLayout role="reception"` |
| Sidebar | Dashboard, Patients, Add Patient, Pending Approvals, Pending Discharges, Discharged |
| Hook | **None.** Uses `usePatients()` + `useServiceEntries()` + `useAuth()` |
| Dedicated API | **None.** There is no `GET /api/reception/dashboard` |

The page does **not** import `DashboardChrome`. It uses `PageHeader`, `StatCard`, `DataTable`, and embeds `PendingApprovalsPanel`.

Night Reception (`accessRole: Reception`) also lands on this page.

### Header

- Title: “Reception Dashboard”
- Description: “Manage admitted patients, approve nurse records, and process billing”
- Action: **Add Patient** → `/reception/add-patient` if `admissions.create`

### Stat cards (`StatCard`)

| Card | Value | Source type |
| --- | --- | --- |
| Total Admitted Patients | `patients.filter(status === 'admitted').length` | Derived from shared full patient list |
| Pending Approvals | `getPendingCount()` | Derived from hospital-wide records list |
| Today's Deposits | `todayDeposits` from `mockData.js` (`125000`) | **Fake** |
| Patients with Low Balance | `getBalanceStatus(p) !== 'sufficient'` | Derived; subtitle says “Below threshold” |
| Pending Discharges | `patients.filter(status === 'pending-discharge').length` | Derived; card click → `/reception/pending-discharges` |

Today’s Deposits also shows a hardcoded trend: **“12% vs yesterday”**.

### Pending Records panel

- `PendingApprovalsPanel` from `PendingApprovals.jsx`, `limit={4}`
- **Returns `null` when there are zero pending records** — the queue disappears instead of showing an empty state
- Approve / reject call real record APIs
- **View All** → `/reception/approvals` (that page is gated `admissions.edit` or `patients.edit`)
- Dashboard itself does **not** hide Approve buttons for Night Reception

### Admitted Patients table

- Title: “Admitted Patients”
- Data: **`patients` (all loaded inpatients)**, not `admittedPatients`
- So **pending-discharge** rows appear under “Admitted Patients”
- Columns: ID, name, room/bed, admission date, deposit, approved charges, remaining balance (+ pending charges note), **balance StatusBadge** (sufficient / low / critical — not stay status), View
- `MoreHorizontal` button does nothing
- Row click / View → `/reception/patient/:id` (existing Reception stay page)
- **View All** → `/reception/patients`

### Fake / demo values on this page

| Item | Classification |
| --- | --- |
| `todayDeposits = 125000` | **Hardcoded** (`frontend/src/data/mockData.js`) |
| “12% vs yesterday” | **Hardcoded** |
| “Below threshold” | **Misleading.** `sufficient` is `remaining >= threshold * 2` (same 2× rule as Manager watchlist) |
| Offline mock patients | If `VITE_USE_API=false`, contexts use `mockData`. Default app mode uses the API |

---

## 2. Current Data Flow

**CONFIRMED FROM CODE**

There is no Reception-specific aggregate.

```
Login
  → AuthContext (JWT)
  → PatientsProvider.refreshFromApi
       GET /api/patients?view=full
       GET /api/patients/discharged   (loaded for all roles; unused on this home page)
  → ServiceEntriesProvider.refreshRecords
       GET /api/records               (hospital-wide; patients.view)
  → BillingConfigContext
       GET /api/settings              (lowBalanceThreshold)
  → ReceptionDashboard
       filters / counts in the browser
       todayDeposits from mockData (never from Deposit)
```

`GET /api/patients?view=full` already hydrates patients, deposits, rooms, and assignments for the **entire** inpatient set. The dashboard then walks every patient and every record in JS to compute balances.

Approve/reject from the embedded panel:

- `POST /api/records/:id/approve`
- `POST /api/records/:id/reject`
- Gate: `admissions.edit` **or** `patients.edit`

Navbar (Reception only) also reads `getPendingCount()` and in-memory notifications from `ServiceEntriesContext`.

---

## 3. Reception Job vs This Page

**CONFIRMED FROM CODE** — Reception’s existing product surface is:

1. Admit (`/reception/add-patient`)
2. Open stays and take deposits / bill (`/reception/patient/:id`)
3. Approve or reject nurse records (`/reception/approvals`)
4. Clear pending discharge (`/reception/pending-discharges`)
5. Look up discharged stays (`/reception/discharged`)

The home page is a **front-desk work queue + cash snapshot**, not Admin setup, not Nurse charting, not Manager reports.

**RECOMMENDED** later responsibility for a production Reception Dashboard:

- Today’s admissions and today’s deposits (real `Deposit` + local dates)
- Pending record approvals (count + short list)
- Pending discharges (count + short list)
- Current admitted census (not merged with pending-discharge)
- Optional low-balance attention using the **existing** threshold rule, labeled honestly
- Shortcuts: Add Patient, Approvals, Pending Discharges, Patients
- Do **not** become a second Manager executive finance page
- Do **not** become a Nurse ward board
- Do **not** invent occupancy/staffed-bed rules here

---

## 4. Authorization

**CONFIRMED FROM CODE**

| Surface | Gate |
| --- | --- |
| SPA `/reception` index | `RequireAuth role="reception"` only — **not** permission-gated |
| Patients / stay / discharged | `patients.view` |
| Add Patient | `admissions.create` |
| Approvals page | `admissions.edit` or `patients.edit` |
| Pending Discharges page | `admissions.discharge` |
| `GET /api/patients?view=full` | `patients.view` |
| `GET /api/records` | `patients.view` |
| Approve / reject record | `admissions.edit` or `patients.edit` |

Seeded **Reception** permissions include patients, admissions, rooms, doctors, payments, and credit. They do **not** include `reports.view`.

Seeded **Night Reception** is narrower: view/create patients, view/create admissions, view rooms, assign beds. **No** `payments.view`, **no** `admissions.edit`, **no** `admissions.discharge`, **no** `credit.view`.

Night Reception still opens this dashboard and currently sees:

- Fake today’s deposits
- Balance / deposit columns
- Approve buttons (API will 403)
- Pending-discharge card that navigates to a route they cannot open

Super Admin uses `/admin`, not this page.

---

## 5. Census and List Semantics

**CONFIRMED FROM CODE**

| Metric | Current |
| --- | --- |
| Admitted card | `status === 'admitted'` only — **correct** |
| Pending discharge card | `status === 'pending-discharge'` — **correct** |
| Table titled “Admitted Patients” | all `patients` from the full view — **includes pending-discharge** |

Admin / Nurse / Manager production dashboards split admitted vs pending-discharge. Reception’s **card** already does; the **table title does not**.

Discharged stays are not on this list (full view excludes them). `GET /api/patients/discharged` is still fetched globally.

---

## 6. Money on the Home Page

**CONFIRMED FROM CODE**

| Field | Meaning |
| --- | --- |
| Today’s deposits card | **Not** from `Deposit`. Constant `125000` |
| Table deposit | `patient.deposit` from the full patient payload |
| Approved charges | Sum of approved records in context |
| Remaining | `deposit − approved charges` |
| Pending line under remaining | Sum of pending **daily_services** records only |
| Low-balance card | `remaining < threshold * 2` (`sufficient` starts at 2×) |

`Deposit` documents exist and Admin/Manager already sum today’s deposits with `todayStr()` (local calendar). Reception home does not use that.

**NEEDS HOSPITAL CONFIRMATION**

- Whether Reception home should show remaining balances at all, or only counts + names + room
- Whether “low balance” on Reception should stay as 2× threshold or match a stricter “below threshold” label
- Whether Night Reception should see any money

**RECOMMENDED:** if money is shown, gate deposits with `payments.view` and balances/credit flags with `credit.view`; omit sections rather than zeros. Use local dates. Never show a fake trend.

---

## 7. Performance

**CONFIRMED FROM CODE**

On every login, Reception (and every other role) loads:

- All current inpatients (`view=full`) plus deposits/assignments/rooms
- All discharged patients
- All service records

The dashboard then filters in the browser. That is heavier than Admin/Nurse/Manager dedicated dashboard endpoints (`countDocuments` / `$group`).

A later `GET /api/reception/dashboard` should use the same pattern: counts, limited pending lists, today’s deposit sum — not another full-collection dump.

---

## 8. Loading, Error, Chrome

**CONFIRMED FROM CODE**

- No dashboard-level loading skeleton
- Context failures `.catch(console.error)` → empty lists, not a Retry panel
- No 403-specific copy
- No `generatedAt` / Sync
- `StatCard` icon wells — not `DashboardChrome`

---

## 9. Existing Routes to Reuse (do not invent)

**CONFIRMED FROM CODE**

| Action | Existing path |
| --- | --- |
| Add Patient | `/reception/add-patient` |
| Patients | `/reception/patients` |
| Stay / billing | `/reception/patient/:id` |
| Pending Approvals | `/reception/approvals` |
| Pending Discharges | `/reception/pending-discharges` |
| Discharged | `/reception/discharged` |

Do not add a Manager-style reports route or a Nurse-style service-entry route for Reception.

---

## 10. Recommended Later Architecture (not implemented)

Follow Admin / Nurse / Manager:

```
GET /api/reception/dashboard
  → authRequired
  → existing permission(s) — likely patients.view or admissions.view
  → receptionDashboard service
  → permission-aware payload
```

Suggested payload shape (omit keys the caller cannot see):

- `census`: admitted, pendingDischarge, admittedToday (local date)
- `workQueue`: pendingApprovals, pendingDischarges
- `finance.deposits.today` only if `payments.view` (real `Deposit` aggregation)
- `watchlist` only if `credit.view`, honest 2×-threshold label
- `pendingRecords`: short list (id, patient, type, status, recordedAt) — approve stays on `/reception/approvals` or keep existing approve APIs
- `currentInpatients`: limited admitted rows; include money only if permitted
- `generatedAt`

Reuse `todayStr()` / `localDayRange()`. Do not use UTC date slicing. Do not add models. Do not invent revenue. Do not copy Manager charts or Admin catalog.

SPA: `useReceptionDashboard` with `data / loading / error / reload`, no mock finance, then a later `DashboardChrome` pass.

---

## 11. What Not to Do

- Do not keep `todayDeposits` or “12% vs yesterday”
- Do not merge pending-discharge into “Admitted”
- Do not load all records/patients only to count pending
- Do not show Night Reception approve/deposit UI that the API will reject
- Do not modify Admin, Nurse, Manager, or `DashboardChrome` for this work
- Do not invent occupancy, aging, or payment-method KPIs

---

## 12. Open Product Questions

**NEEDS HOSPITAL CONFIRMATION**

1. Is Reception home a **queue** (approvals + discharges + today’s admits) or a **mini billing board** (balances on every row)?
2. Should Night Reception get a reduced dashboard (census + admit only)?
3. Keep the existing 2× low-balance rule, or only flag stays below `lowBalanceThreshold`?
4. Approve from the home page, or only count + link to `/reception/approvals`?

Until those are answered, the least misleading production default is: real counts, real today’s deposits if `payments.view`, split census, short queues with links to existing pages, no fake trends.
