# InCare — Hospital In-Patient Billing & Deposit Management System

A modern, professional hospital in-patient billing and deposit management dashboard for **Central City Hospital**. Built with React, Vite, Tailwind CSS, and shadcn/ui. All data is mock/sample data in **Ethiopian Birr (ETB)** — no backend required.

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Hospital & System Overview](#hospital--system-overview)
3. [Global Navigation & Shared UI](#global-navigation--shared-ui)
4. [Core Concepts](#core-concepts)
5. [Role: Reception](#role-reception)
6. [Role: Nurse](#role-nurse)
7. [Role: Administrator](#role-administrator)
8. [Role: Manager](#role-manager)
9. [End-to-End Workflows](#end-to-end-workflows)
10. [Service Categories & Billing Types](#service-categories--billing-types)
11. [Tech Stack](#tech-stack)

---

## Getting Started

```bash
# API (MongoDB required)
cd server
npm install
# copy .env.example → .env
npm run seed
npm run dev

# SPA (other terminal)
cd frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). From the repo root you can use `npm run dev:server` and `npm run dev:frontend`.

```bash
cd frontend
npm run build    # Production build → frontend/dist
npm run preview  # Preview production build
```

---

## Hospital & System Overview

| Setting | Value |
|---------|-------|
| Hospital Name | Central City Hospital |
| Address | Bole Road, Addis Ababa, Ethiopia |
| Currency | ETB (Ethiopian Birr) |
| VAT | 0% |
| Low Balance Threshold | ETB 3,000 |
| Daily Doctor Visit Fee | ETB 2,000 (configurable by Admin) |

### Four User Roles

| Role | Demo User | Purpose |
|------|-----------|---------|
| **Reception** | Sara Bekele | Patient admission, billing, deposits, approvals, room transfers, invoices |
| **Nurse** | Nurse Almaz Tsegaye | Record daily patient services — no money/pricing visibility |
| **Administrator** | Admin User | Configure services, medicines, departments, room rates, users, billing rules |
| **Manager** | Manager User | Executive KPIs, revenue analytics, reports (read-only oversight) |

### Application Routes

```
/                          → Role Selector (landing page)
/reception                   → Reception Dashboard
/reception/patients          → All Patients List
/reception/add-patient       → Admit New Patient
/reception/approvals         → Pending Approvals Queue
/reception/patient/:id       → Patient Billing & Details

/nurse                       → Nurse Dashboard
/nurse/patients              → Nurse Patients List
/nurse/patient/:id           → Patient Service Entry

/admin                       → Admin Dashboard
/admin/services              → Services CRUD
/admin/medicines             → Medicines CRUD
/admin/departments           → Departments (view)
/admin/room-charges          → Room Types & Rates (view)
/admin/doctors               → Doctors (view)
/admin/users                 → Users (view)
/admin/settings              → Hospital & Billing Settings

/manager                     → Executive Dashboard
/manager/reports             → Reports Export Hub
```

---

## Global Navigation & Shared UI

### Role Selector (`/`)

The landing page displays four role cards. Each card shows the role name, description, and an **Enter Dashboard** button.

| Card | Action | Result |
|------|--------|--------|
| Reception | Click card or **Enter Dashboard** | Navigates to `/reception` |
| Nurse | Click card or **Enter Dashboard** | Navigates to `/nurse` |
| Administrator | Click card or **Enter Dashboard** | Navigates to `/admin` |
| Manager | Click card or **Enter Dashboard** | Navigates to `/manager` |

---

### App Layout (all role dashboards)

Every role dashboard shares the same shell:

#### Sidebar (left)

| Control | Action |
|---------|--------|
| **Collapse/Expand** (chevron at bottom) | Toggles sidebar between full width (256px) and icon-only (72px) |
| **Nav links** | Navigate to role-specific pages; active link is highlighted in primary color |
| **Pending badge** (Reception only) | Amber count badge on "Pending Approvals" showing number of records awaiting review |

#### Top Navigation Bar

| Control | Action |
|---------|--------|
| **Menu** (mobile only) | Opens sidebar on small screens |
| **Search bar** | Placeholder search (UI only — not wired to backend) |
| **Pending button** (Reception only) | Shows `{n} Pending` when records await approval; click → `/reception/approvals` |
| **Dark/Light mode toggle** (moon/sun icon) | Switches theme globally |
| **Notifications bell** (Reception only) | Opens dropdown of nurse submission alerts; click notification → Pending Approvals; marks all as read when opened |
| **User avatar & name** | Displays current demo user for the role |
| **Logout icon** | Returns to Role Selector (`/`) to switch roles |

#### Status Badges (used throughout)

| Badge | Meaning |
|-------|---------|
| **Pending** (amber) | Record submitted, not yet approved — does NOT affect bill |
| **Approved** (green) | Record approved — affects patient bill and balance |
| **Rejected** (red) | Record rejected — does NOT affect bill; reason stored in audit trail |
| **Sufficient** (green) | Remaining balance ≥ 2× low balance threshold |
| **Low** (amber) | Remaining balance between threshold and 2× threshold |
| **Critical** (red) | Remaining balance below low balance threshold |

---

## Core Concepts

### Patient Record Model

All services are grouped into **daily records**, not individual line-item entries. Each record is named after the **patient's name** (`recordName`).

| Record Type | Description |
|-------------|-------------|
| `daily_services` | Batch of services for one day (pharmacy, lab, procedures, etc.) |
| `pharmacy_return` | Batch of returned medicines (creates credit on bill when approved) |

| Record Status | Bill Impact |
|---------------|-------------|
| `pending` | Not on bill; shown as "pending charges" warning only |
| `approved` | Added to approved billing line items |
| `rejected` | Excluded from bill; audit trail logs rejection reason |

### Balance Calculation

```
Remaining Balance = Total Deposits − Approved Charges
Pending Charges   = Sum of all pending daily_services records (informational only)
```

- **Green** remaining balance = positive (deposit covers charges)
- **Red** remaining balance = negative (patient owes money)

### Billing Types (per service category)

Configured by Admin in **Settings → Category Billing Types**:

| Type | Categories | Entry UI |
|------|------------|----------|
| **Quantity Based** | Pharmacy, Medical Supplies, Consumables | Checkbox list + quantity input per item |
| **Single Selection** | Laboratory, Procedures, Radiology | Checkbox list + quantity input per item |
| **Automatic Daily** | Doctor Visits, Room Services | No manual entry — system generates charges |

### Automatic Daily Charges

Generated automatically when a patient's billing page is opened:

**Room Services**
- One charge per admission day
- Rate comes from the **RoomAssignment** active on that date (stored `daily_rate`)
- If patient is transferred, old rate applies before transfer date; new rate from transfer date onward

**Doctor Visits**
- One charge per admission day at the Admin-configured daily fee
- Reception can disable a specific day's charge via checkbox if doctor did not visit

### Room Assignment Model

Each patient admission maintains a full room history:

| Field | Description |
|-------|-------------|
| `id` | Assignment ID |
| `admission_id` | Patient ID |
| `room_id` | Room type ID (General Ward, Private Room, ICU, Operation) |
| `bed_id` | Specific bed ID (e.g. `BED-GW-12`) |
| `start_date` | Assignment start (inclusive) |
| `end_date` | Assignment end (null = current); set on transfer |
| `daily_rate` | Rate locked at time of assignment |
| `transfer_reason` | Why the room was assigned/transferred |
| `assigned_by` | Reception staff who performed the action |

On transfer: current assignment is closed, new assignment created, old bed → Available, new bed → Occupied.

### Audit Trail

Every record maintains a full audit log:

| Action | Logged When |
|--------|-------------|
| `recorded` | Nurse or reception submits a record |
| `edited` | Pending record is updated before approval |
| `approved` | Reception approves the record |
| `rejected` | Reception rejects with a reason |

Each entry stores: action, staff name, timestamp, and optional note.

### Notifications (Reception)

When a nurse submits a pending record or pharmacy return, reception receives:
- A notification in the bell dropdown
- A badge count on sidebar "Pending Approvals"
- A badge count on the top nav pending button

---

## Role: Reception

**Demo user:** Sara Bekele  
**Access:** Full billing, deposits, approvals, room transfers, invoices. Can also enter charges directly (auto-approved).

---

### Page 1: Reception Dashboard (`/reception`)

**Purpose:** Overview of all admitted patients, pending nurse submissions, and key financial KPIs.

#### Header

| Button | Action |
|--------|--------|
| **Add Patient** | Navigates to `/reception/add-patient` |

#### Stat Cards

| Card | Shows |
|------|-------|
| Total Admitted Patients | Count of all in-patients |
| Pending Approvals | Records awaiting reception review |
| Today's Deposits | Mock total collected today |
| Patients with Low Balance | Patients below sufficient balance status |
| Pending Discharges | Patients flagged for discharge clearance |

#### Pending Records Panel (amber banner)

Appears when nurse records are waiting. Shows up to 4 most recent pending records.

| Button | Action |
|--------|--------|
| **View All** | Navigates to `/reception/approvals` |
| **Approve** (per record) | Instantly approves record → added to patient bill |
| **Reject** (X icon, per record) | Rejects with default reason "Rejected from dashboard" |

#### Admitted Patients Table

| Column | Description |
|--------|-------------|
| Patient ID | Unique ID (e.g. PAT-001) |
| Patient Name | Full name |
| Room/Bed | Current room assignment |
| Admission Date | Date admitted |
| Deposit | Total deposits received |
| Approved Charges | Sum of all approved records |
| Remaining Balance | Deposit minus approved charges (green/red) |
| Status | Sufficient / Low / Critical badge |
| Actions | View button |

| Interaction | Action |
|-------------|--------|
| Click **View** button | Opens patient billing page |
| Click any table row | Opens patient billing page |
| **View All** (table header) | Navigates to `/reception/patients` |

---

### Page 2: Pending Approvals (`/reception/approvals`)

**Purpose:** Full queue of all nurse-submitted records and pharmacy returns awaiting review.

#### Table Columns

| Column | Description |
|--------|-------------|
| Record Name | Patient name |
| Type | Daily Services or Pharmacy Return |
| Items | Count of services or return items |
| Amount | Total charge (or credit for returns) |
| Recorded By | Nurse name |
| Submitted | Date/time submitted |
| Status | Pending badge |
| Actions | View, Approve, Reject |

#### Buttons & Interactions

| Button | Action |
|--------|--------|
| **Eye (View)** | Opens detail dialog with full service breakdown |
| **Approve** | Approves record → affects patient bill immediately |
| **Reject** | Opens rejection reason dialog |
| Click table row | Opens detail dialog |

#### Service Entry Details Dialog

Shows every service in the record: category, service name, quantity, unit price, total, notes.

| Button | Action |
|--------|--------|
| **Close** | Dismisses dialog |
| **Reject** | Opens rejection reason prompt |
| **Approve Record** | Approves and closes dialog |

#### Reject Record Dialog

| Field/Button | Action |
|--------------|--------|
| **Reason** (required text input) | Enter why record is rejected |
| **Cancel** | Closes without rejecting |
| **Reject** | Rejects record; reason saved to audit trail; record excluded from bill |

---

### Page 3: All Patients (`/reception/patients`)

**Purpose:** Complete list of all admitted patients with balance summary.

Same table structure as dashboard patient list. Balances reflect **approved charges only** — pending nurse records are excluded.

| Button | Action |
|--------|--------|
| **Add Patient** (header) | Navigates to add patient form |
| **View** (per row) | Opens patient billing page |
| Click row | Opens patient billing page |

---

### Page 4: Add Patient (`/reception/add-patient`)

**Purpose:** Register a new in-patient with full details, bed assignment, and initial deposit.

#### Patient Information Card

| Field | Required | Description |
|-------|----------|-------------|
| Full Name | Yes | Patient full name |
| Age | Yes | Numeric age |
| Gender | No | Male / Female / Other |
| Phone | Yes | Contact number |
| Address | No | Home address |
| Emergency Contact | No | Emergency contact name |
| Emergency Phone | No | Emergency contact phone |
| Admission Date | No | Defaults to today |
| Notes | No | Admission notes |

#### Bed Assignment Card

| Field | Description |
|-------|-------------|
| Bed Type | General Ward (ETB 1,500/day), Private Room (ETB 5,000/day), ICU (ETB 8,000/day), Operation (ETB 10,000/day) |
| Bed Number | Optional — auto-assigned if left empty |

**Automatic on submit:**
- Patient record created with status `admitted`
- Room assignment created (initial admission)
- Bed marked **Occupied**
- First-day room charge auto-added as approved record
- Initial deposit recorded if amount > 0

#### Initial Deposit Card

| Field | Description |
|-------|-------------|
| Deposit Amount | ETB amount (0 allowed) |
| Deposit Type | Cash / Bank Transfer / Ebirr / Other |

#### Form Buttons

| Button | Action |
|--------|--------|
| **Cancel** | Returns to reception dashboard without saving |
| **Admit Patient** | Validates required fields → creates patient → navigates to patient billing page; auto-prints deposit receipt if initial deposit > 0 |

---

### Page 5: Patient Billing & Details (`/reception/patient/:patientId`)

**Purpose:** Complete financial and clinical billing hub for one patient. The most feature-rich page in the system.

#### On Page Load (automatic)

- Generates missing automatic daily room charges (from admission to today)
- Generates missing automatic daily doctor visit charges
- Uses correct room rate from room assignment history per date

#### Header Area

| Button | Action |
|--------|--------|
| **Back to Dashboard** | Returns to `/reception` |
| **Transfer Room** (patient header) | Opens room transfer dialog |

#### Critical Balance Warning (conditional)

Red banner appears when remaining balance is below ETB 3,000 threshold. Shows current balance and any pending charges not yet applied.

#### Pending Records Banner (conditional)

Amber section listing this patient's pending records awaiting approval.

| Button | Action |
|--------|--------|
| **Details** | Opens service entry detail dialog |
| **Approve** | Approves record immediately |
| **Reject** | Opens rejection reason dialog |

#### Patient Info Card

Displays: name, ID, age/gender, phone, admission date, current room/bed.

#### Financial Stat Cards

| Card | Shows |
|------|-------|
| Total Deposit | All deposits received |
| Approved Charges | Sum of approved records |
| Remaining Balance | Deposit minus charges (green if positive, red if negative) |
| Pending Charges | Sum of pending records (not yet on bill) |

#### Room History Section

Table of all room assignments for this admission:

| Column | Description |
|--------|-------------|
| Room / Bed | Room type and bed label; **Current** badge on active assignment |
| Daily Rate | Rate locked at assignment time |
| Start | Assignment start date |
| End | End date (— if current) |
| Reason | Initial admission or transfer reason |
| Assigned By | Reception staff name |

#### Charge Entry Section

Full **ServiceRecordBuilder** component (see [Shared: Charge Entry Component](#shared-charge-entry-component)). Reception entries are **auto-approved** immediately.

Category tabs available: Pharmacy, Medical Supplies, Consumables, Laboratory, Procedures, Radiology, Doctor Visits (info only), Room Services (transfer panel).

#### Automatic Doctor Visits Section

Grid of checkboxes for each admission day (last 14 days shown).

| Checkbox | Action |
|----------|--------|
| Checked = "No doctor visit" | Disables automatic doctor visit charge for that date |
| Unchecked | Doctor visit charge applies for that date |

Toggling immediately recalculates automatic charges.

#### Approved Billing Table

All approved line items with running total column. Pharmacy returns show as negative (credit) amounts in green.

#### Record History Section

Timeline of all records (daily services + pharmacy returns) with full audit trail per record.

#### Deposit History Section

| Button | Action |
|--------|--------|
| **Add Deposit** | Opens add deposit dialog |
| **Print** (per deposit row) | Prints deposit receipt for that transaction |

**Add Deposit Dialog:**

| Field/Button | Action |
|--------------|--------|
| Amount (ETB) | Deposit amount (required, must be > 0) |
| Deposit Type | Cash / Bank Transfer / Ebirr / Other |
| Cancel | Closes dialog |
| Record Deposit | Saves deposit → updates patient balance → auto-opens print dialog for receipt |

#### Print Controls

| Button | Action |
|--------|--------|
| **Print Invoice** | Opens browser print dialog with formatted invoice (hospital header, all approved line items, deposit total, remaining balance in green/red) |

#### Invoice Preview (on-screen)

Live preview of the printable invoice below the action buttons.

---

### Room Transfer Workflow (Reception only)

Available from:
1. **Transfer Room** button on patient header
2. **Room Services** tab inside Charge Entry

#### Transfer Room Dialog

| Field | Description |
|-------|-------------|
| Transfer Date | Date of transfer (cannot be before admission) |
| New Room Type | Dropdown of room types with available bed count and daily rate |
| Available Bed | Dropdown of free beds in selected room type |
| Transfer Reason | Required text (clinical need, upgrade, etc.) |

| Button | Action |
|--------|--------|
| **Cancel** | Closes dialog |
| **Confirm Transfer** | Executes transfer (see process below) |

**Transfer Process:**
1. Current room assignment `end_date` set to transfer date
2. New room assignment created with new room, bed, and current daily rate
3. Old bed status → **Available**
4. New bed status → **Occupied**
5. Patient's displayed room/bed updated
6. Room charges recalculated for all affected dates
7. Success toast shown

---

## Role: Nurse

**Demo user:** Nurse Almaz Tsegaye  
**Restrictions:** Cannot see any prices, totals, or financial amounts. Cannot approve records. Cannot manage deposits or invoices. Cannot transfer rooms.

---

### Page 1: Nurse Dashboard (`/nurse`)

**Purpose:** Overview of admitted patients and recent record activity.

#### Header

| Button | Action |
|--------|--------|
| **View All Patients** | Navigates to `/nurse/patients` |

#### Stat Cards

| Card | Shows |
|------|-------|
| Admitted Patients | Total in-patients |
| My Pending Records | Records submitted by this nurse still awaiting approval |
| Hospital Pending Queue | All pending records hospital-wide |
| Recent Activity | Count of recent records |

#### Admitted Patients Table (top 5)

| Column | Description |
|--------|-------------|
| Patient ID | Patient identifier |
| Patient Name | Full name |
| Room/Bed | Current assignment |
| Admission | Admission date |
| Records | Total records + pending count |
| Actions | Record Services button |

| Interaction | Action |
|-------------|--------|
| **Record Services** | Opens patient service entry page |
| Click row | Opens patient service entry page |
| **View All** | Navigates to full patients list |

#### Recent Records Panel

Shows last 6 records hospital-wide with patient name, type, item count, and status badge.

---

### Page 2: Nurse Patients List (`/nurse/patients`)

**Purpose:** Full list of admitted patients to select for service entry.

| Column | Description |
|--------|-------------|
| Patient ID | Patient identifier |
| Patient Name | Full name |
| Room/Bed | Current room and bed |
| Admission Date | Date admitted |
| Pending Records | Count of this patient's pending records |
| Actions | Record Services button |

| Interaction | Action |
|-------------|--------|
| **Record Services** | Opens `/nurse/patient/:id` |
| Click row | Opens patient service entry page |

---

### Page 3: Patient Service Entry (`/nurse/patient/:patientId`)

**Purpose:** Build and submit today's daily service record for one patient.

#### Header

| Button | Action |
|--------|--------|
| **Back to Dashboard** | Returns to `/nurse` |

#### Patient Info Card

Shows: name, ID, age/gender, phone, admission date, room/bed. **No financial information displayed.**

#### Charge Entry Section

**ServiceRecordBuilder** with `hideMoney=true`:
- All prices and totals hidden
- Same category tabs as reception
- Room Services and Doctor Visits tabs show info-only panels (no transfer for nurse)
- Submitted records enter **Pending** status
- Reception is notified automatically

#### Record History Section

Timeline of all records for this patient. Amounts hidden. Shows status badges and audit trail.

---

### Nurse Daily Record Workflow

This is the core nurse workflow performed once per patient per day:

```
1. Open patient → Charge Entry
2. Select category tab (Pharmacy, Lab, etc.)
3. Check items + set quantity for each
4. Click "Add Selected" → items added to Current Record cart
5. Repeat for other categories as needed
6. Click "Done — Save Record" → entire day's cart submitted as ONE pending record
7. Reception receives notification
8. If reception has NOT approved yet → nurse can click "Edit Pending Record" to modify
9. Once approved → record is locked; new services require a new submission
```

**Pharmacy Returns tab (separate workflow):**

```
1. Switch to "Pharmacy Returns" tab
2. Select medicine from dropdown
3. Enter quantity returned
4. Enter return reason
5. Click "Add" → item added to return cart
6. Repeat for multiple medicines
7. Click "Done — Submit Return" → pharmacy return record sent to reception as pending
```

---

## Shared: Charge Entry Component

Used on both Reception (Patient Billing) and Nurse (Patient Service Entry) pages.

### Services Tab

#### Category Tabs

| Tab | Billing Type | UI |
|-----|-------------|-----|
| Pharmacy | Quantity | Checkbox + qty per medicine |
| Medical Supplies | Quantity | Checkbox + qty per item |
| Consumables | Quantity | Checkbox + qty per item |
| Laboratory | Selection | Checkbox + qty per test |
| Procedures | Selection | Checkbox + qty per procedure |
| Radiology | Selection | Checkbox + qty per scan |
| Doctor Visits | Automatic | Info panel only — no manual entry |
| Room Services | Automatic | Info panel + Room Transfer (reception only) |

#### Checklist Entry (manual categories)

For each service item:
1. **Checkbox** — select/deselect item
2. **Quantity input** — enabled when checked (default: 1)
3. Item name displayed (price shown for reception only)

| Button | Action |
|--------|--------|
| **Add Selected (n)** | Adds all checked items with their quantities to Current Record cart |

#### Current Record Cart

Table showing all items added today before submission.

| Button | Action |
|--------|--------|
| **Trash icon** (per row) | Removes item from cart |
| **Edit Pending Record** | Loads today's pending record back into cart for editing (only if reception hasn't approved) |
| **Done — Save Record** | Submits entire cart as one daily record |

**On Done (Nurse):** Record status = `pending` → reception notified  
**On Done (Reception):** Record status = `approved` immediately → added to bill

### Pharmacy Returns Tab

| Field | Description |
|-------|-------------|
| Medicine | Dropdown of pharmacy items |
| Quantity Returned | Number of units returned |
| Return Reason | Text (unused, expired, wrong order, etc.) |

| Button | Action |
|--------|--------|
| **Add** | Adds return item to return cart |
| **Trash icon** | Removes item from return cart |
| **Done — Submit Return** | Submits return record (pending for nurse, auto-approved for reception) |

---

## Role: Administrator

**Demo user:** Admin User  
**Purpose:** Configure hospital master data, service catalog, and billing rules. Does not process patient billing directly.

---

### Page 1: Admin Dashboard (`/admin`)

**Purpose:** System overview with counts and recent data snapshots.

#### Stat Cards

| Card | Shows |
|------|-------|
| Total Services | Count of services (active count as subtitle) |
| Total Medicines | Count of medicines (in-stock count as subtitle) |
| Active Users | Active user accounts |
| Departments | Total hospital departments |

#### Panels

- **Recent Services** — last 5 services with department and price
- **Department Overview** — top 5 departments with staff and service counts

---

### Page 2: Services (`/admin/services`)

**Purpose:** CRUD management of hospital services and their prices.

| Button | Action |
|--------|--------|
| **Add Service** | Opens add service dialog |
| **Pencil icon** (per row) | Opens edit dialog for that service |
| **Trash icon** (per row) | Opens delete confirmation |

**Add/Edit Service Dialog:**

| Field | Description |
|-------|-------------|
| Service Name | Required |
| Department | Required |
| Price (ETB) | Required numeric |
| Status | Active / Inactive |

| Button | Action |
|--------|--------|
| Cancel | Closes dialog |
| Save | Creates or updates service |

---

### Page 3: Medicines (`/admin/medicines`)

**Purpose:** CRUD management of pharmacy inventory and pricing.

Same CRUD pattern as Services page.

| Field | Description |
|-------|-------------|
| Medicine Name | Required |
| Unit | e.g. Tablet, Vial, Pen |
| Price (ETB) | Required |
| Stock Status | In Stock / Out of Stock |

---

### Page 4: Departments (`/admin/departments`)

**Purpose:** View hospital departments with staff counts, service counts, and color coding. Read-only display.

---

### Page 5: Room Charges (`/admin/room-charges`)

**Purpose:** View room types, daily rates, bed counts, and occupancy rates.

| Room Type | Daily Rate |
|-----------|------------|
| General Ward | ETB 1,500/day |
| Private Room | ETB 5,000/day |
| ICU | ETB 8,000/day |
| Operation Room | ETB 10,000/day |

Displays occupancy percentage bars per room type. Read-only in demo.

---

### Page 6: Doctors (`/admin/doctors`)

**Purpose:** View doctor directory with specialty, department, phone, and active status. Read-only in demo.

---

### Page 7: Users (`/admin/users`)

**Purpose:** View system users with name, email, role (Reception/Nurse/Admin/Manager), and active/inactive status. Read-only in demo.

---

### Page 8: Settings (`/admin/settings`)

**Purpose:** Configure hospital identity, financial rules, and category billing behaviors.

#### Header

| Button | Action |
|--------|--------|
| **Save Changes** | Saves hospital info and billing configuration |

#### Hospital Information

| Field | Description |
|-------|-------------|
| Hospital Name | Appears on invoices and receipts |
| Address | Hospital address on documents |
| TIN | Tax identification number |

#### Billing Configuration

| Field | Description |
|-------|-------------|
| Currency | Display currency (ETB) |
| Low Balance Threshold | ETB amount triggering critical balance warnings |
| VAT % | VAT percentage (currently 0) |
| Daily Doctor Visit Fee | Auto-charge amount per admission day |
| Daily Doctor Visit Name | Service name on invoice for doctor visits |

#### Receipt Footer

Multi-line text appearing at bottom of all printed invoices and deposit receipts.

#### Category Billing Types Table

| Column | Description |
|--------|-------------|
| Category | Service category name |
| Description | Category purpose |
| Services | Count of items in category |
| Billing Type | Dropdown to change behavior |

**Billing Type dropdown** (changes apply immediately):

| Option | Effect |
|--------|--------|
| Quantity Based | Checkbox + quantity entry UI |
| Single Selection | Checkbox + quantity entry UI |
| Automatic Daily | No manual entry; system auto-generates daily charges |

---

## Role: Manager

**Demo user:** Manager User  
**Purpose:** Read-only executive oversight. No patient billing or configuration access.

---

### Page 1: Executive Dashboard (`/manager`)

**Purpose:** High-level financial KPIs and analytics charts.

#### KPI Stat Cards

| Card | Shows |
|------|-------|
| Today's Revenue | Daily revenue with trend |
| Monthly Revenue | Monthly total with trend |
| Total Deposits | Sum of all patient deposits |
| Outstanding Balance | Unpaid/low deposit amounts |
| Current Inpatients | Admitted patient count |
| Near Low Balance | Patients below sufficient balance |

#### Charts

| Chart | Data |
|-------|------|
| Revenue by Department | Bar chart of revenue per department |
| Daily Revenue Trend | Line chart of last 7 days |
| Top Services Used | Ranked list with usage count and revenue |
| Top Medicines Used | Pie chart of medicine distribution |

#### Recent Transactions Table

Latest billing and payment activities with patient name, department, amount, date, and receptionist.

---

### Page 2: Reports (`/manager/reports`)

**Purpose:** Report generation hub (demo — shows toast confirmation only, no actual file export).

#### Available Reports

| Report | Description |
|--------|-------------|
| Daily Report | Today's revenue, deposits, transactions |
| Weekly Report | Weekly performance metrics |
| Monthly Report | Monthly financial statement |
| Annual Report | Year-end summary and trends |
| Department Revenue | Revenue breakdown by department |
| Deposit Report | All deposits in selected period |
| Outstanding Balance | Patients with unpaid/low balances |
| Patient Billing History | Detailed billing per patient |
| Room Occupancy | Bed utilization rates |

Each report card has three export buttons:

| Button | Action |
|--------|--------|
| **PDF** | Shows "PDF Export Started" toast (demo) |
| **Excel** | Shows "Excel Export Started" toast (demo) |
| **Print** | Shows "Print Export Started" toast (demo) |

---

## End-to-End Workflows

### Workflow 1: New Patient Admission

```
Reception → Add Patient
  → Fill patient info (name*, age*, phone*)
  → Select bed type and bed number
  → Enter initial deposit + deposit type
  → Click "Admit Patient"
    → Patient created (status: admitted)
    → Room assignment created (reason: Initial admission)
    → Bed marked Occupied
    → First-day room charge auto-approved
    → Initial deposit recorded
    → Navigate to Patient Billing
    → Deposit receipt auto-prints (if deposit > 0)
```

---

### Workflow 2: Nurse Daily Service Recording

```
Nurse → Dashboard → Record Services (patient)
  → Charge Entry → Services tab
  → For each category needed:
      → Check items + set quantities
      → Click "Add Selected"
  → Review Current Record cart
  → Click "Done — Save Record"
    → Record created (status: pending, name: patient name)
    → Reception notified (bell + badge)
  → Nurse can edit pending record before approval
```

---

### Workflow 3: Reception Approval

```
Reception → Pending Approvals (or dashboard panel or bell notification)
  → Review record list
  → Click View → inspect all services in detail
  → Approve OR Reject (with reason)
    → If Approved: charges added to patient bill, balance updated
    → If Rejected: audit trail updated, charges NOT added
  → Patient balance and invoice reflect approved items only
```

---

### Workflow 4: Pharmacy Return

```
Nurse → Patient Service Entry → Pharmacy Returns tab
  → Select medicine, quantity, reason
  → Add to return cart
  → Click "Done — Submit Return"
    → Return record pending

Reception → Pending Approvals
  → Review return items (cross-check physically)
  → Approve
    → Credit applied to patient bill (negative line item)
```

---

### Workflow 5: Room Transfer

```
Reception → Patient Billing
  → Click "Transfer Room" (header) OR Room Services tab
  → Select transfer date
  → Select new room type (shows available bed count + rate)
  → Select available bed
  → Enter transfer reason (required)
  → Confirm Transfer
    → Old assignment closed (end_date set)
    → New assignment created with locked daily_rate
    → Old bed → Available, new bed → Occupied
    → Room charges recalculated per date from assignment history
    → Room History table updated
```

---

### Workflow 6: Additional Deposit

```
Reception → Patient Billing → Deposit History
  → Click "Add Deposit"
  → Enter amount + deposit type
  → Click "Record Deposit"
    → Deposit saved, patient deposit total updated
    → Remaining balance recalculated
    → Deposit receipt auto-prints
  → Can re-print any deposit via Print button on row
```

---

### Workflow 7: Invoice Generation

```
Reception → Patient Billing
  → Review Approved Billing table
  → Review Invoice Preview section
  → Click "Print Invoice"
    → Browser print dialog opens
    → Invoice includes: hospital header, all approved line items,
      subtotal, deposits, remaining balance (green/red)
```

---

### Workflow 8: Disable Doctor Visit Charge

```
Reception → Patient Billing → Automatic Doctor Visits
  → Check box for date where doctor did not visit
    → Doctor visit charge removed for that date
  → Uncheck to restore charge
```

---

## Service Categories & Billing Types

| Category | Billing Type | Example Items |
|----------|-------------|---------------|
| Pharmacy | Quantity | Amoxicillin, Paracetamol, IV Saline, Ceftriaxone |
| Medical Supplies | Quantity | BP Cuff, Pulse Oximeter, Nebulizer Kit |
| Consumables | Quantity | Gloves, Syringes, Cannula, Gauze |
| Laboratory | Selection | CBC, LFT, Blood Sugar, Urinalysis, HIV Test |
| Procedures | Selection | Wound Dressing, Catheter Insertion, Nebulization |
| Radiology | Selection | Chest X-Ray, Ultrasound, CT Scan |
| Doctor Visits | Automatic Daily | Daily Doctor Visit (ETB 2,000/day) |
| Room Services | Automatic Daily | Rate from room assignment history |

### Bed Types & Daily Rates

| Bed Type | Prefix | Daily Rate |
|----------|--------|------------|
| General Ward | GW | ETB 1,500 |
| Private Room | PR | ETB 5,000 |
| ICU | ICU | ETB 8,000 |
| Operation | OP | ETB 10,000 |

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | React 18 (JavaScript) |
| Build Tool | Vite |
| Styling | Tailwind CSS |
| UI Components | shadcn/ui (Radix UI primitives) |
| Icons | Lucide React |
| Charts | Recharts |
| Routing | React Router v6 |
| State | React Context API |

### Context Providers

| Context | Manages |
|---------|---------|
| `ThemeProvider` | Dark/light mode |
| `ToastProviderWrapper` | Toast notifications |
| `PatientsProvider` | Patients, deposits, room assignments, bed inventory, transfers |
| `BillingConfigProvider` | Hospital settings, service categories, billing types |
| `ServiceEntriesProvider` | Daily records, approvals, automatic charges, notifications, balance calculations |

---

## Demo Notes

- All data is **mock/sample data** — changes persist only during the browser session (React state)
- No authentication — role selection is for demo navigation only
- No backend API — fully frontend demo
- Dark mode supported globally via top nav toggle
- Responsive layout for mobile and desktop
- Print styles hide navigation; show invoice or deposit receipt only
- Hospital branding uses "CC" logo mark and Central City Hospital name on all printed documents

---

*InCare · Central City Hospital · Demo Application · Currency: ETB*
