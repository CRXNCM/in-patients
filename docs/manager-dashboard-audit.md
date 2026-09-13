# Manager Dashboard Audit

Status: **audit only**. No application, API, model, or shared-component code was changed.

Labels used below:

- **CONFIRMED FROM CODE** — observed in the current repository
- **RECOMMENDED** — suggested for a later production Manager Dashboard; not implemented
- **NEEDS HOSPITAL CONFIRMATION** — product/finance decision, not implied by code

Related pages (not this home page): `frontend/src/pages/manager/ReportsPage.jsx` uses the same `buildDashboardData()` plus extra deposit/bed queries.

---

## 1. Current Dashboard

**CONFIRMED FROM CODE**

| Item | Location |
| --- | --- |
| Page | `frontend/src/pages/manager/ManagerDashboard.jsx` |
| Route | `/manager` (index under `RequireAuth role="manager"`) |
| Layout | `AppLayout role="manager"` |
| Sidebar | Dashboard (`/manager`), Reports (`/manager/reports`, gated `reports.view`) |
| Hook | `frontend/src/hooks/useManagerDashboard.js` |
| API | `GET /api/manager/dashboard` |

The page does **not** import `DashboardChrome`. It uses `PageHeader`, `StatCard`, `DataTable`, and Recharts.

### Header

- Title: “Executive Dashboard”
- Description: “Financial overview and hospital performance metrics”
- No refresh / retry / “View reports” action

### Stat cards (`StatCard`)

| Card | Value | Source type |
| --- | --- | --- |
| Today's Revenue | `stats.todayRevenue` | API (or hardcoded `59500` if `USE_API=false`) |
| Monthly Revenue | `stats.monthlyRevenue` | API (or hardcoded `1203000` offline) |
| Total Deposits | `stats.totalDeposits` | API: sum of `Patient.depositTotal` on non-discharged stays |
| Outstanding Balance | `stats.outstandingBalance` | API: sum of `max(0, charges − deposits)` per inpatient |
| Current Inpatients | `stats.inpatientCount` | API: `Patient` with `status !== 'discharged'` |
| Near Low Balance | `stats.nearLowBalance` | API: remaining credit `< threshold * 2` |

Not shown on the page though the API returns them: `stats.todayDeposits`, `stats.occupancyRate`.

### Charts and lists

| Section | Data | Notes |
| --- | --- | --- |
| Revenue by Department | `revenueByDepartment` | Bar chart. Axis is service **category** (`line.category`), not `Department`. |
| Daily Revenue Trend | `dailyRevenueTrend` | Line chart, last 7 calendar days (UTC in builder). |
| Top Services Used | `topServices` (top 5 by revenue) | Approved non-return lines |
| Top Medicines Used | `topMedicines` (top 5 by count) | Lines with `category === 'Pharmacy'` |
| Recent Transactions | `recentPatients` (10) | Deposit + remaining (`deposit − charges`). No row click. |

### Fake / demo values

| Item | Classification |
| --- | --- |
| `todayRevenue: 59500`, `monthlyRevenue: 1203000` | **Hardcoded** in `useManagerDashboard` when `VITE_USE_API=false` |
| `mockRevenueByDept`, `mockDailyTrend`, `mockTopServices`, `mockTopMedicines` | Offline charts only |
| Chart `COLORS` | Presentation only |
| Default hospital name `'Central City Hospital'` | Server fallback if settings missing |

Default app mode (`VITE_USE_API !== 'false'`) uses the live API and does **not** inject those mock revenues on success.

---

## 2. Current Data Flow

**CONFIRMED FROM CODE**

```
Login (accessRole Manager)
  → AuthContext
  → PatientsProvider + ServiceEntriesProvider still load for every role
       GET /api/patients?view=full   (unused by ManagerDashboard)
       GET /api/patients/discharged
       GET /api/records
  → ManagerDashboard
       useManagerDashboard
         GET /api/manager/dashboard
```

| Layer | File |
| --- | --- |
| Page | `ManagerDashboard.jsx` |
| Client | `api.getManagerDashboard()` |
| Hook | `useManagerDashboard.js` |
| Route | `server/routes/manager.routes.js` — `buildDashboardData()` **inline** (no `services/managerDashboard.js`) |
| Queries | `Patient.find({ status: { $ne: 'discharged' } })`, `Deposit.find()`, `ServiceRecord.find({ status: 'approved' })`, `Bed.find()`, `HospitalSettings.findOne`, then **per inpatient** `calcPatientBalance` |

**Freshness:** the hook’s `useEffect` depends on `[patients, records, settings]`. Context updates re-call the manager API. There is no interval refresh, no Retry, and no `generatedAt` display.

**Duplicate work (CONFIRMED):** a Manager session still downloads the full clinical/finance list payload, then separately rebuilds finance aggregates on the server.

---

## 3. Current API Response

**CONFIRMED FROM CODE** — `GET /api/manager/dashboard`

Auth in code: `authRequired` + `requirePermission('reports.view')`.  
Super Admin still passes via `roleHasAllPermissions` / slug bypass.

**Stale docs:** `docs/API_REFERENCE.md` and `docs/AUTHENTICATION.md` still say “role Manager or Admin”. The route does **not** call `requireRole`.

```json
{
  "stats": {
    "todayRevenue": 0,
    "monthlyRevenue": 0,
    "totalDeposits": 0,
    "outstandingBalance": 0,
    "inpatientCount": 0,
    "nearLowBalance": 0,
    "todayDeposits": 0,
    "occupancyRate": 0
  },
  "revenueByDepartment": [{ "name": "Pharmacy", "revenue": 0 }],
  "dailyRevenueTrend": [{ "day": "Thu", "date": "2026-09-10", "revenue": 0 }],
  "topServices": [{ "name": "...", "count": 1, "revenue": 0 }],
  "topMedicines": [{ "name": "...", "count": 1, "revenue": 0 }],
  "recentPatients": [{
    "id": "PAT-001",
    "name": "...",
    "deposit": 0,
    "balance": 0,
    "admissionDate": "...",
    "room": "...",
    "bed": "..."
  }],
  "hospitalName": "Central City Hospital"
}
```

### How numbers are built (CONFIRMED)

| Field | Rule |
| --- | --- |
| `today` / month / 7-day dates | Local `todayStr()` in **this file** = `new Date().toISOString().slice(0, 10)` (**UTC**, not `server/utils/dates.js`) |
| `todayRevenue` / `monthlyRevenue` / daily trend `revenue` | **Deposits for that day/month + approved charge totals** (returns subtract) |
| `totalDeposits` | Sum of stored `depositTotal` on non-discharged patients (not all-time `Deposit` collection) |
| `outstandingBalance` | `max(0, totalCharges − depositTotal)` after `calcPatientBalance` |
| `inpatientCount` | All `status !== 'discharged'` (includes `pending-discharge`) |
| `nearLowBalance` | `depositTotal − totalCharges < lowBalanceThreshold * 2` (default threshold 3000 → remaining &lt; 6000) |
| `occupancyRate` | `round(100 * occupiedBeds / all Bed documents)` |
| `revenueByDepartment` | Sum of approved service **line.category** |
| `topMedicines` | Same approved lines where `category === 'Pharmacy'` |
| `recentPatients.balance` | `depositTotal − totalCharges` (can be negative) |

`calcPatientBalance` re-queries approved records and the Patient for **each** inpatient (`autoCharges.js`).

### Fields useful to a manager (RECOMMENDED filter of what exists)

Useful: cash collected (deposits), billed approved charges, outstanding, census split, occupancy, aging/low-balance, category mix, recent stays with money.

Less useful / misleading as currently labeled: “Revenue” that sums deposits **and** charges; “Department” that is a billing category; occupancy computed but hidden; inpatient count that mixes pending-discharge.

---

## 4. Current Permissions

**CONFIRMED FROM CODE**

### Frontend `/manager`

- `RequireAuth role="manager"` (`user.roleKey === 'manager'` / `accessRole` Manager).
- Dashboard **index is not** `RequirePermission reports.view`.
- Sidebar Reports **is** `reports.view`.
- Finance custom role (`accessRole: Manager`) uses this same shell (`docs/dashboard-backend-audit.md`).

### Backend

| Action | Gate |
| --- | --- |
| `GET /api/manager/dashboard` | `reports.view` |
| `GET /api/manager/reports/:type` | `reports.view` |
| Super Admin | All keys via slug |

An Admin JWT **can** call the manager API if the role has `reports.view` (seeded Admin has all keys). The Admin SPA cannot open `/manager` because of `RequireAuth`.

A Manager-shell user **without** `reports.view` still sees `/manager`, then the hook 403s and the page stays on “Loading dashboard...”.

### Seeded Manager keys (`MANAGER_PERMISSIONS`)

`patients.view`, `admissions.view`, `payments.view`, `credit.view`, `reports.view`, `reports.export`

The dashboard API does **not** omit finance if `payments.view` / `credit.view` are missing. One key (`reports.view`) unlocks the entire money payload.

---

## 5. Existing Manager Workflows

**CONFIRMED FROM CODE** — what exists, not what would be nice.

| Workflow | Exists? | Where |
| --- | --- | --- |
| Executive finance home | Yes | `/manager` |
| Print/export reports | Yes | `/manager/reports` → `GET /api/manager/reports/:type` |
| Admit / discharge / record services | No | Reception / Nurse |
| Approve billing records | No | Reception |
| Hospital setup / users / catalog | No | Admin |
| Credit ledger UI | No dedicated Manager page (`credit.view` unused on this dashboard) |
| Occupancy as a home widget | Computed only; shown on occupancy **report** |
| DashboardChrome / command-overview look | No |

Reports reuse `buildDashboardData()` for most types. Known report bugs in the same builder: **annual** summary uses **monthly** revenue; **outstanding** uses `recentPatients` (only 10 newest stays) not all debtors; **daily** rows are recent inpatients, not today’s movements.

---

## 6. Real Problems / Risks

**CONFIRMED FROM CODE**

1. **Revenue definition** — deposits + approved charges for the same period can **double-count** cash vs billed activity. Hospital finance meaning is unstated.
2. **UTC “today”** — manager `todayStr()` / 7-day loop use `toISOString().slice(0, 10)`. Admin/Nurse use local `utils/dates.js`. Ethiopia UTC+3 can shift “today” and the trend.
3. **N+1 + full collections** — all deposits, all approved records, all beds, all inpatients, plus 2 queries per inpatient in `calcPatientBalance`. Opposite of Admin’s `countDocuments` + `limit`.
4. **No error / Retry** — API failure: `catch(console.error)`, `data` stays `null`, UI stuck on loading. Offline mock only when `USE_API=false`.
5. **403 looks like hang** — dashboard route not permission-gated.
6. **Census** — `inpatientCount` includes `pending-discharge`. Admin/Nurse now split those.
7. **“Department” label is wrong** — service categories, not `Department` documents.
8. **`nearLowBalance`** — remaining &lt; `2 × threshold`, not “below threshold”. Easy to over-count.
9. **Hidden occupancy** — Admin occupancy denominator includes maintenance/out-of-service; Manager uses the same all-beds ratio but does not display it.
10. **`formatDate(admissionDate)`** — `YYYY-MM-DD` can show the previous local day.
11. **Reports inherit the same builder** — fixing only the UI will not fix printed numbers.
12. **Docs lie** about role-only auth on the manager API.
13. **No Manager dashboard tests** (unlike Admin/Nurse aggregates).
14. **Global contexts** still load `view=full` deposits for Managers who already have a finance API.

---

## 7. Useful Existing Data

**CONFIRMED FROM CODE**

- `Deposit.date` + `amount` (operational cash day)
- Approved `ServiceRecord` lines (`total`, `category`, `serviceName`, `quantity`, `date`)
- `Patient.status`, `admissionDate`, `depositTotal`, `isCreditPatient`
- `calcPatientBalance` / `computeCreditState`
- `Bed.status` for occupancy
- `HospitalSettings.lowBalanceThreshold`
- `todayStr()` / `localDayRange()` already used correctly by Admin
- Manager already has `reports.view` as a dedicated finance gate

---

## 8. Missing Data

**CONFIRMED FROM CODE** (no such source on this dashboard):

- True hospital-department revenue (would need mapping category → `Department`, which does not exist)
- Cash vs billed vs collected split
- Credit-admission count (`credit.view` unused here)
- Aging buckets (30/60/90)
- Payer / payment-method mix on the home page (deposits have `method`; unused)
- Discharged-today / admitted-today (Admin has these)
- Dedicated Manager tests or `generatedAt`

**NEEDS HOSPITAL CONFIRMATION** whether those belong on Manager at all.

---

## 9. Recommended Manager Dashboard Responsibilities

Think of the manager as **executive finance + utilization**, not ward recording or hospital setup.

**RECOMMENDED** (only using data that already exists):

1. Honest **cash** (deposits by local day/month) separate from **billed** (approved charges).
2. Outstanding and low-balance using one documented formula.
3. Census: admitted vs pending-discharge (same semantics as Admin/Nurse).
4. Optional occupancy if the hospital wants utilization on this home (already computed).
5. Category mix and top lines as “billing categories”, not “departments”, until a mapping exists.
6. Short list of inpatients with deposit/remaining — link only if a Manager stay route exists (it does **not** today).
7. Entry to Reports (already exists).

**NEEDS HOSPITAL CONFIRMATION**

- What “revenue” means (cash, accrual, or both).
- Whether Managers should open patient billing (no `/manager/patient/:id`).
- Whether occupancy belongs on the executive home or only on the occupancy report.

---

## 10. What Should NOT Be On Manager Dashboard

**RECOMMENDED**

- Nurse work queues, `CURRENT_NURSE`, clinical vitals
- Admin setup/catalog/user counts (already on Admin)
- Invented YoY / “12% vs yesterday”
- Mock `59500` / `1203000` in live mode (already avoided)
- Credit flags unless `credit.view` is required and the hospital wants them
- A second copy of Admin occupancy-as-inventory unless product asks

**CONFIRMED** the page already shows money; that is appropriate **if** `reports.view` is the intended finance gate.

---

## 11. Recommended Dashboard Information Hierarchy

**RECOMMENDED**

1. **Fold — money (honest labels)** — deposits today/month, approved charges today/month, outstanding. Not one blended “Revenue” until confirmed.
2. **Census / utilization** — admitted, pending-discharge, optional occupancy ring (Admin chrome later).
3. **Mix** — category bars + 7-day trend using **local** dates and one definition.
4. **Watch list** — low-balance / credit stays (permission-aware).
5. **Reports** link.

Do **not** copy Admin’s setup/catalog row or Nurse’s “my submissions”.

---

## 12. Recommended API Changes

**RECOMMENDED**

- Extract `buildDashboardData` to `server/services/managerDashboard.js` (Admin/Nurse pattern) + HTTP/unit tests.
- Use `todayStr()` / `localDayRange()` from `utils/dates.js`; delete the UTC helper in the route file.
- Database-side `$match` / `$sum` / `$group` for deposits and approved records; stop loading entire collections.
- Replace per-patient `calcPatientBalance` with one aggregation (or accept approximate stored `depositTotal` + one records `$group`).
- Split `census.admitted` vs `pendingDischarge`.
- Split `finance.deposits` vs `finance.approvedCharges`; keep blended `revenue` only if the hospital confirms.
- Rename `revenueByDepartment` → `revenueByCategory` (or add a real department mapping later).
- Optionally omit money unless `payments.view` / `credit.view` (like Admin section omission). **NEEDS HOSPITAL CONFIRMATION** — today `reports.view` alone is enough.
- Do **not** reuse Admin or Nurse payloads.

**NEEDS HOSPITAL CONFIRMATION** before adding indexes (`Deposit.date`, `ServiceRecord.status + date`).

---

## 13. Recommended Frontend Changes

**RECOMMENDED** (later; not this audit)

- Hook like `useAdminDashboard`: `error`, `reload`, **no mock fallback** when `USE_API` is true; `USE_API=false` shows an error.
- Gate `/manager` with `reports.view` or show Forbidden on 403 (not infinite loading).
- Honest labels; show occupancy only if product wants it.
- After visual approval, wrap with `DashboardChrome` — **do not** restyle in the audit.
- Stop depending on Patients/Records context for this page (contexts can stay for other roles).
- Fix `formatDate` for `YYYY-MM-DD` (noon-local, as Nurse/Admin stay dates).

Do **not** modify `DashboardChrome.jsx` or Admin/Nurse as part of Manager work unless a later step says so.

---

## 14. Open Business/Workflow Questions

**NEEDS HOSPITAL CONFIRMATION**

1. Is “revenue” cash collected, charges billed, or both?
2. Should pending-discharge count as “current inpatients”?
3. Is low-balance `threshold` or `2 × threshold`?
4. Should occupancy use all beds (current) or staffed/available only?
5. Should `reports.view` remain the only API gate, or should payments/credit omit sections?
6. Should Managers open a patient financial record?
7. Are service categories acceptable as “departments” until mapping exists?
8. Should annual reports be real YTD, not this month’s number?
9. Should Finance custom roles keep this dashboard?
10. Should Manager home and Reports share one builder after it is corrected?

---

## Summary (most important findings)

1. Manager **already has** a dedicated aggregate API — unlike the old Nurse mash-up — but the builder is a **full-collection + N+1** job inside the route file, not an Admin-style service.
2. **“Revenue” mixes deposits and approved charges** and uses **UTC calendar days**, so ETB totals and “today” can be wrong.
3. **“Revenue by Department” is billing category**, not hospital departments.
4. **Failed loads never surface** — 403/500 look like endless loading. Offline mock money still exists for `USE_API=false`.
5. **Census and low-balance rules differ** from Admin/Nurse and from the card copy.
6. Seeded Managers also pull **`view=full` ledgers** they do not use on this page.
7. For production, **reuse Admin architecture** (service module, local dates, Mongo aggregations, hook with Retry, no mock fallback, tests). **Keep** finance as the Manager job. **Do not copy** Admin setup/catalog or Nurse ward queues. **Do not invent** department P&amp;L until a mapping exists.

STOP. No code was changed.
