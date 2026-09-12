# Known Issues

Related documents: [ROADMAP.md](./ROADMAP.md) · [SECURITY.md](./SECURITY.md) · [BUSINESS_RULES.md](./BUSINESS_RULES.md)

Items below are observed in the current code. There are **no `TODO` / `FIXME` comments** in application source. `BACKEND_TODO.txt` is a historical checklist, not an open issue list.

---

## Incomplete features

| Item | Evidence |
|------|----------|
| Discharge workflow | `status` includes `discharged` / `pending-discharge`; no route or button completes discharge or frees the bed |
| User management API | Admin Users page reads `mockData.users` only |
| Services / medicines CRUD persistence | Local React state; catalog used for billing is `ServiceCategory` and has no item-level API |
| Departments / doctors / room-charge admin | Read-only mock arrays; room occupancy numbers (e.g. 45 GW beds) disagree with seed (20) |
| Top nav search | Placeholder input, not wired |
| Reception “Today’s Deposits” | Hardcoded `todayDeposits = 125000` from mockData, plus a fake “12% vs yesterday” trend |
| Invoice / receipt hospital header | PatientBilling and DepositReceipt use **mock** `hospitalSettings`, not API settings |
| Pending-record edit on API | Context passes `existingRecordId`; API always inserts a new record |
| Auto charges on GET patient | BACKEND_TODO says this is done; `GET /api/patients/:id` does not call `ensureAutomaticDailyCharges`. API-mode billing page only refetches records |
| Notifications | In-memory list derived from records; not persisted, no push |
| Real PDF / Excel | PDF = browser print; Excel = CSV download |
| Patient `notes` on admit | Sent from AddPatient, not saved |
| `attachUser` middleware | Defined, never mounted |
| VAT on balances | Stored; not used in `calcPatientBalance` |
| Annual report | Uses monthly revenue |

---

## Documentation / demo data contradictions

| Source A | Source B | Conflict |
|----------|----------|----------|
| `README.md` | `App.jsx` | README: mock-only, role cards at `/`. Code: JWT login, `/` → `/login` |
| `users.txt`, BACKEND_TODO | `seed.js`, `mockData.users` | `@stgabriel.et` vs `reception@cc` etc. |
| `mockData.hospitalSettings` | Seeded `HospitalSettings` | Addis Ababa / doctor fee 2000 vs Dire Dawa / fee 1000 |
| `mockData.roomCharges` | Seeded beds | Different bed counts |
| `mockData.services` | ServicesPage columns | Catalog objects use field `Deposite` (typo), not `department` — department column can render empty |

---

## Technical debt

1. **Dual mock/API implementations** in every context — behavior drifts (edit pending, auto charges, deposit objects after admit).
2. **Fat route handlers** with duplicated `audit()` helpers in patients and records routers.
3. **Duplicated validation** (`src/lib/validation.js` vs `server/src/utils/validation.js`) — already slightly different (phone, name length, MRN uniqueness on admit form vs API).
4. **Patient mapper drops** mrn, nationalId, address, admissionReason — frontend duplicate-MRN check against API-loaded patients cannot see `p.mrn`.
5. **`nextPatientId`** sorts `patientId` as a string (`PAT-100` vs `PAT-99` risk).
6. **No Mongo transactions** on admit/transfer.
7. **Record `source` trusted from the client.**
8. **Settings PUT mass assignment.**
9. Unused Radix packages (`dropdown-menu`, `tooltip`).
10. `ServiceTimeline.jsx` still present alongside `RecordTimeline.jsx`.
11. Hardcoded staff names (`CURRENT_NURSE = 'Nurse Almaz Tsegaye'`, `CURRENT_RECEPTIONIST = 'Sara Bekele'`) are still passed as `recordedBy` / `assignedBy` and used for “my pending” filters even in API mode. The API itself stores `req.user.name`; the nurse dashboard pending count will be wrong for any other nurse.
12. `getPatientDeposits` in mock mode can fall back to **global** `depositHistory` for ids that exist there even after state updates.

---

## Potential bugs

| Symptom | Likely cause |
|---------|----------------|
| After several days, admitted patients missing new room/doctor lines (API mode) | Auto charges not generated on read |
| Nurse “edit pending” creates a second pending record (API mode) | No PATCH/update endpoint |
| After admit via API, deposit list may be a synthetic local entry | PatientsContext does not use the API’s created deposit document |
| Low-balance banner ignores Admin threshold changes | Compares to mock 3000 |
| Printed invoice ignores saved hospital name/address | mock `hospitalSettings` |
| Sidebar always shows “Central City Hospital” from mock | `Sidebar.jsx` import |
| Concurrent two receptionists assign the same bed | No transaction / unique occupancy constraint beyond read-then-write |
| Unique index violation on deposit ref → generic 500 | Duplicate key not mapped |
| Login `/me` after admin deactivates user still works | Status not rechecked |
| `toFrontendPatient` `disabledDoctorVisits` lost if object vs array mismatch after some updates | API returns object map; disable path replaces from `updated.disabledDoctorVisits` |

---

## Architectural weaknesses

- Authorization is UI-deep, API-shallow (see [SECURITY.md](./SECURITY.md)).
- Balance computed twice (server and client) with slightly different pending handling (client tracks pending charges separately; server `calcPatientBalance` does not return pending).
- Manager analytics are full-collection in-process reductions ([PERFORMANCE.md](./PERFORMANCE.md)).
- No tests ([TESTING.md](./TESTING.md)).
- README is not the source of truth — **`/docs` is**.

---

## Outdated files to treat as non-authoritative

- `README.md`
- `BACKEND_TODO.txt` (several “done” notes are inaccurate)
- `users.txt`
- `.VSCodeCounter/` reports
