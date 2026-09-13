# Admin Dashboard UI specification

Status: Admin Dashboard UI complete through finance/credit. Sections render only when `GET /api/admin/dashboard` returns them.

Source of truth for data: `GET /api/admin/dashboard` (`useAdminDashboard`). Unauthorized sections are omitted. Do not design around missing keys as zeros.

---

## 1. Current UI problems

The live page (`frontend/src/pages/admin/AdminDashboard.jsx`) is a temporary dump of API fields into `StatCard` plus two stacked lists.

| Problem | Why it fails for hospital admin work |
| --- | --- |
| Every number is its own floating card | A Super Admin can get ~18 equally loud cards. Census, beds, setup, catalog, and money all compete. |
| No information hierarchy | “Currently admitted” and “Price lines” use the same `text-2xl` + tinted icon well. |
| Occupancy is shown twice | Four bed `StatCard`s **and** a key-value list. Wasted scan time; no single “how full / how many free” picture. |
| Recent admissions are a cramped list | ID, date, room, type, and credit are crammed into one muted line. Status is `font-semibold text-primary` (not `StatusBadge`). |
| Duplicate bed panel | After a long card grid, the right column repeats totals. |
| Setup is inventory-as-KPI | Six “Configured” cards look like operational alerts. They are configuration inventory. |
| Catalog over-weighted | “Service categories” and “Price lines” sit in the same KPI row as occupancy. |
| Finance/credit look like hero metrics | Today’s deposits use `formatCurrency` at `text-2xl` in the same grid as census. Manager already owns revenue. |
| Loading is a 20-unit empty hole | `py-20` “Loading dashboard...” wastes the fold. |
| Error is a lone centered card | Fine functionally; should keep the header and sit in the same content column as the page. |
| Copy is generic | “System overview and data management” does not say what an admin should do here. |
| No links to existing admin work | Occupancy does not lead to Hospital Setup. Doctors/users counts do not lead to those pages. |
| Dates shown as raw `YYYY-MM-DD` | Acceptable for truth; inconsistent with `DataTable` pages that use `formatDate`. `formatDate` uses `new Date(dateStr)` and can shift a calendar day in ET. |
| Recent rows have no table semantics | Harder to scan than `DataTable` used on Reception, Nurse, Users. |
| `StatCard` icon wells | Large tinted squares (`p-3`, `h-5 w-5`) on every tile — the generic SaaS pattern this audit forbids repeating. |

The data connection is correct. The layout is not yet an operational workstation.

---

## 2. Existing design-system patterns to keep

Do **not** add a second design system. Reuse tokens and primitives already in the app.

### Layout chrome

- `AppLayout`: sidebar `w-64` / collapsed `w-[72px]`; main `pt-16`; content `p-4 md:p-6 lg:p-8`. No page `max-w-*` today — dashboards fill the main column.
- `PageHeader`: `h1` `text-2xl font-bold tracking-tight`; description `text-muted-foreground`; optional right `action` (Reception “Add Patient”, Nurse “View All Patients”).
- Sidebar: `rounded-lg` nav items; active `bg-primary text-primary-foreground shadow-sm`; inactive muted + `hover:bg-accent`.
- Top nav: `h-16`, `border-b`, `bg-card/95` (light blur already exists — do not add more glass).

### Color and type

- Font: Inter via `tailwind.config.js`.
- Tokens: `background` (cool gray-blue 210 40% 98%), `card` white, `foreground` navy, `primary` blue 217 91% 45%, `muted`, `border` 214 32% 91%, `success`, `warning`, `destructive`.
- `--radius`: `0.75rem` → `rounded-xl` on cards/tables matches the rest of the app. Do not invent a sharper or pill-only language for this page only.
- Dark mode: existing CSS variables. Use `dark:` pairs already on `StatusBadge`.

### Components to reuse

| Primitive | Use on Admin Dashboard |
| --- | --- |
| `PageHeader` | Title, one-line purpose, header actions |
| `Button` (`default` / `outline` / `ghost` / `sm`) | Retry, “Hospital Setup”, “Doctors”, “Users”, “Services” |
| `StatusBadge` | Stay status (`admitted`, `pending-discharge`, `discharged`) — already mapped |
| `DataTable` | Recent admissions (8 rows; pagination will hide itself when `total ≤ 10`) |
| `EmptyState` | **Avoid** on this page — its large circular icon is too promotional for an empty table. Use `DataTable`’s quiet empty slot or one muted sentence. |
| `Card` / `CardHeader` / `CardTitle` | Optional; Reception often uses raw `rounded-xl border bg-card shadow-sm` instead. Prefer that same bordered panel. |
| `formatCurrency` | Today’s deposits only |
| `CreditBadge` | **Do not use** — it needs a full patient + `computeCreditState`. Dashboard only has a boolean `isCreditPatient` when `credit.view` is present. |

### Patterns to **not** copy from other dashboards

- Reception/Nurse **KPI `StatCard` rows** — they already look generic; do not multiply that for Admin.
- Reception **fake** “12% vs yesterday” trend — never add trends here.
- Manager **Recharts** revenue/occupancy charts — Manager owns analytics. Admin occupancy is a meter, not a chart library.
- Top nav search — it is not wired to patients; do not depend on it.

### Visual rules (preserve)

- Borders over shadows: `border` + `shadow-sm` only. No `shadow-xl`, no glow.
- Icon size in chrome: `h-4 w-4` in buttons; `h-5 w-5` in nav. Section headings may use one `h-4 w-4` muted icon, not a colored well.
- Table: `text-sm`, header `bg-muted/50`, `px-4 py-3`, mono `text-xs` + `text-primary` for IDs (Reception/Nurse).
- Hover: `hover:bg-muted/30` on rows; `hover:shadow-md` only if a panel is a real navigation target (existing `StatCard` click). Prefer a text button instead of making the whole panel clickable.

---

## 3. Proposed information hierarchy

Admin’s job on this screen: **Is the hospital running, and is the system configured?** Not “how much did we earn?”

| Priority | Content | Emphasis |
| --- | --- | --- |
| 1 (fold) | Census: who is in, who arrived today, who is waiting to leave, who left today | Highest. One grouped strip. **Currently admitted** is the primary figure. **Pending discharge** is the only census figure that may use warning color when `> 0`. |
| 1 (fold, if `beds`) | Occupancy: how full, how many **available**, unavailable split | Equal to census on desktop (side-by-side). Available beds are the operational number; % is a caption with a defined meaning. |
| 2 | Recent admissions (if `patients.view`) | Full-width table. Work list, not a card carousel. |
| 3 | Configuration + catalog | Compact counts. Inventory, not alarms. |
| 4 | Today’s deposits / credit admissions | Footer strip. Independent. Must not sit in the fold KPI row. |

Secondary: header actions to existing admin routes (see §14).

Do not show: medicine stock, department staff, department service counts, revenue charts, unique lifelong patients, fake deltas.

---

## 4. Proposed page structure

Desktop (≥ `lg`, typical 1366–1920 workstation):

```
PageHeader  (title + purpose + 1–3 outline buttons)
─────────────────────────────────────────────────────
[ Census panel (flex 1) ]  [ Occupancy panel (flex 1) ]
─────────────────────────────────────────────────────
Recent admissions  (full width table panel)
─────────────────────────────────────────────────────
[ Configuration counts ]  [ Catalog + ops finance strip ]
```

If `beds` is omitted: census uses the full row.  
If `census` is omitted: occupancy uses the full row.  
If both omitted: skip the fold row entirely (do not leave an empty grid).  
If `recentAdmissions` omitted: skip the table.  
Configuration / catalog / finance: one row of **independent** panels; missing panels do not leave a blank column (CSS grid `auto-fit` / stack remaining items).

### 4.1 Header

- **Purpose:** Orient the user; jump to setup work.
- **Display:** `PageHeader` title **Hospital overview** (or keep “Admin Dashboard” if product wants route-name match — prefer **Hospital overview** so it is not another generic “Dashboard”). Description: “Census, beds, and hospital configuration.” No marketing subtitle.
- **Layout:** Existing header flex; actions on the right.
- **Importance:** Wayfinding, not data.
- **Why here:** Same as every other role home.

### 4.2 Operational census (if `census`)

- **Purpose:** Answer “what is the inpatient load today?”
- **Display:** See §5.
- **Layout:** Left fold panel (`rounded-xl border bg-card shadow-sm`, `p-5` not `p-6` if we need density).
- **Importance:** Primary.
- **Why:** Admin needs operational load before catalog size.

### 4.3 Bed occupancy (if `beds`)

- **Purpose:** Answer “can we admit?” and “how much capacity is offline?”
- **Display:** See §6.
- **Layout:** Right fold panel, same chrome as census.
- **Importance:** Primary, paired with census (beds are how census is housed).
- **Why:** Beside census, not below eighteen cards.

### 4.4 Recent admissions (if `recentAdmissions` array)

- **Purpose:** Latest eight stays for audit/orientation.
- **Display:** See §9.
- **Layout:** Full-width bordered panel; header + `DataTable`.
- **Importance:** High after fold; this is the only row-level operational data.
- **Why:** Tables beat lists for 5–8 comparable records. Full width because columns need room (ID, name, status, dates, location, type).

### 4.5 Hospital configuration (if `setup` has any key)

- **Purpose:** “Is the org structure populated?”
- **Display:** See §7.
- **Layout:** Compact panel, ~7/12 width on `xl` when catalog/finance share the row; otherwise full or half.
- **Importance:** Secondary.
- **Why:** After operations. Admin who cares about empty doctor lists still sees it without it shouting.

### 4.6 Service catalog (if `catalog`)

- **Purpose:** Catalog size only.
- **Display:** See §8.
- **Layout:** Small panel or a two-figure footer inside configuration if both exist. If only catalog: a single compact panel, not a KPI row.
- **Importance:** Low.
- **Why:** Two integers. Must not equal census.

### 4.7 Operational finance (if `finance` and/or `credit`)

- **Purpose:** Permissioned facts: cash taken today; open credit stays.
- **Display:** See §10.
- **Layout:** Compact panel(s) in the same bottom row as catalog, **or** a thin bar under configuration. Each of `finance` / `credit` is its own block so either can vanish.
- **Importance:** Lowest on this page (Manager owns money stories).
- **Why:** Still useful for admin with `payments.view` / `credit.view`, but not the hero.

---

## 5. Census design

**Do not** use four `StatCard`s.

**Use one panel, four compact metrics, one primary.**

```
Hospital census
Currently admitted          12          ← text-xl font-semibold (not text-4xl)
Admitted today     2    Pending discharge  1    Discharged today  0
```

- Desktop: primary on the first row (label + number). Second row: three equal columns, `text-sm` labels (`text-muted-foreground`) + `text-lg font-semibold` values.
- `pendingDischarge > 0`: number uses `text-amber-700 dark:text-amber-400` **and** the label includes the words “Pending discharge” (color is not the only signal).
- Zeros are real: show `0`, not “—” and not a fake sparkline.
- No icons in colored wells. Optional single muted heading icon (`Users`, `h-4 w-4`) next to “Hospital census”.
- No “vs yesterday”.

**Reasoning:** The only number that describes current load is **currently admitted**. Today’s in/out/pending are the same day’s movement; they belong together as context, not as four posters. A nurse/reception home already uses giant cards; Admin should read faster and look more like a control sheet.

---

## 6. Bed occupancy design

**Do not** add Recharts, donuts, or a “decorative” pie.

**Use a labeled segmented bar + four numbers.**

API meaning (already implemented):  
`occupancyPercentage = round(100 × occupied / total)` including maintenance and out-of-service. Caption must say so: **Occupied / all beds**.

```
Beds
Available  18                         Occupancy  42%  (occupied / all beds)

[████ occupied ██ available ░ maint ░ oos ]   ← one horizontal stacked bar, height 8–10px

Occupied 24    Available 18    Maintenance 2    Out of service 1
Total 45
```

- Bar segments: occupied `bg-primary` (or blue-600), available `bg-emerald-600`, maintenance `bg-amber-500`, out of service `bg-muted-foreground/40`.
- Each segment width = `count / total * 100%`. If `total === 0`, show an empty track (`bg-muted`) and “No beds configured”.
- **Available** is the large operational figure (`text-xl`). Occupancy % is secondary (`text-sm` / `text-lg`), never a hero donut.
- `unavailable` can be omitted as its own headline if maintenance + out of service are listed (avoid a fifth number).
- `aria`: bar is `role="img"` with `aria-label` listing all four counts and the percentage. Also list the same numbers in text (not color-only).
- Header action if `rooms.view` or `beds.view` (user already has one of these to see this panel): `outline` `sm` button **Hospital Setup** → `/admin/departments`.

No second occupancy list elsewhere on the page.

---

## 7. Setup / configuration design

**Do not** use six giant cards.

**Use one definition grid** inside a single panel titled **Hospital configuration**.

| Label | API field | Link (if route exists and user can open it) |
| --- | --- | --- |
| Departments | `setup.departments` | `/admin/departments` |
| Wards | `setup.wards` | `/admin/departments` (same Hospital Setup tabs) |
| Rooms | `setup.rooms` | `/admin/departments` |
| Beds | `setup.beds` | `/admin/departments` |
| Doctors | `setup.doctors` | `/admin/doctors` |
| Users | `setup.users` | `/admin/users` |

- Render **only keys present** on `setup`.
- Layout: `grid grid-cols-2 sm:grid-cols-3` ; each cell is `label` (`text-xs text-muted-foreground`) + `value` (`text-base font-semibold`). No icon well.
- Subtitle under the panel title: “Configured records, including inactive.” (matches backend: counts are not active-only.)
- Links: the **label** or a trailing “Open” on the panel, not six buttons. Prefer one panel footer: **Open Hospital Setup** / **Doctors** / **Users** using existing `Button variant="outline" size="sm"`, shown only when that key exists **and** the route’s permission gate can succeed (same keys as `App.jsx` / Sidebar).
- Zero is valid (“0 doctors configured”).

---

## 8. Catalog design

Show **Service categories** and **Price lines** only. Never “active services”.

If `catalog` is present with `setup`: put the two figures in a **narrow column** or the bottom of the configuration panel as a separated `border-t` row:

`Service categories  8    Price lines  21` plus `outline sm` **Services** → `/admin/services` when `system.view_settings` or `system.modify_settings`.

If only `catalog`: one compact panel, two figures, same treatment. No chart of categories.

---

## 9. Recent admissions

Use existing `DataTable` + `StatusBadge`. Eight rows; do not paginate visually if 8 ≤ page size 10.

### Columns (in order)

| Column | Field | Presentation |
| --- | --- | --- |
| Stay ID | `patientId` | `font-mono text-xs font-medium text-primary` |
| Patient | `name` | `font-medium` |
| Status | `status` | `StatusBadge` (Admitted / Pending Discharge / Discharged) |
| Admitted | `admissionDate` | Calendar day as stored (`YYYY-MM-DD`) **or** a local formatter that does **not** use `new Date('YYYY-MM-DD')` UTC midnight. Prefer a small `formatAdmissionDay(str)` that splits the string, or `T12:00:00` local like `stayDurationDays`. Do not recompute “today”. |
| Location | `room`, `bed` | `General Ward / GW-01`; if both empty, muted “—” |
| Type | `admissionType` | “Normal” / “Maternity” as text, not a badge unless needed for scan — **text is enough** |
| Credit | `isCreditPatient` | Column **only if at least one row includes the field** (backend strips it without `credit.view`). Show “Credit” text or omit cell. Do not invent outstanding balance. Do not use `CreditBadge`. |
| Discharged | `dischargeCompletedAt` | If present, `formatDateTime`; else blank. Do not invent a date. |

Do **not** add phone, balance, MRN, address.

### Density and actions

- Standard table density (`px-4 py-3`). Do not compact to `py-1`.
- **No row navigation.** There is **no** Admin patient-stay route. `RequireAuth role="admin"` cannot open `/reception/patient/:id`. Do not invent `/admin/patients`. `onRowClick` unset. `DataTable` key: pass `id: patientId` (table currently keys `row.id`).
- Header: **Recent admissions** + muted “Latest 8 stays”. No “View all” unless a real list exists (it does not for Admin).

### Empty

`No recent admissions` in the table body (`text-sm text-muted-foreground`, `py-8`). Not fake names.

---

## 10. Finance + credit

Independent, compact, below the fold.

```
Today’s deposits          ETB 0.00          ← only if data.finance
Open credit admissions    3                 ← only if data.credit
```

- Two **separate** sub-blocks (or two cells in a small grid). If only one key exists, that cell is the only child — no empty sibling, no “N/A”, no `0` for the missing permission.
- Typography: `text-base font-semibold` for values, not `text-2xl`. Label `text-xs text-muted-foreground`.
- `formatCurrency(todayDeposits)` including legitimate `0`.
- Title the panel **Payments** only if `finance` exists; if only `credit`, title **Credit admissions**. If both, one panel **Payments & credit** with two labeled figures.
- No sparkline, no “vs yesterday”, no Manager `todayRevenue`.
- Do not reuse Reception’s mock `todayDeposits` or `trend`.

---

## 11. Responsive behavior

Primary: **desktop workstation**. Do not collapse into a marketing single-column of huge tiles.

| Breakpoint | Behavior |
| --- | --- |
| `lg+` | Census ‖ occupancy. Table full width. Config + catalog/finance share a row if both exist. |
| `md` | Census stacked above occupancy. Table horizontal scroll (`DataTable` already `overflow-x-auto`). Config grid 3 → 2 columns. |
| `< md` | Existing app already uses a hamburger + overlay sidebar. Stack all panels. Keep metric text `text-lg`/`text-xl`, not `text-4xl`. Table scrolls horizontally. Header actions wrap (`PageHeader` already stacks on `sm`). |

Do not hide census or occupancy on tablet to “simplify.”

---

## 12. Accessibility

- Page `h1` via `PageHeader`; section titles as `h2` (`text-base font-semibold`).
- Occupancy bar: text counts + `aria-label`; not color-only.
- Pending discharge: label + number; warning color optional extra.
- `StatusBadge` already has text labels.
- Buttons: visible labels (“Retry”, “Hospital Setup”), not icon-only.
- Focus: default `Button` ring (`focus-visible:ring-2 focus-visible:ring-ring`). Table is not a fake button.
- Contrast: stick to existing `primary`, `muted-foreground`, badge palettes (already used in dark mode).
- Loading: announce with visible text (and optionally `aria-busy` on the main region).
- Error: text + Retry; do not rely on color alone.
- Do not add `title`-only icon buttons for essential actions.

---

## 13. States

| State | Treatment |
| --- | --- |
| Loading | Keep `PageHeader`. Below: one bordered panel, `py-10`, `text-sm text-muted-foreground`: “Loading hospital overview…”. No fake numbers. No pulse skeleton army. Optional: static muted bars matching panel heights **without** `animate-pulse` if it feels busier than Reception/Manager. |
| API error / `USE_API=false` | Same header. Bordered panel: error string from the hook + `Button` Retry. **Never** `mockData`. |
| 403 / no sections | Same as now conceptually: “No dashboard sections are available for this account.” + Retry. |
| Census all zeros | Show zeros in the census panel. Not an error. |
| `beds.total === 0` | Empty track + “No beds configured” + link to Hospital Setup if allowed. |
| `available === 0` and `total > 0` | Show `0` available; no extra drama unless we only use existing warning text color. |
| Empty recent admissions | Empty table message. |
| Catalog zeros | Show `0` and `0`. |
| No `finance` | Panel/cell absent. |
| No `credit` | Panel/cell absent. |
| Credit column on table | Absent when API omitted `isCreditPatient`. |

---

## 14. Navigation (existing routes only)

Admin routes that exist (`App.jsx` / Sidebar):

| Route | Sidebar label | When to offer from dashboard |
| --- | --- | --- |
| `/admin` | Dashboard | — |
| `/admin/departments` | Hospital Setup | Occupancy panel; setup counts for depts/wards/rooms/beds |
| `/admin/doctors` | Doctors | If `setup.doctors` present |
| `/admin/users` | User Management | If `setup.users` present |
| `/admin/services` | Services | If `catalog` present |
| `/admin/settings` | Settings | Optional, header only if we want one “Settings” — **low value**; skip unless needed |
| `/admin/room-charges` | Room Charges | Skip on this page (pricing, not occupancy) |
| `/admin/medicines` | Medicines | **Do not** link; no inventory data on this dashboard |

**Do not invent**

- View Patients / View Admissions (no Admin list)
- Links to `/reception/*` or `/nurse/*` (role-gated)
- Manage Beds as a new URL (beds live under Hospital Setup)

Header actions (max three, `outline` `sm`): **Hospital Setup**, **Doctors**, **Users** — each only if the corresponding `setup` key or beds section is visible (i.e. the API already authorized that domain). Do not show a button the user will hit `Forbidden` on.

---

## 15. Visual design specification

Use existing tokens. No new palette, radius, or shadow language.

| Token | Recommendation |
| --- | --- |
| Page width | Fill `AppLayout` content (`p-4 md:p-6 lg:p-8`). Do **not** add a narrow `max-w-3xl`. Optional `max-w-[1440px]` only if ultra-wide waste appears; default is full main column like Users/Hospital Setup. |
| Vertical rhythm | `mb-6` between major sections (same as `PageHeader` margin). `gap-4` / `gap-6` in grids (already used). |
| Panels | `rounded-xl border bg-card shadow-sm`. Padding `p-5` fold panels; table panel: header `px-6 py-4 border-b`, table edge-to-edge. |
| Grid | Fold: `grid gap-4 lg:grid-cols-2`. Bottom: `grid gap-4 lg:grid-cols-2` with children that simply omit themselves. |
| Type | `h1` `text-2xl`; `h2` `text-base font-semibold`; primary metric `text-xl font-semibold tracking-tight`; secondary metrics `text-lg font-semibold`; labels `text-xs` or `text-sm text-muted-foreground`. |
| Borders | `border` / `border-b` for section headers. No gradient borders. |
| Cards | Few panels (3–5), not 18 `StatCard`s. **Stop using `StatCard` on this page.** |
| Tables | Existing `DataTable` density. |
| Status | `StatusBadge` only for stay status. Admission type as text. |
| Icons | Heading-level only, `h-4 w-4 text-muted-foreground`. No `bg-blue-100` wells. |
| Color | Primary blue for IDs and occupied segment; emerald for available segment; amber for pending discharge + maintenance; muted for out of service. Deposits: default foreground (not “money green” hero). |
| Shadows | `shadow-sm` only. |
| Radius | Existing `rounded-xl` / `rounded-lg` / badge `rounded-full`. |
| Hover | Buttons as now; table row hover if we ever add navigation (we will not). Setup footer buttons `hover:bg-accent`. |
| Motion | None beyond existing button/hover. No count-up, no bar animation. |
| Responsive | §11. |

---

## 16. Implementation stages

Each stage is independently testable on `/admin` with Super Admin plus a restricted-permission user.

**Stage A — Shell and states**  
Keep `useAdminDashboard`. Replace the `StatCard` dump with `PageHeader` (new copy + conditional actions), loading/error/empty treatments per §13. No metrics yet except a placeholder region. **Test:** loading, Retry, 403 copy, no mock.

**Stage B — Census panel**  
Implement §5. Hide entire panel if `census` missing. **Test:** zeros; pending > 0 styling + text; omit when `patients.view` absent.

**Stage C — Occupancy panel**  
Implement §6 (stacked bar + numbers + Setup link). Remove any leftover occupancy list. **Test:** `total === 0`; omit when no `beds`; percentage caption wording.

**Stage D — Recent admissions table**  
`DataTable` + `StatusBadge` + date helper. Credit column only when field present. No row click. **Test:** empty list; discharged row; maternity label; no phone/balance.

**Stage E — Configuration + catalog**  
Compact grids; footer links to existing routes. **Test:** partial `setup` keys; catalog-only user (`system.view_settings`); no “active services”.

**Stage F — Finance / credit**  
Independent compact figures. **Test:** payments-only, credit-only, both, neither (no holes, no fake zeros for omitted keys).

**Stage G — Responsive and a11y**  
`lg` two-column fold; stacked `md`; occupancy `aria-label`; heading levels; keyboard Retry and setup buttons. **Test:** 1280px and ~768px widths.

Do not start a visual “polish” pass that reintroduces `StatCard` or charts.

---

## 17. Things explicitly **not** to add

- Medicine stock, in-stock counts, pharmacy widgets  
- Department staff or per-department service counts  
- Revenue, monthly totals, outstanding balance, Manager charts  
- Fake trends, sparklines, “vs yesterday”  
- Unique lifelong / MRN census  
- Mock or placeholder patients  
- New routes (`/admin/patients`, `/admin/admissions`, `/admin/beds`)  
- Cross-role links to Reception/Nurse  
- `CreditBadge` / balance on the dashboard  
- Recharts, gradients, glass extra layers, neon, giant icons, illustrations  
- New npm packages or a new component library  
- Redesigning Sidebar, TopNav, or other dashboards  
- Changing `mockData.js` or the backend payload  

---

## Implementation note (for the next coding step)

Prefer **local JSX in `AdminDashboard.jsx`** (and a tiny `formatAdmissionDay` in `frontend/src/lib/utils.js` if needed) over new shared widgets. Reuse `PageHeader`, `Button`, `DataTable`, `StatusBadge`. Leave `useAdminDashboard` as the only data source.
