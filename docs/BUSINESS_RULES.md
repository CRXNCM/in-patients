# Business Rules

Related documents: [DATABASE.md](./DATABASE.md) · [API_REFERENCE.md](./API_REFERENCE.md) · [AUTHENTICATION.md](./AUTHENTICATION.md)

Rules below are taken from **implemented** validation and handlers. If a rule exists only in the README or comments and not in code, it is omitted or marked as not implemented.

---

## Identity and access

1. Only users with `status === 'active'` may log in.
2. Failed login always returns the same message: `Invalid email or password`.
3. Frontend routes are restricted by `roleKey`. Backend write APIs for patients and records are **not** restricted by role (only JWT required), except settings (Admin) and manager reports (Manager or Admin).
4. Nurse service-entry UI hides prices (`hideMoney`). This is a UI rule only.

---

## Patient admission

5. Full name is required (server: non-empty; client: not digits-only, min 2 characters).
6. Gender is required.
7. Address is required. Emergency contact and admission reason are **not** collected on admit.
8. Admission date is optional on the admit form. If left blank, the client and API assign **today**. If provided, it must be a valid calendar date and **cannot be after today**.
9. Age or date of birth is required. Age must be between **0 and 120**.
10. A bed must be selected. The bed must exist and have `status === 'available'`.
11. **Initial deposit must be at least 15,000 ETB** (`MIN_INITIAL_DEPOSIT` on both client and server). Zero is not allowed on admit.
12. Payment method is required on the admit form. For `Bank Transfer`, `Ebirr`, or `Other`, a reference number is required (client). Server admit does not re-validate reference uniqueness for the initial deposit.
14. If MRN is provided, no other **non-discharged** patient may have that MRN.
15. If National ID is provided, no other **non-discharged** patient may have that National ID.
16. Client warns (confirm dialog) if another admitted patient has the same name + age. This is a warning only; it does not block if the user confirms.
17. Client phone, if entered, must match Ethiopian mobile pattern `/^(\+251|0)?9\d{8}$/` after stripping spaces/dashes. Phone is optional.
18. New patients receive `patientId` `PAT-` + zero-padded increment from the lexicographically last `patientId`.
19. New patients are created with `status: 'admitted'`.
20. Admit occupies the bed (`occupied`, `patientId` set) and creates a room assignment with reason `Initial admission` and the bed’s current `dailyRate`.
21. If `depositAmount > 0`, a deposit row is created with `isInitial: true` and `patient.depositTotal` is set to that amount. Combined with rule 12, admit always creates a deposit.
22. Automatic daily charges are generated for the admission date (API).
23. Add-patient `notes` are **not stored**.

---

## Active stays

24. Patient list endpoints exclude `status === 'discharged'`.
25. There is **no implemented rule** that a person cannot have two active admissions except via optional MRN / National ID uniqueness. Two admissions with the same name and no MRN/National ID are allowed (client only warns).
26. `pending-discharge` exists on the schema and in mock data. No API or UI sets it except seed/mock.

---

## Deposits and balance

27. Remaining balance (implemented formula):

    `remaining = depositTotal − sum(approved record totals)`

    Pharmacy-return records contribute a **negative** total (credit).

28. Pending and rejected records **do not** change `totalCharges` or remaining balance.
29. Additional deposits must have amount **> 0**.
30. Additional deposits require a payment method.
31. Non-cash methods require a reference number.
32. Deposit reference numbers must be unique (client checks loaded deposits; server checks existing `referenceNumber` values; Mongo also has a sparse unique index).
33. Recording a deposit **adds** the amount to `Patient.depositTotal`. There is no refund, void, or “payment cannot exceed outstanding balance” check. Overpayment is allowed.
34. VAT percent is stored in settings but **is not applied** when computing balance.
34a. Reception can print two invoices from approved charges only: a **summary** invoice (category totals) and a **detailed** invoice (each service listed under its category). Pending records do not appear.

---

## Balance status badges

35. Using threshold `T` (settings `lowBalanceThreshold`, default 3000 in several fallbacks):

    | Status | Condition |
    |--------|-----------|
    | sufficient | remaining ≥ `2T` |
    | low | `T` ≤ remaining < `2T` |
    | critical | remaining < `T` |

36. Patient Billing’s red banner compares remaining balance to **mock** `hospitalSettings.lowBalanceThreshold` (3000), not necessarily the API setting.

---

## Service records

37. A daily record requires at least one service line.
38. A pharmacy return requires at least one return item.
39. Automatic categories (Room Services, Doctor Visits) cannot be added from the cart (`validateServiceCart`).
40. Quantities must be valid positive numbers on the client.
41. If `source === 'reception'`, the record is created as `approved` with an auto-approval audit entry.
42. If `source` is anything else (default `nurse`), the record is `pending`.
43. Reception UI can approve only `pending` records. API rejects approve/reject when status is not `pending`.
44. Frontend reject requires a non-empty reason. API defaults reason to `Rejected by reception` if omitted.
45. Approved daily services add to the bill; approved returns credit the bill; rejected records stay in history and do not affect the bill.
46. Audit actions written by the API: `recorded`, `approved`, `rejected`. Mock mode can also write `edited` when updating a pending record in place.
47. API mode **does not update** a pending record in place; each submit creates a new document. Mock mode updates the existing pending record and appends `edited`.
48. Optional paper-slip field: if filled, the first line’s notes get `Paper slip #<ref>`, and the client may confirm when the same service/qty set already exists today.

---

## Automatic daily charges

49. For each date from `admissionDate` through the generation end date, if a room assignment covers that date, an approved `autoType: 'room'` record is upserted with that assignment’s `dailyRate`.
50. Assignment coverage: `startDate <= date` and (`endDate` is null or `endDate > date`).
51. Room display names are mapped in `BED_TYPES` (General Ward, Private Room, ICU, Operation).
52. For each date, unless the date is in `disabledDoctorVisitDates`, an approved `autoType: 'doctor'` record is upserted using settings `dailyDoctorVisitFee` / `dailyDoctorVisitName` (defaults 2000 and “Daily Doctor Visit” in the service if settings missing).
53. Disabling a doctor visit **deletes** that day’s doctor auto-record. Re-enabling regenerates charges through that date.
54. Discharged patients are skipped by `ensureAutomaticDailyCharges` (status check). Discharge itself is not implemented.
55. On the API, missing later-day auto charges are generated on **admit** and **room transfer**, not on `GET /api/patients/:id`. Opening the billing page in API mode only refetches existing records.

---

## Room transfer

56. Patient must exist and must not be `discharged`.
57. Transfer date, new bed, and transfer reason are required.
58. Transfer date cannot be before admission date or after today.
59. Target bed must be `available`.
60. Transfer to the same room type **and** same bed is rejected.
61. An open assignment (`endDate: null`) must exist.
62. Current bed becomes `available` and `patientId` null; target bed becomes `occupied`.
63. Closed assignment `endDate` is the transfer date; new assignment starts that date with the **current** target bed `dailyRate`.
64. Patient denormalized `room` / `bed` / `bedId` are updated.

---

## Settings

65. Only Admin may update hospital settings or category billing types (API).
66. Changing a category `billingType` changes charge-entry UI behavior after the next categories load/update. It does not rewrite historical records.

---

## Manager reporting (implemented definitions)

67. Today’s / monthly “revenue” = period deposits **plus** approved record totals (returns reduce the charge side).
68. Outstanding balance = sum over current inpatients of `max(0, charges − deposit)`.
69. Occupancy rate = occupied beds / total beds, rounded to integer percent.
70. Top medicines count only lines with `category === 'Pharmacy'`.
71. Annual report uses the **monthly** revenue figure.

---

## Rules that are commonly assumed but **not** implemented

- A patient cannot have two active admissions (except optional MRN/National ID).
- A room type cannot exceed a separate capacity field (capacity is just bed documents).
- Payments cannot exceed outstanding balance.
- VAT is added to the legal bill total used for balance.
- Discharge requires zero balance.
- Nurse cannot approve via API.
- One pending daily record per patient per day (API allows many).
