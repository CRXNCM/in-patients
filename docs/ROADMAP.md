# Roadmap

Ordered by **dependency**: later items assume earlier ones exist. This is an implementation backlog inferred from gaps in the current code, not a committed product plan.

Related: [KNOWN_ISSUES.md](./KNOWN_ISSUES.md) · [SECURITY.md](./SECURITY.md) · [TESTING.md](./TESTING.md)

---

## 0. Documentation hygiene (no product features)

- Point `README.md` at `/docs` and correct login/seed instructions
- Align `users.txt` with `seed.js`
- Remove or archive `BACKEND_TODO.txt` once docs replace it

---

## 1. Authentication hardening

**Depends on:** current JWT login.

- Re-check `User.status` on `/me` and on `authRequired`
- Restrict patient/record/bed **writes** with `requireRole('Reception')` / nurse-only submit
- Ignore client `source`; derive it from `req.user.role`
- Rotate `JWT_SECRET`; stop shipping demo passwords in production builds
- Optional later: refresh tokens, password change, lockout

---

## 2. Users

**Depends on:** 1 (role enforcement).

- `GET/POST/PATCH /api/users` (Admin)
- Wire Admin Users page to the API
- Invite / deactivate without seed-only accounts

---

## 3. Patients (data completeness)

**Depends on:** 1.

- Include mrn, nationalId, address, admissionReason, contacts in mappers
- Persist admit `notes` or drop the field from the form
- Fix `nextPatientId` numeric increment
- Generate auto charges on patient GET **or** via a daily job (pick one; document it)
- Add `PATCH` (or upsert) for today’s pending nurse record

---

## 4. Admissions / discharge

**Depends on:** 3, beds.

- Explicit discharge endpoint: set `discharged`, free bed, close assignment, stop auto charges
- Clearance rule (e.g. warn if remaining balance ≠ 0) — **not implemented today; define before coding**
- `pending-discharge` transition if still required

---

## 5. Rooms and beds

**Depends on:** 4 for occupancy correctness.

- Admin API to change daily rates (decide whether existing assignments stay locked — they already lock `dailyRate`)
- Replace mock Room Charges page with live bed aggregation
- Occupancy unique constraint / transactions on admit + transfer

---

## 6. Billing catalog

**Depends on:** settings already present.

- CRUD for `ServiceCategory.services` (and optionally categories)
- Retire Admin Services / Medicines mock pages or point them at the catalog
- Server-side price lookup so clients cannot invent unit prices

---

## 7. Payments / deposits

**Depends on:** 3.

- Map duplicate-key errors to 400
- Optional: void/reverse deposit with audit
- Reception dashboard “Today’s Deposits” from API, not `125000`

---

## 8. Reports and dashboard

**Depends on:** 7 for truthful cash figures.

- Fix annual report period
- Date-range filters
- True PDF if required (library choice not in repo)
- Replace hardcoded reception KPIs

---

## 9. Notifications

**Depends on:** records API.

- Persist notifications or poll `/api/records/pending`
- Role-targeted server events (optional WebSocket — not present now)

---

## 10. Audit logs

**Depends on:** 1–2.

- Collection for login, settings changes, discharge, deposit voids
- Keep embedding `auditTrail` on records for clinical/billing line history

---

## 11. Settings UX consistency

**Depends on:** existing settings API.

- Drive Sidebar, Login branding, invoice, and receipts from `BillingConfigContext.settings`
- Decide whether VAT applies to balance (currently stored only)

---

## 12. Quality bar

**Depends on:** stable APIs from 1–6.

- Automated tests ([TESTING.md](./TESTING.md))
- Pagination and aggregates ([PERFORMANCE.md](./PERFORMANCE.md))
- Remove or quarantine mock mode if production will never use it
- Helmet, rate limit, allowlisted settings updates

---

## Suggested first vertical slice

If only one increment is funded:

1. Role-enforce write APIs + derive `source` from JWT  
2. Auto-generate daily charges on patient read  
3. Pending-record update endpoint  
4. Wire invoice/receipt to API settings  
5. Discharge + free bed  

That sequence unlocks a trustworthy in-patient stay without building a new product area.
