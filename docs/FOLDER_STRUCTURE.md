# Folder Structure

Related documents: [ARCHITECTURE.md](./ARCHITECTURE.md) · [MODULES.md](./MODULES.md) · [AI_CONTEXT.md](./AI_CONTEXT.md)

Only folders that exist in the repository are documented. There is no `controllers/`, `repositories/`, `dto/`, or `entities/` directory.

---

## Repository root

```
in-patients/
├── docs/                 Project documentation (this folder)
├── src/                  React SPA
├── server/               Express API
├── public/               Static assets copied by Vite
├── dist/                 Vite production build output
├── index.html            SPA HTML shell
├── package.json          Frontend package
├── vite.config.js        Vite + `@` alias
├── tailwind.config.js
├── postcss.config.js
├── jsconfig.json         `@/*` path mapping
├── BACKEND_TODO.txt      Historical backend checklist (all items marked done)
├── users.txt             Outdated demo-email list
└── README.md             Outdated mock-only product description
```

`dist/` is a build artifact, not a source of truth.

---

## `src/` — frontend application

**Purpose:** Browser UI, routing, client state, API client.  
**Relationships:** Consumes `/api/*`. Falls back to `src/data/mockData.js` when `VITE_USE_API=false`.

### `src/api/`

| | |
|-|-|
| **Purpose** | Single HTTP client |
| **Responsibilities** | Token storage key `medbill_token`, `apiFetch`, typed `api.*` helpers |
| **Important files** | `client.js` |
| **Relationships** | Used by all contexts and manager hooks |

### `src/context/`

| | |
|-|-|
| **Purpose** | Application state |
| **Responsibilities** | Auth session, patients/rooms/deposits, billing config, service records, theme, toasts |
| **Important files** | `AuthContext.jsx`, `PatientsContext.jsx`, `BillingConfigContext.jsx`, `ServiceEntriesContext.jsx`, `ThemeContext.jsx`, `ToastContext.jsx` |
| **Relationships** | Provider order is fixed in `App.jsx` |

### `src/pages/`

| Folder | Purpose |
|--------|---------|
| `pages/LoginPage.jsx` | Email/password login |
| `pages/reception/` | Dashboard, patients, add patient, approvals, billing |
| `pages/nurse/` | Dashboard, patients list, service entry |
| `pages/admin/` | Dashboard, catalog screens, settings |
| `pages/manager/` | Executive dashboard, reports |

**Relationships:** Mounted under `RequireAuth` + `AppLayout` in `App.jsx`.

### `src/components/auth/`

| | |
|-|-|
| **Purpose** | Route protection |
| **Important files** | `RequireAuth.jsx` |
| **Relationships** | Reads `useAuth()` |

### `src/components/layout/`

| | |
|-|-|
| **Purpose** | Authenticated chrome |
| **Important files** | `AppLayout.jsx`, `Sidebar.jsx`, `TopNav.jsx` |
| **Relationships** | Sidebar menus are hardcoded per role |

### `src/components/shared/`

| File | Responsibility |
|------|----------------|
| `CommonComponents.jsx` | StatCard, StatusBadge, DataTable (10-per-page), Pagination, PageHeader, EmptyState |
| `ServiceRecordBuilder.jsx` | Daily service + pharmacy return cart |
| `RecordTimeline.jsx` | Record history and detail dialog content |
| `RoomTransferPanel.jsx` | Transfer form + room history table |
| `DepositReceipt.jsx` | Printable deposit slip |
| `InvoicePreview.jsx` | Summary and detailed printable invoices |
| `HospitalLogo.jsx` | Branding |
| `ServiceTimeline.jsx` | Older timeline helper (still present) |

### `src/components/ui/`

Radix/shadcn primitives: button, input, dialog, alert-dialog, card, tabs, toast, select, switch, label, badge, avatar, separator.

### `src/hooks/`

| File | Purpose |
|------|---------|
| `useManagerDashboard.js` | Loads `/api/manager/dashboard` or builds mock KPIs |

No other custom hooks exist.

### `src/lib/`

| File | Purpose |
|------|---------|
| `utils.js` | `cn`, `formatCurrency` (en-ET / ETB), dates, badge helpers |
| `validation.js` | Client-side form rules |
| `printReport.js` | Manager print window + CSV export |

### `src/data/`

| File | Purpose |
|------|---------|
| `mockData.js` | Demo patients, rooms, users, categories, charts, admin catalog lists |

Used for mock mode **and** still imported by several live-API screens (login demo list, admin catalog, reception “Today’s Deposits”, invoice header defaults).

### `src/asset/`

`central_logo.png`, `background.png` (login).

---

## `server/` — backend application

```
server/
├── package.json
├── .env.example
└── src/
    ├── index.js
    ├── config/db.js
    ├── middleware/auth.js
    ├── models/
    ├── routes/
    ├── services/
    ├── scripts/seed.js
    └── utils/
```

### `server/src/config/`

| | |
|-|-|
| **Purpose** | Mongo connection |
| **Important files** | `db.js` (`mongoose.connect`, `strictQuery: true`) |

### `server/src/middleware/`

| | |
|-|-|
| **Purpose** | Authn/authz |
| **Important files** | `auth.js` — `authRequired`, `requireRole`, unused `attachUser` |

### `server/src/models/`

Mongoose schemas. There is no separate RoomType collection; room type is a string on `Bed`.

| File | Collection (default) |
|------|----------------------|
| `User.js` | users |
| `Patient.js` | patients |
| `Deposit.js` | deposits |
| `Bed.js` | beds |
| `RoomAssignment.js` | roomassignments |
| `ServiceRecord.js` | servicerecords |
| `ServiceCategory.js` | servicecategories |
| `HospitalSettings.js` | hospitalsettings |

Details: [DATABASE.md](./DATABASE.md).

### `server/src/routes/`

Express routers. These **are** the controllers.

| File | Mount |
|------|-------|
| `auth.routes.js` | `/api/auth` |
| `patients.routes.js` | `/api/patients` |
| `beds.routes.js` | `/api/beds` |
| `records.routes.js` | `/api/records` |
| `settings.routes.js` | `/api/settings` |
| `manager.routes.js` | `/api/manager` |

### `server/src/services/`

| File | Responsibility |
|------|----------------|
| `autoCharges.js` | Daily room/doctor upsert, doctor-visit disable, `calcPatientBalance` |

### `server/src/utils/`

| File | Responsibility |
|------|----------------|
| `validation.js` | Admit / deposit / transfer validators; `MIN_INITIAL_DEPOSIT` |
| `mappers.js` | Frontend DTO-like mapping |

### `server/src/scripts/`

| File | Responsibility |
|------|----------------|
| `seed.js` | Wipes collections and inserts demo users, beds, categories, settings, two patients |

---

## Frontend route map (current `App.jsx`)

| Path | Role | Page |
|------|------|------|
| `/login` | public | LoginPage |
| `/` | — | Redirect to `/login` |
| `/reception` | reception | ReceptionDashboard |
| `/reception/patients` | reception | PatientsList |
| `/reception/add-patient` | reception | AddPatient |
| `/reception/approvals` | reception | PendingApprovals |
| `/reception/patient/:patientId` | reception | PatientBilling |
| `/nurse` | nurse | NurseDashboard |
| `/nurse/patients` | nurse | NursePatientsList |
| `/nurse/patient/:patientId` | nurse | PatientServiceEntry |
| `/admin` | admin | AdminDashboard |
| `/admin/services` | admin | ServicesPage |
| `/admin/medicines` | admin | MedicinesPage |
| `/admin/departments` | admin | DepartmentsPage |
| `/admin/room-charges` | admin | RoomChargesPage |
| `/admin/doctors` | admin | DoctorsPage |
| `/admin/users` | admin | UsersPage |
| `/admin/settings` | admin | SettingsPage |
| `/manager` | manager | ManagerDashboard |
| `/manager/reports` | manager | ReportsPage |
| `*` | — | Redirect to `/login` |

The root README still describes a role-selector landing page at `/`. That is **not** the current router.

---

## Build and tooling files

| File | Role |
|------|------|
| `vite.config.js` | React plugin; alias `@` → `./src` |
| `jsconfig.json` | Editor path alias |
| `tailwind.config.js` | Class dark mode, CSS-variable colors, Inter |
| `postcss.config.js` | tailwindcss + autoprefixer |
| `src/index.css` | Design tokens and print classes |
| `index.html` | Title “InCare - Hospital In-Patient Billing”, Inter font |

---

## Files that look like source of truth but are not

| File | Reality |
|------|---------|
| `README.md` | Describes a mock-only demo and role cards at `/` |
| `BACKEND_TODO.txt` | Checklist; some “done” notes do not match code (e.g. auto charges on GET patient) |
| `users.txt` | Emails do not match seed / mockData |
| `.VSCodeCounter/` | Generated line-count reports; not product docs |
