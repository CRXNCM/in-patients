# Dashboard Backend Connectivity Audit

Audit date: 2026-09-12  
Scope: frontend dashboards and the APIs they consume. No application code was changed.

Default runtime: `VITE_USE_API` is not `false`, so the app is intended to use `http://localhost:5000`. Offline/mock branches exist in several providers and are noted where they affect dashboards.

## Summary

Total dashboards found: **4** role home dashboards  
(Embedded panel counted under Reception, not as a fifth route.)

| Status | Count |
| --- | --- |
| Connected | 1 |
| Partially connected | 2 |
| Mock/static | 1 |
| Broken | 0 |
| Unknown | 0 |

There is **no** Super Admin, Doctor, or Finance dashboard route. Those roles reuse existing access shells:

- Super Admin / Admin → `/admin` (Admin Dashboard)
- Night Reception → `/reception` (Reception Dashboard)
- Doctor role (`accessRole: Nurse`) → `/nurse` (Nurse Dashboard)
- Finance role (`accessRole: Manager`) → `/manager` (Executive Dashboard)

Related but **not** counted as dashboards: Manager Reports (`/manager/reports`), Admin Hospital Setup, Reception/Nurse patient lists.

## Dashboard-by-dashboard results

### Reception Dashboard

Route: `/reception`  
Main component: `frontend/src/pages/reception/ReceptionDashboard.jsx`  
Embedded: `PendingApprovalsPanel` in `frontend/src/pages/reception/PendingApprovals.jsx`  
Role: Reception (also Night Reception)

Status: **PARTIAL**

Backend endpoint(s):

- `GET /api/patients?view=full` — implemented, `patients.view`, queries `Patient`, `Deposit`, `RoomAssignment`, `Bed`, `DoctorAssignment`
- `GET /api/patients/discharged` — implemented, `patients.view`
- `GET /api/records` — implemented, `patients.view`, queries `ServiceRecord` + `Patient`
- `GET /api/settings` — used for low-balance threshold via `BillingConfigContext`
- `POST /api/records/:id/approve` and `POST /api/records/:id/reject` — used by the embedded pending panel

Frontend service/hook: `PatientsContext.refreshFromApi`, `ServiceEntriesContext.refreshRecords`, `useAuth().hasPermission`  
Backend controller: `server/routes/patients.routes.js`, `server/routes/records.routes.js`  
Database model(s): `Patient`, `ServiceRecord`, `Deposit`, `HospitalSettings` (threshold)

Real data:

- Total Admitted Patients — calculated from `patients.filter(status === 'admitted')` after API load
- Pending Approvals — `getPendingCount()` over API-loaded `ServiceRecord` rows
- Patients with Low Balance — calculated from API patients + API/approved charges vs threshold
- Pending Discharges — `patients.filter(status === 'pending-discharge')`
- Admitted Patients table — API patients (table actually uses full `patients` list, including pending-discharge)
- Pending Records panel — API pending records; approve/reject hit real endpoints
- Charge/balance columns — calculated from approved API records

Mock/static data:

- **Today's Deposits** — `todayDeposits` constant `125000` from `frontend/src/data/mockData.js`
- Trend text **“12% vs yesterday”** — hardcoded on the StatCard
- Hospital name in sidebar — `hospitalSettings.name` from mock (`Central City Hospital`) unless a later settings merge is used elsewhere

Problems:

- Today’s deposits are never read from `Deposit` even though the manager API already computes `todayDeposits` from the database.
- Fake growth percentage is shown as if it were a real comparison.
- Patient list on the dashboard is `patients`, not `admittedPatients`, so pending-discharge rows appear under “Admitted Patients”.
- No dedicated dashboard error UI: patient/record load failures log to console and leave empty arrays (empty, not fake).
- Contexts load once on login; admitting a patient updates local state via `addPatient`, so this dashboard usually updates without a full refetch. Deposits collected today still would not change the deposits card because that card is static.

Evidence:

- `ReceptionDashboard.jsx` imports `todayDeposits` and passes `trend={{ positive: true, value: '12% vs yesterday' }}`
- `mockData.js` `export const todayDeposits = 125000`
- `PatientsContext.jsx` `refreshFromApi` → `api.getPatientsFull()`
- `ServiceEntriesContext.jsx` `refreshRecords` → `api.getRecords()`

---

### Nurse Dashboard

Route: `/nurse`  
Main component: `frontend/src/pages/nurse/NurseDashboard.jsx`  
Role: Nurse (also any custom role with `accessRole: Nurse`, including the placeholder Doctor role)

Status: **PARTIAL**

Backend endpoint(s):

- `GET /api/patients?view=full` — same as Reception
- `GET /api/records` — `patients.view`

Frontend service/hook: `usePatients()`, `useServiceEntries()`  
Backend controller: `patients.routes.js`, `records.routes.js`  
Database model(s): `Patient`, `ServiceRecord`

Real data:

- Admitted Patients count — `patients.length` from API (all non-discharged, not nurse-assigned)
- Hospital Pending Queue — pending API records
- Recent Activity count and Recent Records list — latest API records
- Admitted Patients table (first 5) — API patients
- Per-row record counts — calculated from API records

Mock/static / incomplete:

- **My Pending Records** filters `recordedBy === CURRENT_NURSE` where `CURRENT_NURSE` is the hardcoded string `'Nurse Almaz Tsegaye'` in `ServiceEntriesContext.jsx`
- Subtitle “Under your care” is not backed by an assignment query; nurses see every admitted patient the `patients.view` API returns
- `GET /api/records` is hospital-wide; there is no nurse-scoped records endpoint

Problems:

- A nurse who is not named exactly “Nurse Almaz Tsegaye” will usually see **0** for “My Pending Records” even when they have pending work (`submittedBy` on the server is `req.user.name`).
- No loading/error state on this page.
- Data freshness: loaded at login via context; local record submit updates context. No interval refresh.

Evidence:

- `NurseDashboard.jsx` uses `CURRENT_NURSE` from `useServiceEntries()`
- `ServiceEntriesContext.jsx` `const CURRENT_NURSE = 'Nurse Almaz Tsegaye'`
- Record create sets `submittedBy: req.user.name` in `patients.routes.js`

---

### Admin Dashboard

Route: `/admin`  
Main component: `frontend/src/pages/admin/AdminDashboard.jsx`  
Role: Admin / Super Admin (`accessRole: Admin`)

Status: **MOCK**

Backend endpoint(s): **none**  
Frontend service/hook: none  
Backend controller: none  
Database model(s): none used by this page

Real data: none

Mock/static data (all from `frontend/src/data/mockData.js`):

- Total Services — `services.length` (10 fake catalog items)
- Active service count — mock `status === 'active'`
- Total Medicines — `medicines.length` (8 fake rows, including stock statuses)
- Active Users — mock `users` (4 demo accounts)
- Departments — mock billing-style departments (`Laboratory`, `Pharmacy`, `Radiology`, …) with invented `staff` and `services` counts
- Recent Services list — first 5 mock services with prices
- Department Overview — first 5 mock departments (`12 staff · 45 services`, etc.)

Problems:

- Looks like a live hospital overview but never calls `/api/departments`, `/api/users`, `/api/categories`, or settings.
- Mock “departments” are billing categories, not the seeded hospital departments (Internal Medicine, Surgery, Obstetrics & Gynecology, etc.).
- User counts ignore real RBAC users.
- No loading/error/empty states because nothing is fetched.
- Does not update after Hospital Setup or User Management changes.

Evidence:

- `AdminDashboard.jsx` imports `{ services, medicines, users, departments } from '@/data/mockData'`
- Contrast: `DepartmentsPage.jsx` and `UsersPage.jsx` do call real APIs, but the home dashboard does not.

---

### Manager / Executive Dashboard

Route: `/manager`  
Main component: `frontend/src/pages/manager/ManagerDashboard.jsx`  
Hook: `frontend/src/hooks/useManagerDashboard.js`  
Role: Manager (also Finance custom role → Manager shell)

Status: **CONNECTED**

Backend endpoint(s):

- `GET /api/manager/dashboard` — implemented  
  Auth: `authRequired` + `requirePermission('reports.view')`  
  Handler: `buildDashboardData()` in `server/routes/manager.routes.js`

Frontend service/hook: `useManagerDashboard` → `api.getManagerDashboard()`  
Backend controller: `manager.routes.js` `buildDashboardData`  
Database model(s): `Patient`, `Deposit`, `ServiceRecord`, `Bed`, `HospitalSettings` (+ `calcPatientBalance`)

Real data (when `USE_API` is true):

- Today's Revenue — today’s deposits + today’s approved charge totals
- Monthly Revenue — same formula for current calendar month
- Total Deposits — sum of `depositTotal` on non-discharged patients
- Outstanding Balance — calculated from live balances
- Current Inpatients — non-discharged patient count
- Near Low Balance — calculated vs `HospitalSettings.lowBalanceThreshold`
- Revenue by Department chart — approved service **category** totals (not `Department` collection)
- Daily Revenue Trend — last 7 days deposits + approved charges
- Top Services / Top Medicines — aggregated from approved `ServiceRecord` lines
- Recent Transactions table — latest admitted patients with deposit/balance

Mock/static data:

- Chart colors only (`COLORS` in the page)
- Offline branch in the hook (only if `USE_API` is false): hardcoded `todayRevenue: 59500`, `monthlyRevenue: 1203000`, plus `mockRevenueByDept`, `mockDailyTrend`, `mockTopServices`, `mockTopMedicines`

Problems:

- API failure: `.catch(console.error)` then `loading = false` with `data` still `null` → UI stays on **“Loading dashboard...”** forever. It does not inject fake numbers (good) but also has no error state.
- No refetch after admissions, deposits, or approvals. Opening the page once per session; `useEffect` deps include `patients`/`records`/`settings`, so a context update **re-requests** the manager API. If the manager never shares those mutations in-session, the dashboard can stay stale until reload.
- “Revenue by Department” is service-category revenue, not hospital `Department`/`Ward` revenue.
- `occupancyRate` is computed on the server but not shown on this dashboard.
- Revenue definition adds deposits and charges together; that can double-count cash movement vs billed activity. Report only — not changed.

Evidence:

- `client.js` `getManagerDashboard: () => apiFetch('/api/manager/dashboard')`
- `server.js` mounts `app.use('/api/manager', managerRoutes)`
- `manager.routes.js` `router.get('/dashboard', authRequired, requirePermission('reports.view'), ...)`

---

### Roles with no dedicated dashboard

| Role | Lands on | Notes |
| --- | --- | --- |
| Super Admin | Admin Dashboard | Same mock admin home |
| Night Reception | Reception Dashboard | Same partial reception home; APIs still require `patients.view` etc. |
| Doctor (custom) | Nurse Dashboard | No doctor-specific stats |
| Finance (custom) | Manager Dashboard | Uses `reports.view` if that permission is granted on the role |

## API Audit

| Endpoint | Used by dashboard | Implemented | Real DB | Protected | Connected | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `GET /api/patients?view=full` | Reception, Nurse | Yes | Yes | `patients.view` | Yes | Source of patient cards/tables |
| `GET /api/patients/discharged` | Context (not shown on dashboards) | Yes | Yes | `patients.view` | Yes | Loaded with patients, unused on home cards |
| `GET /api/records` | Reception, Nurse | Yes | Yes | `patients.view` | Yes | Pending counts, recent records, balances |
| `GET /api/records/pending` | Not used by dashboards | Yes | Yes | `admissions.edit` / `patients.edit` / `patients.view` | Unused | Context uses full records list instead |
| `POST /api/records/:id/approve` | Reception embedded panel | Yes | Yes | `admissions.edit` or `patients.edit` | Yes | |
| `POST /api/records/:id/reject` | Reception embedded panel | Yes | Yes | same | Yes | |
| `GET /api/settings` | Threshold for low-balance | Yes | Yes | settings permissions | Yes | Merge-over-mock in `BillingConfigContext` |
| `GET /api/manager/dashboard` | Manager | Yes | Yes | `reports.view` | Yes | Only dedicated dashboard API |
| `GET /api/manager/reports/:type` | Reports page, not home | Yes | Yes | `reports.view` | N/A | Not a dashboard |
| `GET /api/departments` | **Not** Admin Dashboard | Yes | Yes | `departments.view` | Unused by dashboard | Used by Hospital Setup |
| `GET /api/users` | **Not** Admin Dashboard | Yes | Yes | `users.view` | Unused by dashboard | Used by User Management |
| `GET /api/dashboard/stats` | None | **Does not exist** | — | — | — | Frontend never calls this |

No dashboard calls a missing route. The Admin home simply never calls the APIs that already exist.

## Mock Data Audit

Suspicious dashboard sources in `frontend/src/data/mockData.js`:

| Export | Used on dashboard | Classification |
| --- | --- | --- |
| `todayDeposits = 125000` | Reception “Today's Deposits” | **CRITICAL** fake finance stat |
| `services` (10 items) | Admin cards + Recent Services | Mock catalog |
| `medicines` (8 items) | Admin medicines card | Mock inventory |
| `users` (4 demo users) | Admin active users | Mock users |
| `departments` (8 billing depts + staff counts) | Admin department cards | Mock / wrong entity |
| `revenueByDepartment`, `dailyRevenueTrend`, `topServices`, `topMedicines` | Manager **offline** path only | Mock charts |
| Hardcoded `59500` / `1203000` | Manager **offline** path only | Fake revenue |
| `hospitalSettings` | Sidebar name; settings fallback | Config/demo remnant |
| `patients` / `initialDailyRecords` | Context fallback when `USE_API` is false | Offline demo |

Not dashboard data (configuration): `BILLING_TYPES`, `bedTypes` room-type labels, `depositTypes`.

Hardcoded identity (affects Nurse dashboard): `CURRENT_NURSE = 'Nurse Almaz Tsegaye'`.

## Role / RBAC notes

- Manager dashboard API is server-protected with `reports.view`. Night Reception cannot load finance stats unless that permission is added to their role.
- Reception/Nurse dashboards use the same patient and record list APIs as the rest of those modules. The backend does not return a reduced “dashboard DTO”; the UI filters client-side.
- A Night Reception user with `patients.view` receives the full admitted-patient list and all service records, including charge totals used for balances. That is existing list-API scope, not a separate leaky dashboard endpoint.
- Admin Dashboard shows mock user/department counts with no API; it does not leak live admin data, but it also does not respect live permissions for what it displays (it always shows the same fake numbers).

## Data freshness

| Dashboard | Load | Refresh | After mutations |
| --- | --- | --- | --- |
| Reception | On auth via Patients + Records contexts | No interval | Admit/approve usually updates context; deposits card never updates |
| Nurse | Same contexts | No interval | New records update context |
| Admin | Never | Never | Hospital Setup / Users changes do not appear |
| Manager | On mount (`getManagerDashboard`) | Re-fetch if `patients`/`records`/`settings` change | Stale until those deps change or the page remounts |

## Error / fallback behavior

| Dashboard | On API failure |
| --- | --- |
| Reception / Nurse | `catch(console.error)`; lists stay `[]`. **Does not** set fake 120 patients. |
| Admin | N/A (no API) |
| Manager | Stays on “Loading dashboard...”. **Does not** fall back to mock revenue when `USE_API` is true. |
| Billing settings | If settings fail, mock `hospitalSettings` (threshold 3000, hospital name) remain in context and can affect low-balance badges. |

## Priority

### CRITICAL

1. Admin Dashboard presents fake services, medicines, users, and department staffing as if they were live hospital statistics.
2. Reception Dashboard “Today's Deposits: ETB 125,000” plus “12% vs yesterday” is fabricated finance data on a production admission screen.

### HIGH

3. Nurse “My Pending Records” is keyed off a hardcoded demo nurse name.
4. Admin home is disconnected from APIs that already exist (`/api/departments`, `/api/users`, categories).
5. Manager dashboard has no error state if `/api/manager/dashboard` fails.

### MEDIUM

6. Manager and Reception/Nurse dashboards do not poll; manager may stay stale.
7. Reception table vs “Admitted” stat mismatch (includes pending-discharge).
8. Manager “department” charts are service categories, not hospital departments.
9. Settings fetch failure silently keeps mock hospital settings for balance thresholds.

### LOW

10. Sidebar/login hospital name still reads mock `hospitalSettings`.
11. Unused `GET /api/records/pending`.
12. Offline `USE_API=false` manager hook still contains hardcoded revenue.

## Recommended Fix Order

1. Replace Reception `todayDeposits` and the 12% trend with live deposit totals (manager builder already computes `todayDeposits`) or hide the card until a real number exists.
2. Rebuild Admin Dashboard cards from `/api/departments`, `/api/users`, and billing categories/settings. Stop importing `mockData` lists for those stats.
3. Bind Nurse “My Pending Records” to `req.user` / session user name (or a `submittedBy === currentUser.name` filter), not `CURRENT_NURSE`.
4. Add Manager dashboard error and empty states; optionally refetch on focus.
5. Align Reception admitted-table filter with the admitted stat.
6. Decide whether manager “department” means hospital `Department` or charge category; label or query accordingly.
7. Remove or gate remaining mock fallbacks so API failure cannot show demo hospital settings as real thresholds.

Do not implement these fixes in this audit.
