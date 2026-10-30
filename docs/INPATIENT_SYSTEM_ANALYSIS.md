# CITY CENTRAL GENERAL HOSPITAL
# INPATIENT MANAGEMENT SYSTEM
## Complete System Analysis

This summary describes the system as it is implemented today. It is an inpatient stay, nursing documentation, service-approval, and deposit-visibility system. It is not a full hospital information system, and it does not process electronic payments.

The software’s stored hospital name is a setting. A fresh installation is labeled **Central City Hospital**, Konel, Dire Dawa, currency **Ethiopian Birr (ETB)**. An administrator can change that name, address, and receipt text before a demonstration. Until that is done, screens will not say “City Central General Hospital.”

---

## 1. Executive Summary

This system replaces the handwritten inpatient file for the part of the hospital stay that starts when a patient is admitted and ends when reception completes discharge. One digital stay holds who the patient is, which bed they occupy, which doctors are visiting, what nurses recorded, which services reception has accepted, what deposits have been taken, and whether the stay is still open.

Four people actually sign in for day-to-day work: reception, the nurse, the administrator, and the manager. Doctors are kept as a hospital catalog and are assigned to stays. A doctor does not have a working clinical login in the seeded system. A “Doctor” permission template exists, but it only opens a view-only nursing screen and is not a physician workstation.

Reception admits the patient, chooses an available bed, optionally assigns visiting doctors, and records an opening deposit or marks the stay as credit. From that moment the bed is occupied. Each day the stay is open, the system can place a room charge from the bed’s daily rate and a visit charge for each assigned doctor. Those charges are created when the admission is saved and again when the patient’s billing record is opened. They are not produced by a background clock that runs overnight.

Nurses work from a ward list. They write clinical notes that do not create charges, and they build a day’s service record from the hospital catalog: pharmacy, supplies, consumables, laboratory, procedures, and radiology. Prices are hidden from the nurse. The record stays pending until reception approves or rejects it. Only an approved record changes the patient’s bill. A rejected record stays in the history and does not.

Reception sees pending nurse records, the patient’s deposits, approved charges, and the remaining balance. Reception can add further deposits, move the patient to another available bed, turn off a doctor-visit charge for a day the doctor did not come, print a deposit receipt, and print a summary or detailed invoice from approved charges only. Pending items are visible as “not yet on the bill.”

Discharge is a two-step clinical and administrative handoff. The nurse requests discharge. The patient stays in the same bed, and daily charges continue, until reception completes it. Reception cannot complete discharge while any service record is still pending. A patient who was not admitted on credit cannot leave with an unpaid balance. A credit patient can, unless the administrator turns that allowance off. On completion the bed becomes available, doctor assignments end, and the stay is locked: no new services, notes, deposits, or bed moves. The record remains readable.

Management and administration see the current census, bed occupancy, today’s deposits, approved charges, outstanding balances, and credit stays, without walking the wards or collecting paper slips. Accountability comes from named users, timestamps, approval state, and an edit history on service records and clinical notes.

The system reduces specific sources of manual error: a bed shown as free when it is taken, a service with no price, a charge added to the bill before reception has checked it, and a discharge completed while records are still unsigned. It does not remove clinical judgment, and it does not itself collect money from a bank or mobile-money service.

---

## 2. Problem the System Was Built to Solve

The previous inpatient workflow depended on handwriting and verbal handoff. The problems that this system actually addresses are:

- Finding a patient meant searching paper or asking another desk.
- Admission, bed, doctor, and deposit were often written in different places.
- Bed occupancy was not updated in one shared list, so two people could believe the same bed was free.
- Services given on the ward were written on slips that reception later had to interpret and price.
- There was no shared state for “recorded, not yet accepted onto the bill” versus “accepted.”
- Room and doctor charges depended on someone remembering each day.
- Nurses, reception, and administration did not see the same stay status.
- Discharge could happen while charges or unsigned slips were still outstanding.
- After discharge, paper files were hard to reopen in one place, and it was unclear who had written or approved each line.
- Management could not see how many patients were in house, which beds were full, which stays were on credit, or which approved services were accumulating, without asking each unit.

---

## 3. System Overview

Staff sign in with a personal account. Each person lands on the home screen for their job: reception, nursing, administration, or management.

The working unit is one inpatient stay. The stay receives an identifier such as `PAT-001`. That stay holds demographics, admission date, status, bed, deposits, assigned doctors, service records, clinical notes, and, for a maternity admission, one newborn recorded under the mother.

Information moves in one direction for billable care:

1. Administration maintains the catalog of services and prices, the doctor list and visit prices, departments and wards, rooms and beds, staff accounts, and hospital rules such as the minimum opening deposit.
2. Reception opens the stay and places the patient.
3. Nursing documents care and submits what was done.
4. Reception reviews nurse submissions before they affect the bill.
5. The system keeps room and doctor-visit charges from the assignment, not from a handwritten daily sheet.
6. Reception completes discharge only after pending records are cleared and the balance rule is satisfied.
7. Management reads the resulting census and money picture. Management does not admit, approve, or discharge.

A shared search box can find patients by name, patient ID, medical record number, or phone, and, for staff who are allowed, doctors, rooms, beds, departments, wards, and users.

---

## 4. Users & Roles

People who sign in use one of four application areas. Extra role templates exist for an administrator to assign, but they are not separate products and no sample user is created for them.

| Role | Who they are | What they see | What they create | What they edit | What they approve | What they cannot do |
|---|---|---|---|---|---|---|
| **Reception** | Front desk for inpatient admission, deposits, and discharge clearance | Current and discharged stays, beds, doctors, deposits, balances, pending nurse records, clinical notes (read only) | New stays, deposits, credit admissions, doctor assignments, their own service lines | Pending records they are allowed to change; bed transfers; doctor-visit on/off for a day; newborn details on a maternity stay | Nurse service records and pharmacy returns. Their own entries are accepted immediately | Request discharge (that is the nurse). They do not write clinical notes. They cannot change a service price in the catalog |
| **Nurse** | Ward nurse documenting the stay | All current inpatients, room and bed, assigned doctors, own submissions, clinical notes. **No prices, deposits, or balances** | Clinical notes, pending service records, pharmacy returns, doctor assignments, discharge requests, newborn details | Their own notes; a pending service record before reception acts | Nothing financial | Approve or reject records, take deposits, discharge the patient, see money |
| **Administrator** | Hospital administrator configuring the operation | Census, beds, catalog, doctors, users, settings, and the same clinical and financial records as a full-access user | Staff, roles, doctors, departments, wards, rooms, beds, catalog items, settings | The same, including other people’s clinical notes | Service records, because this role includes reception’s approval right | — |
| **Manager** | Owner or finance oversight | Census, occupancy, deposits, approved charges, outstanding balances, credit patients, discharged stays, reports, clinical notes (read only) | Nothing in the inpatient workflow | Nothing | Nothing | Admit, record services, approve, take payment, or discharge |

**Responsibility in the stay**

- Reception owns admission, money recorded against the stay, acceptance of nurse charges, bed moves, and final discharge.
- The nurse owns the clinical note and the statement of what was done, and starts discharge.
- The administrator owns the lists and rules everyone else uses: prices, doctors, beds, who may sign in, and whether credit discharge is allowed.
- The manager watches the operation and the money picture and does not change the stay.

**Other role templates (not everyday logins)**

| Template | Status | What it actually does |
|---|---|---|
| Super Admin | Implemented as a full-access administration role | Same screens as Admin |
| Night Reception | Implemented as a reduced reception role. No sample user | Can register and admit and see beds and notes. Cannot take payments, approve services, or discharge |
| Finance | Implemented as a copy of the Manager permissions. No sample user | Same oversight screens as Manager |
| Doctor | **Partially implemented** | A role named Doctor exists. If someone is given it, they enter the **nurse** screens with view-only access to patients, admissions, the doctor list, and clinical notes. They cannot write notes, assign doctors, or record services. The role description in the system says detailed clinical permissions are a later step. **Doctors do not have their own workstation.** |

Seeded sign-in accounts are reception, nurse, administrator, and manager only.

---

## 5. Complete Patient Journey

```
PATIENT ARRIVES
↓
Reception registers the stay (new record, not a search of old episodes)
↓
Bed is chosen from beds marked available
↓
Opening deposit is taken, or the stay is marked credit
↓
Visiting doctors may be attached (optional)
↓
Stay status = Admitted. Bed = Occupied
↓
Room charge begins from the bed rate. Doctor-visit charges begin for each assigned doctor
↓
Nurse writes notes and submits catalog services / pharmacy returns (pending)
↓
Reception approves or rejects those records
↓
Approved lines join the bill. Further deposits can be recorded. Bed can be changed
↓
Nurse requests discharge → Pending discharge (bed still occupied)
↓
Reception clears pending records and the balance rule, then completes discharge
↓
Bed becomes available. Doctor assignments end. Stay is locked but remains readable
```

**1. Registration / search**  
Reception creates a new stay. They can also search an existing stay. This is not a lifelong master patient index: each stay is its own record. A warning appears if another admitted patient has the same name and age; the user can continue. A medical record number or national ID cannot be reused on another open stay. Because those numbers are unique on the record itself, the same number cannot be used to open a second stay after discharge either.

**2. Admission**  
Reception enters name, age or date of birth, gender, address, optional phone, optional medical record number and national ID, admission date (today if left blank; not a future date), bed, payment mode, and optional doctors. Admission type is normal or maternity.

**3–4. Placement and bed**  
A bed must be available. On save it becomes occupied and a room assignment is stored with the reason “Initial admission” and that bed’s daily rate.

**5. Doctors**  
Optional at admission. Reception, the nurse, or an administrator can add another visiting doctor later, or end an assignment. Charges use the price that was current when the doctor was assigned.

**6–7. Nursing and services**  
The nurse opens the stay, writes notes, and builds a service record or a pharmacy return from the catalog.

**8. Approval**  
Nurse submissions wait for reception. Reception’s own entries are approved at the moment they are saved.

**9. Billing visibility**  
Approved charges, deposits, and remaining balance are visible to reception, administration, and management. Nurses do not see amounts.

**10. Status**  
Admitted, then pending discharge, then discharged.

**11–12. Discharge**  
Nurse requests. Reception reviews on the stay or on the pending-discharge list, and either sends the patient back to admitted or completes discharge.

**13. After discharge**  
The stay can be opened. Notes, services, deposits, and the final room and balance snapshot remain. New notes, services, returns, deposits, doctor assignments, and bed moves are refused.

**Not in this journey:** a planned discharge date, an emergency-contact form, an admission-diagnosis form, a separate previous-admission list for the same person, or a payment collected through a bank or Ebirr integration. Ebirr can be recorded as the method of a deposit that staff entered by hand.

---

## 6. Patient Management

| Capability | Status | How it works |
|---|---|---|
| New patient registration | **IMPLEMENTED** | Reception “Add Patient” creates the stay and the patient identifier together |
| Existing patient search | **IMPLEMENTED** | Top search by name, patient ID, medical record number, or phone. Opens that stay |
| Patient identification | **IMPLEMENTED** | System ID (`PAT-…`). Optional medical record number and national ID |
| Demographics | **IMPLEMENTED** | Name, age, optional date of birth, gender, address. Gender is Male, Female, or Other |
| Contact information | **PARTIALLY IMPLEMENTED** | Phone is optional and checked as an Ethiopian mobile number. It is not required |
| Emergency contact | **NOT IMPLEMENTED** in the admission screen | A place for it exists in storage and is not collected or shown as part of admission |
| Patient status | **IMPLEMENTED** | Admitted, pending discharge, discharged |
| Current admission | **IMPLEMENTED** | The stay itself is the current admission |
| Admission history / previous admissions | **PARTIALLY IMPLEMENTED** | The profile shows this one stay and its room history. It states that the application stores one stay per patient record. There is no episode list for return visits |
| Credit identification | **IMPLEMENTED** | Credit is shown on lists and on the stay until deposits reach the required opening amount |
| Medical information | **NOT IMPLEMENTED** as a chart | No problem list, allergies, medications list, or vital-signs chart |
| Clinical notes | **IMPLEMENTED** | Free-text notes for this stay, separate from charges |
| Service records | **IMPLEMENTED** | Daily service batches and pharmacy returns |
| Doctor information | **IMPLEMENTED** | Assigned visiting doctors with specialty and visit price snapshot |
| Room and bed | **IMPLEMENTED** | Current room type and bed label, plus assignment history |
| Discharge information | **IMPLEMENTED** | Who requested, who completed or rejected, when, notes, and the closing charges, deposits, and balance |

Demographics **cannot be corrected after admission**. There is no “edit patient details” action. What can change during the stay is the bed, the doctors, the newborn record, notes, services, and deposits.

---

## 7. Admission Management

**Who creates it:** Reception, or an administrator using the same admission right. Night-reception staff can also admit if that role is assigned, but they cannot take the deposit.

**Required information:** full name, gender, address, age or date of birth (age 0–120), and an available bed. Admission date defaults to today and cannot be in the future.

**Optional:** phone, medical record number, national ID, visiting doctors, and, when credit is allowed, a zero or partial payment.

**Payment at the door:** a paid admission requires at least **15,000 ETB** unless an administrator changes the minimum. Payment method is required. Bank transfer, Ebirr, and Other require a reference number. A credit admission may pay nothing now; the required amount is still remembered. The stay stays marked credit until later deposits reach that required amount. Later deposits are extra receipts. They do not rewrite the first one.

**Statuses**

| Status | Meaning |
|---|---|
| Admitted | In house. Bed occupied. Services, notes, deposits, and bed moves allowed |
| Pending discharge | Nurse has asked reception to close the stay. Bed still occupied. Daily charges continue. Bed transfer is blocked |
| Discharged | Stay closed and locked |

**Room and doctor assignment:** chosen at admission and changeable afterward until the limits above.

**Expected discharge date:** **NOT IMPLEMENTED.**

**Who can change the stay:** reception and administration can transfer the bed, assign or end doctors, record deposits, and complete or refuse discharge. The nurse can add doctors, notes, and services, and can request discharge. Nobody can edit the original demographic form.

**On discharge:** charges are brought up to date through the discharge date, pending records must be cleared, the balance rule is applied, the room assignment is closed, the bed is freed, and active doctor assignments are ended. The closing charges, deposits, and balance are stored on the stay.

---

## 8. Room & Bed Management

Beds are the operational unit. Each bed has a label (for example `GW-01`), a room type, a daily rate, and a status: **available, occupied, maintenance, or out of service**.

A fresh installation creates 44 beds that are not yet placed inside named wards:

| Room type | Beds | Daily rate |
|---|---|---|
| General Ward | 20 | 1,500 ETB |
| Private Room | 12 | 5,000 ETB |
| ICU | 8 | 8,000 ETB |
| Operation | 4 | 10,000 ETB |

**Departments and wards are a second, real structure.** The baseline list is Internal Medicine, Surgery, Obstetrics and Gynecology, Pediatrics, Neonatology (including NICU), Critical Care (ICU), Orthopedics, and Emergency, each with named wards. Those wards do not automatically contain the 44 beds. An administrator attaches real rooms and beds to a ward in Hospital Setup, including a Delivery Room type, one room at a time or in bulk.

**How availability works:** admission and transfer only offer beds whose status is available. Saving the admission marks the bed occupied and stores the patient on it. Discharge marks it available again. Maintenance and out-of-service are set by administration, not by the clinical workflow.

**Reassignment:** reception can move an admitted patient to another available bed, with a date and a reason. The move cannot be before admission or after today, and it cannot be the same bed. The old assignment ends on the transfer date. The new daily rate applies from that date. A patient who is pending discharge cannot be moved.

**What this replaces:** a handwritten bed board that reception and the ward can disagree about. The shared list is the board. It is updated when someone admits, transfers, discharges, or an administrator changes bed status. It is not a live sensor on the bed.

**Ward filters for nurses** work when a bed is linked to a ward. The original 44 beds have a room type but no ward, so a ward filter only becomes useful after Hospital Setup links beds to wards. There is no separate one-click list named “all surgical patients” or “all NICU patients.” Staff filter by room type, ward name, or stay status.

**Important screen limitation:** the administrator page titled Room Charges still shows sample figures (for example 45 general-ward beds). Those numbers are not the live bed list. Live occupancy is on the administrator and manager dashboards and in Hospital Setup.

---

## 9. Doctor Management

Doctors are a catalog, not users.

An administrator adds a doctor with name, specialty, visit price, optional phone, and optional department text, and can mark the doctor inactive. Specialties in the form are General Practitioner, Internal Medicine, Surgeon, Pediatrician, Gynecologist, Cardiologist, Orthopedic Specialist, Dentist, Radiologist, and Other.

**No doctor schedule, shift, or clinic session is implemented.**

**Assignment:** at admission or later, reception, the nurse, or an administrator selects one or more active doctors. The assignment stores the doctor’s name, specialty, and visit price as they were at that moment. Later price changes do not rewrite days already billed. An inactive doctor cannot be newly assigned. Existing assignments remain.

**Charges:** one approved visit line per assigned doctor per covered day, from the assignment start date forward, not before admission and not after today. If no doctor is assigned, there is no visit charge. Reception can switch off a specific day when the doctor did not visit; that day’s visit line is removed and can be restored.

**History:** assignments have a start, an end, who assigned them, and who ended them. Discharge ends the active ones.

**Clinical value:** the ward and reception can see who is responsible for visits and from which day the visit fee applies, without a separate paper “doctor on the chart” that billing never sees. The doctor is not notified inside this system and does not sign in to read the stay unless an administrator gives them the limited Doctor template, which is view-only.

---

## 10. Nursing / Clinical Workflow

The nurse home screen is a ward overview with no billing access.

It shows:

- How many patients are admitted
- How many are pending discharge
- How many of **this nurse’s** service records are still awaiting reception
- A short list of patients pending discharge
- A census of current inpatients with room, bed, ward (when known), room type, admission date, normal or maternity, status, and assigned doctors
- Filters for room type, ward, and status
- That nurse’s recent submissions and whether each is pending, approved, or rejected

Opening a patient shows identity, phone, admission date, room and bed, status, and credit mark (the word credit, not the amount). From there the nurse can:

- Write and edit their own clinical notes
- Register or update one newborn on a maternity admission (name, sex, date and time of birth, birth weight, delivery type, notes, admitted or discharged as a subject)
- Add or end visiting doctors
- Record today’s services or a pharmacy return
- See the history of records for this stay, still without prices
- Request discharge while the patient is admitted

**Notes versus services.** A clinical note is narrative. It never creates a charge. A service record is the structured list of what should be billed after reception accepts it.

**Editing.** The nurse can change a service record only while it is still pending. After approval it is locked. The nurse can edit their own notes and the previous wording is kept. They cannot edit another nurse’s note. After discharge, notes are read-only and new services are refused.

**Compared with handwriting:** the nurse selects a named catalog item instead of writing a drug or test in free text; the record is tied to this patient and this day; reception sees the same submission without a paper slip being carried to the desk; the nurse can see whether reception has accepted it; and the patient can be found by bed, ward, or name instead of by asking who has the file. The nurse still decides what was done. The system does not suggest orders or check doses.

There is no nursing-report template, vital-signs chart, medication administration record, or shift handover document beyond the free-text note.

---

## 11. Services & Procedures

Services come from an administrator-maintained catalog. Seeded categories are:

| Category | How it is entered | Examples |
|---|---|---|
| Pharmacy | Quantity | Paracetamol, ceftriaxone, IV fluids, insulin |
| Medical supplies | Quantity | Oxygen, monitor use, wheelchair |
| Consumables | Quantity | Gloves, cannula, gauze, urine bag |
| Laboratory | Select quantity | CBC, malaria, HIV, chemistry panels |
| Procedures | Select quantity | Dressing, suturing, oxygen therapy, ECG, minor surgery |
| Radiology | Select quantity | X-ray, ultrasound, CT, MRI |
| Doctor visits | Automatic | One line per assigned doctor per day |
| Room services | Automatic | One line per day from the bed assignment |

An administrator can add categories and items, set a subcategory and a unit, change a price, deactivate an item, and import a spreadsheet of new items. Existing items are skipped on import. Subcategory is a label for catalog organization. The nurse still picks the item by name; there is no separate “variant” such as small/medium that changes the price by itself.

The nurse searches within the open category, ticks items, sets quantity, and can add a short note and an optional paper-slip number. Room and doctor categories cannot be typed in by hand. Pharmacy returns are a separate list: medicine, quantity, and reason. An approved return reduces the bill.

Each saved record stores who submitted it, when, the lines, and a trail of recorded, edited, approved, or rejected. Prices on nurse-submitted lines are taken from the catalog at submission, not typed by the nurse.

Several records can exist for the same patient on the same day. The system does not force “one sheet per day.”

---

## 12. Service Approval Workflow

**Nurse records what was done.** The record is saved as pending. It is visible on the nurse’s history and on reception’s pending list. It does not change the balance.

**Reception reviews.** The pending-approvals screen and the reception dashboard show the patient, record type (daily services or pharmacy return), who recorded it, when, the lines, and the amount. Reception can approve or reject. Rejection requires a reason on the screen. The record keeps that reason.

**If reception enters the service themselves,** the record is approved immediately and marked as a reception entry. It does not wait in the nurse queue.

**After approval,** the amount is included in approved charges, invoices, dashboards, and the discharge balance. **After rejection,** the record remains visible and is excluded from the bill.

**Edits.** A pending record can be changed in place. An approved record cannot be edited, repriced, deleted, or moved back to pending by normal use.

**After discharge,** new records and returns are refused.

**Discharge is blocked** while any record for that stay is still pending, including a pharmacy return.

---

## 13. Financial / Billing Visibility

This is deposit-and-charge visibility for an inpatient stay. It is not an accounts package, and it does not take a card or mobile-money payment.

**A. What is recorded**

- Catalog prices and doctor visit prices
- The daily rate locked onto each room assignment
- Each deposit: amount, method (cash, bank transfer, Ebirr, or other), reference when required, date, and who received it
- Whether the admission was paid or credit, and the required opening deposit
- Approved, pending, and rejected service totals
- A closing snapshot of charges, deposits, and balance at discharge

**B. What is displayed**

- Reception: total deposits, approved charges, remaining balance (deposits minus approved charges), and pending charges shown separately as not on the bill
- Balance bands against a threshold (default 3,000 ETB): sufficient at or above twice the threshold, low between the threshold and twice that, critical below the threshold
- A critical-balance list for reception
- Printable deposit receipt
- Printable invoice, summary by category or detailed by line, from **approved** charges only
- Manager: today’s and this month’s deposits and approved charges, seven-day trend, category mix, top services, top pharmacy lines, outstanding balances, credit patients, and discharged stays
- Nurses: no amounts

**C. Actual payment processing**  
**NOT IMPLEMENTED.** Staff type the amount they already received. There is no connection to a bank, Ebirr, or a cash drawer. Overpayment is allowed. There is no refund or reversal document. If deposits exceed charges at discharge, the extra is only stored on the snapshot.

**D. Not implemented or only partial**

- VAT can be typed in settings and, if set above zero, is shown beside charges on the billing screen. It is **not** added into the balance used for discharge. The default is 0%
- No cashier shift, no general ledger, no insurance claim
- “Revenue” on the manager dashboard adds deposits and approved charges together. That is a visibility total, not audited hospital revenue
- The annual report figure follows the monthly total. Treat annual reporting as **partially implemented**
- Reports can be printed or saved through the browser, or downloaded as a spreadsheet-style file. There is no separate accounting PDF engine

**Balance used everywhere that matters:**

Remaining = deposits − approved charges  
Outstanding for discharge = the amount by which approved charges exceed deposits, if any

Pending and rejected records do not change that balance.

**Credit rule:** a non-credit patient with money still owing cannot be discharged. A credit patient can be discharged with money still owing while the hospital setting allows it. That setting is on by default and an administrator can turn it off. The amount still owing stays on the closing snapshot. It is not automatically written off.

---

## 14. Patient Status & Discharge

| Status | Who changes it | What is still allowed |
|---|---|---|
| Admitted | Set at admission | Notes, services, deposits, doctor changes, bed transfer, discharge request |
| Pending discharge | Nurse requests. Reception or administration can reject the request and return the patient to admitted | Notes, services, and deposits continue. Bed transfer stops. Daily room and doctor charges continue |
| Discharged | Reception or administration completes it | Read only. Bed released. Doctor assignments ended |

**Completion checks**

- The stay must be pending discharge
- Every service and return record must be approved or rejected
- Automatic charges are generated through the discharge date first
- A non-credit patient must not owe money
- A credit patient may still owe money only if the hospital setting allows it

**After discharge the bed is available** for the next patient, provided it was occupied by this patient. Assigned doctors are ended as of the discharge date. The final room and bed remain visible as the last location. Notes, service history, deposits, and the closing balance remain on the stay.

This matters because the ward and the desk share one status. A patient is not “gone” on the nurse’s list and “still here” on the bed book. The bed is not freed when the nurse merely asks for discharge. It is freed when reception finishes the stay.

---

## 15. Permissions & Accountability

| ROLE | VIEW | CREATE | EDIT | APPROVE | DISCHARGE | FINANCIAL ACCESS |
|---|---|---|---|---|---|---|
| Reception | Patients, stays, beds, doctors, notes | Stays, deposits, doctor assignments, service lines | Bed, doctors, pending records, newborn | Nurse records | Complete or refuse. Cannot request | Deposits, balances, invoices, credit |
| Nurse | Patients, stays, beds, doctors, notes | Notes, pending services, doctor assignments | Own notes; pending services; newborn | No | Request only | None |
| Administrator | All of the above plus setup | Users, roles, catalog, doctors, rooms, beds, settings | All of the above, including others’ notes | Yes | Complete or refuse | Yes |
| Manager | Patients, stays, notes, finance, reports | No | No | No | No | View and export |
| Night Reception (template) | Patients, stays, beds, notes | Stays | Limited | No | No | No |
| Doctor template | Patients, stays, doctors, notes | No | No | No | No | No |
| Finance template | Same as Manager | No | No | No | No | View and export |

**How actions are traced**

- Service records store who submitted, who approved, when, and a trail: recorded, edited, approved, rejected, with a note
- Clinical notes store the author, time, an edited flag, and the previous text. Administrators can see that history. A void action exists for administrators on the server; the notes screen shows a “voided” mark but does not offer a void button, so voiding is **not part of normal screen use**
- Deposits store who received them
- Room assignments store who assigned them and why
- Doctor assignments store who assigned and who ended them
- Discharge stores who requested, who rejected or completed, when, and the optional note
- User and role changes are written to a security log that an administrator with audit access can read through the system interface’s data service. There is **no audit-log screen** in the navigation
- Login is personal. A shared “nurse” name is not what the server stores; it stores the signed-in person’s name

**Limits of accountability:** there is no full chart audit of every page view. Patient demographic changes cannot be audited because they cannot be made. Refunds are a permission name without a refund workflow. Deleting a patient is a permission name without a delete workflow.

---

## 16. Dashboards

**Reception — “Reception Dashboard”**  
Used by the front desk. It shows admitted count, pending discharges, pending approvals, today’s deposits, how many current stays are below a comfortable balance, a short pending-approval list with amounts, and the current inpatient list with room, bed, deposit, charges, and remaining balance. From here staff can open a stay, approve or reject, or start an admission. It supports the decision “what is waiting on the desk, and who is running out of deposit?”

**Nurse — “Ward overview”**  
Used by nursing. Admitted count, pending discharge, this nurse’s unsigned records, patients waiting for discharge clearance, and the current inpatient census with filters. The action is “Record,” which opens documentation. It supports “who is in house, where, which doctor, and what I still have waiting.”

**Administrator — “Command overview”**  
Used by administration. Admitted, admitted today, pending discharge, discharged today, bed totals (occupied, available, maintenance, out of service, occupancy percent), counts of departments, wards, rooms, beds, doctors, and users, catalog size, today’s deposits, and the number of open credit stays. It supports “is the hospital configuration and the current census in one place?”

**Manager — “Executive Dashboard”**  
Used by the owner or finance lead. Census, bed occupancy, deposits today and this month, approved charges today and this month, discharge amounts, outstanding balance, credit count, a seven-day charge trend, category mix, top services, top medicines, a low-balance watchlist, and recent admissions. It supports “what is the inpatient operation doing, and where is money sitting?” It does not admit or approve.

**Other management screens, not the home dashboard**

- Deposits, revenue and charges, outstanding balances, and credit patients, each with a period control
- Discharged patients with the closing balance
- Reports: daily, weekly, monthly, annual, category revenue, deposits, outstanding, billing history, and occupancy, for print or spreadsheet download
- Reception also has critical balances, pending approvals, recently approved, pending discharges, and discharged lists

Figures update when the screen is opened or refreshed. They are not a wall display that updates by itself every few seconds.

---

## 17. Search & Information Retrieval

| Need | Where it works |
|---|---|
| Patient by name, ID, medical record number, or phone | Top search, all signed-in roles who may see patients. Discharged stays are included |
| Doctor by name or specialty | Top search for roles allowed to see doctors. Opens the doctor list, not a single doctor page |
| Room, bed, department, ward, user | Top search for administration |
| Room type, ward, stay status | Nurse census and nurse patient list |
| Pending versus approved services | Reception approval screens and the stay history |
| Low or critical balances | Reception critical-balance list and manager watchlist |
| Credit stays | Manager credit list; credit mark on patient lists |
| Discharged stays | Reception and manager discharged lists |
| Catalog item | Search inside the category while recording services; search on the catalog screen |
| Date | Admission date on lists; manager finance screens filter by day, week, or month |

The reception “all patients” list itself has no type-in filter. Staff use search or open the list and scan. Nurse lists filter by place and status, not by doctor name or by a surgical/ICU button unless that ward or room type was set up and selected.

This removes walking to another office to ask whether a named patient is admitted and which bed they are in, as long as the stay was entered.

---

## 18. Transparency & Accountability

**One stay instead of scattered papers**  
CURRENT MANUAL PROBLEM: admission, bed, drugs, and deposits lived on different sheets.  
SYSTEM SOLUTION: one stay holds identity, bed, doctors, notes, services, deposits, and status.  
OPERATIONAL BENEFIT: reception, nursing, and management open the same stay.

**Named author and time**  
CURRENT MANUAL PROBLEM: a slip often had an unclear signature.  
SYSTEM SOLUTION: submissions, approvals, deposits, assignments, notes, and discharge actions store the signed-in person and the time.  
OPERATIONAL BENEFIT: a disputed line can be traced to a person and a moment.

**Pending versus approved**  
CURRENT MANUAL PROBLEM: a ward slip could be billed before anyone checked it, or lost so it was never billed.  
SYSTEM SOLUTION: nurse records stay off the bill until reception approves them. Rejection keeps the record and the reason.  
OPERATIONAL BENEFIT: the bill and the ward statement can be compared, and discharge cannot finish while a record is still unsigned.

**Structured catalog lines**  
CURRENT MANUAL PROBLEM: handwriting and missing prices.  
SYSTEM SOLUTION: items are chosen from named catalog entries with a stored price. Nurses do not type the price.  
OPERATIONAL BENEFIT: the same drug or test is named consistently, and the price reception sees is the catalog price.

**Bed status**  
CURRENT MANUAL PROBLEM: the bed book and the ward disagreed.  
SYSTEM SOLUTION: admit occupies the bed, transfer swaps it, discharge frees it.  
OPERATIONAL BENEFIT: the next admission is offered only beds the system still marks free.

**Doctor assignment with a price snapshot**  
CURRENT MANUAL PROBLEM: visit fees were remembered or disputed after the doctor’s rate changed.  
SYSTEM SOLUTION: each assignment keeps the price from the day it was made, and each covered day can generate a visit line.  
OPERATIONAL BENEFIT: billing follows who was actually assigned, from which day.

**Credit and balance bands**  
CURRENT MANUAL PROBLEM: credit patients and low deposits were tribal knowledge.  
SYSTEM SOLUTION: credit is marked on the stay; remaining balance is deposits minus approved charges; low and critical bands are listed.  
OPERATIONAL BENEFIT: the desk and the manager can see who is uncovered without recalculating each file.

**Discharge lock**  
CURRENT MANUAL PROBLEM: charges were added after the patient had left, or the bed stayed “occupied” on paper.  
SYSTEM SOLUTION: completion frees the bed, ends doctor assignments, and refuses new charges, notes, and deposits.  
OPERATIONAL BENEFIT: the closed stay stays stable, and the bed can be reused.

**Role separation**  
CURRENT MANUAL PROBLEM: anyone holding the file could write a charge or see a balance.  
SYSTEM SOLUTION: nurses document without seeing money; managers see money without changing the stay; reception accepts charges and handles discharge clearance.  
OPERATIONAL BENEFIT: duties match the desk, the ward, and the office.

---

## 19. Old Manual Workflow vs New Digital Workflow

| Area | Old workflow | System workflow | Practical benefit |
|---|---|---|---|
| Patient registration | New page in a book or folder | Reception creates one stay with required identity fields and a system ID | The stay has one identifier everyone can search |
| Admission | Separate notes for bed, doctor, and deposit | Bed, optional doctors, and deposit or credit are part of the same admission | The stay is not “admitted” without a bed |
| Patient lookup | Ask the ward or flip registers | Search by name, ID, record number, or phone | Less time locating the current file |
| Room and bed | Manual bed board | Occupied and available states updated by admit, transfer, and discharge | Fewer double bookings of a bed the system already holds |
| Doctor assignment | Name written on the chart | Named doctor, specialty, start and end, and a fixed visit price | Visit charges follow the assignment |
| Nursing documentation | Narrative in a paper note | Free-text notes on the stay, with author and edit history | The note stays with the stay and shows who wrote it |
| Service recording | Handwritten slip | Catalog selection, quantity, and a saved record | Names and quantities are structured |
| Service approval | Verbal or stamp on the slip | Pending, then approve or reject with a reason | Unchecked work cannot silently join the bill |
| Price visibility | Nurse sometimes wrote a guessed price, or left it blank | Nurse sees no price. Reception and management see catalog and approved totals | Pricing stays with reception and the catalog |
| Discharge | Bed cleared and the file closed at different times | Nurse request, then reception completion with record and balance checks | The bed stays occupied until the stay is actually closed |
| Record history | Paper file in a cabinet | Stay remains openable with notes, services, deposits, and closing totals | The closed stay can be reviewed without reassembling papers |
| Accountability | Unclear signatures | User, time, and status on the main actions | Disputes have a trail |
| Transparency | Each desk saw its own papers | Shared status, bed, doctors, and approval state | The ward and the desk see the same stage of the stay |
| Data retrieval | Manual sort of files | Search, ward and room-type filters, approval queues, balance and credit lists | Lists replace walking the archive for current inpatients |
| Operational oversight | Phone calls and end-of-day counts | Dashboards for census, beds, deposits, approved charges, and amounts owing | Management can see the current inpatient picture in one place |

No measured time or cost saving is stored in the system. Those benefits are operational, not a proven percentage.

---

## 20. System Capability Matrix

| MODULE | STATUS | PRIMARY USER | WHAT IT DOES | MANAGEMENT VALUE | CLINICAL VALUE |
|---|---|---|---|---|---|
| Patient management | Implemented, one stay per record | Reception | Registers and finds the current stay | One list of who is in house | Identity, location, and status in one place |
| Admission management | Implemented | Reception | Opens the stay, deposit or credit, bed, doctors | Admission is traceable | The stay has a start date and a status |
| Room management | Implemented in Hospital Setup | Administrator | Departments, wards, rooms, rates | Capacity can be organized by ward | Staff can see ward when the bed is linked |
| Bed management | Implemented | Reception and administrator | Occupies, transfers, and frees beds | Occupancy without a manual board | The nurse sees the current bed |
| Doctor management | Implemented as a catalog and assignment | Administrator, reception, nurse | Visiting doctors and daily visit charges | Visit fees are visible and consistent | The care team on the stay is explicit |
| Nursing workflow | Implemented | Nurse | Census, notes, services, discharge request | Pending work is visible | Less rewriting of location, doctors, and daily items |
| Service catalog | Implemented | Administrator | Prices and categories, including spreadsheet import | One price list | Nurses pick real items instead of free text |
| Service approval | Implemented | Reception | Accepts or rejects nurse records | Only accepted work hits the bill | The nurse can see the outcome |
| Billing visibility | Implemented as deposits and approved charges | Reception and manager | Balances, receipts, invoices, outstanding and credit lists | Oversight of what has been recorded as money | Indirect: services are not lost between ward and desk |
| Discharge | Implemented | Nurse requests; reception completes | Two-step close with locks | Unfinished charges and unpaid non-credit stays are stopped | The patient remains on the ward list until clearance |
| User management | Implemented | Administrator | Accounts, roles, and permissions | Access can be limited by job | Nurses are not shown balances |
| Audit | Partially implemented | Administrator | Trails on records, notes, discharge, and security events for users and roles. No audit screen | Better than unsigned paper on the actions that are traced | Note edits keep the previous text |
| Dashboards | Implemented | All four main roles | Census, work queues, occupancy, money overview | A single operational picture | The nurse sees the ward without billing noise |
| Search and filters | Implemented | All roles, within their rights | Patient search; place and status filters; finance period filters | Faster oversight | Faster opening of the right stay |
| Maternity | Implemented for one newborn under the mother | Nurse and reception | Baby identity and separate mother/baby service lines on the same stay | Charges can be separated by subject | The newborn is not a second full admission |
| Clinical notes | Implemented | Nurse writes; others may read | Narrative notes, no charge | The note is with the stay | Replaces a loose progress note for this admission |
| Room-charges admin page | **Not live** | Administrator | Shows sample occupancy, not the real bed list | Do not use this page for decisions | None |
| Payment collection | **Not implemented** | — | Methods are labels on a manually entered deposit | No false claim of cashless collection | None |
| Doctor login | **Partial template only** | — | View-only nurse shell if assigned | Do not present it as a physician system | Doctors are informed through the assignment list, not through their own session |

---

## 21. Current Limitations

**Currently available**

- Sign-in for reception, nurse, administrator, and manager
- Admission with bed, deposit or credit, and optional doctors
- Nurse notes, catalog services, pharmacy returns, and discharge requests
- Reception approval, deposits, bed transfer, invoices and receipts, and discharge completion
- Manager census, occupancy, deposits, approved charges, outstanding balances, and credit lists
- Administrator catalog, doctors, hospital setup, users, and settings
- Search and role limits, including hidden prices for nurses

**Partially available**

- Departments and wards exist, but the starter beds are not inside those wards until an administrator places rooms and beds
- The Room Charges screen is sample data and disagrees with the live bed counts
- Daily room and doctor charges are created when a stay is admitted and when that stay is opened, for the relevant day. They are not generated by an overnight job. A data service exists to generate them for all open stays, and no screen calls it. If nobody opens a stay, intermediate days can be missing until the stay is opened or that service is run
- VAT can be displayed and is not part of the discharge balance
- Annual reporting reuses the monthly figure
- Doctor, night reception, and finance roles exist as templates without sample users. The Doctor template cannot document care
- Clinical-note voiding is not on the screen
- One newborn per maternity stay, not multiple babies
- Emergency contact and admission reason are stored as empty fields, not collected
- Patient details cannot be corrected after save
- A returning patient is a new stay only if no unique medical record number or national ID blocks it. There is no merged history of past stays
- Invoices and reports are browser prints or spreadsheet downloads
- The security log has no on-screen viewer in the menu
- Refunds and patient deletion are permission labels only
- The top-level product description in the old readme still talks about sample data and a role picker. The working system uses sign-in and a database. Trust the screens, not that old description

**Not a live external connection**

- No laboratory machine, pharmacy stock, radiology worklist, insurance, bank, or Ebirr collection
- No automatic bed sensor
- Dashboards refresh when opened. They are not a real-time operations wall
- Notifications of new nurse submissions are held in the user’s session, not a permanent alert system

**Not production-hardened by this review**

- The system is a complete inpatient workflow for demonstration and hospital use of the features above. It still depends on a locally configured database and a secret for sign-in. Starter accounts use a shared demo password until an administrator changes them. Concurrent booking of the last bed is protected by the bed status check, not by a full database transaction. That is an operational caution under two receptionists admitting at the same instant.

---

## 22. Future Enhancements

These follow gaps that are already visible. They are not features of the current system.

- Put the starter beds inside real wards, and replace the sample Room Charges page with the live bed list
- Run daily room and doctor charges on a schedule so a day is not missed when nobody opens the stay
- A true previous-admission history for the same person, with editable demographics and emergency contact
- A doctor workplace if physicians are expected to read notes or write orders themselves
- A void or correction path for an approved charge, with a visible audit screen
- Refunds when deposits exceed charges
- VAT that actually changes the amount due, if the hospital must charge it
- Insurance, stock counts, and external payment collection
- Vital signs, medication chart, and orders, if the hospital wants nursing documentation beyond notes and billed services
- Multiple newborns on one maternity stay
- An expected discharge date

---

## 23. Technical Architecture

For developers only.

- **Frontend:** React 18 with Vite, React Router, and Tailwind. Staff screens are role-based routes.
- **Backend:** Node.js and Express.
- **Database:** MongoDB via Mongoose. Main records are patients (the stay), beds, rooms, wards, departments, deposits, room assignments, doctors, doctor assignments, service categories, service records, clinical notes, users, roles, hospital settings, and maternity babies.
- **Authentication:** email or username and password, session token, active users only.
- **Authorization:** permissions on the role, checked on the server for admissions, records, notes, payments, and setup.
- **API:** JSON routes under `/api` for auth, patients, beds, rooms, wards, departments, records, doctors, charges, settings, users, roles, search, dashboards, and clinical notes.
- **Notable libraries:** bcrypt for passwords, JWT for sign-in, Recharts for manager charts, a spreadsheet reader for catalog import.
- **Deployment assumption:** the interface is a web app on port 5173 in development; the API is port 5000; the database connection is configured in the server environment. There is no container or hospital-server deployment script in the project. Currency and hospital identity are settings, defaulting to ETB and Central City Hospital.

---

## 24. CEO/Doctor Explanation

This system is the inpatient board, the ward record, and the reception bill, kept as one stay.

What was going wrong was not a lack of medical skill. It was that admission, the bed, the visiting doctor, the nurse’s list of what was done, and the amount to be billed were separate handwritten steps. People waited on each other, beds were hard to trust, and it was difficult to say, at the end of a stay, what had been done and what had been accepted for payment.

What happens now is straightforward. Reception opens the stay and places the patient in a free bed, with a deposit or as a credit patient, and can name the visiting doctors. The nurse sees that patient on a ward list, writes notes, and selects the services and medicines from the hospital’s own list. Those selections do not become a charge until reception accepts them. Room and doctor-visit charges follow the bed and the assigned doctors, instead of a daily tally someone might forget. When the nurse says the patient can leave, the patient remains in the bed until reception has cleared unsigned records and, for an ordinary admission, any unpaid balance. Then the bed is free and the stay stays on record.

For nurses, the gain is less copying: the patient, bed, and doctors are already there, services are picked rather than handwritten, and they can see whether reception has accepted the day’s record. They are not asked to price the care.

For reception, the gain is a queue of what the ward says was done, a balance that ignores anything not yet accepted, a receipt and an invoice from accepted charges, and a discharge step that will not close a stay while something is still pending.

For you as owner, the gain is a single view of who is admitted, which beds are full, what has been deposited today, what approved care has been recorded, who is on credit, and who still owes. You can look without calling the ward and the cashier separately.

For doctors, the system does not replace the physician’s own notes or orders, and doctors do not sign in to practice from it. It does make the visiting doctor and the visit fee explicit on the stay, and it keeps the nurse’s notes and the accepted services attached to that admission so the clinical and the administrative story are no longer two different files.

It improves transparency because status, bed, doctor, approval, and balance are shared. It improves accountability because the person who admitted, wrote, submitted, approved, received a deposit, or discharged is stored with the time. It tracks services by tying every accepted line to the patient, the day, the catalog item, and the person who approved it. It tracks beds by refusing a bed that is already occupied and by freeing it only when discharge is finished. At discharge it stops the common failure of closing the file while slips are still in a pocket or the balance has not been looked at.

What you can see now that was hard to assemble by hand is the current census, bed occupancy, pending ward submissions, low deposits, credit stays, and the closing position of a discharged patient.

What it reduces is contradictory bed lists, unpriced or illegible service slips, charges that reach the bill before anyone reviews them, and discharge with unsigned records still open. It does not eliminate clinical or clerical mistakes. Someone can still choose the wrong catalog item. That choice is at least visible and attributed.

What is still missing is a physician workstation, a full medical chart, stock and laboratory connections, real payment collection, a reliable overnight charge run, and a proper history of repeat admissions for the same person. Those should be described as next steps, not as part of this system.

---

## 25. Recommended Presentation Story

**PROBLEM**  
The inpatient stay was split across handwriting: admission, bed, doctor, nursing slips, and billing.  
Show: no slide of software. Use one sentence from the ward and one from reception.

**CURRENT MANUAL WORKFLOW**  
Follow a patient from the door to discharge on paper.  
Show: a simple five-step sketch, not the product.

**WHY THAT CREATES INEFFICIENCY AND LOW VISIBILITY**  
Emphasize lost slips, uncertain beds, unclear visit fees, and no single view for the owner.  
Show: the gaps between nurse, reception, and management. Do not quote a percentage.

**DIGITAL SOLUTION**  
One stay, four jobs: reception opens it, nursing documents it, reception accepts charges and closes it, management reads it. Doctors are assigned, not logged in.  
Show: the sign-in screen, then say the hospital name on screen must be set to City Central General Hospital before the demo if the setting still says Central City Hospital.

**HOW THE PATIENT JOURNEY CHANGES**  
Admit, place, assign a doctor, document, approve, discharge.  
Show: Add Patient, then the patient billing stay with room, bed, and doctors.

**HOW NURSES USE IT**  
Census without money, notes, catalog services, pending status, discharge request.  
Show: Nurse dashboard, patient list filters, open a stay, Nurse Notes, service builder with prices absent, record history.

**HOW RECEPTION USES IT**  
Queue, amounts, approve, deposit, invoice, discharge rules.  
Show: Reception dashboard, Pending Approvals, approve one record, Patient Billing balance and pending charges, a deposit receipt, summary invoice.

**HOW MANAGEMENT BENEFITS**  
Census, beds, deposits, approved charges, credit, amounts owing.  
Show: Manager dashboard, Outstanding Balances or Credit Patients, and Admin dashboard occupancy. Do not open the Room Charges page; its numbers are samples.

**TRANSPARENCY AND ACCOUNTABILITY**  
Pending versus approved, named approval, bed state, discharge lock.  
Show: a record’s status and audit line, then a discharged stay that no longer accepts new services.

**DEMO**  
Use the checklist below on a database that already has at least one admitted patient, one pending nurse record, one assigned doctor, and one known free bed. A fresh install has staff and catalogs but no patients and no doctors until someone adds them.

**CURRENT LIMITATIONS**  
Say clearly: no physician login for real clinical work, no card or Ebirr collection, no full chart, daily charges depend on the stay being opened, and repeat admissions are not one lifelong record.

**NEXT STEPS**  
Ward-linked beds, scheduled daily charges, physician access only if the hospital wants it, and payment or insurance connections only as a later project.

---

# DEMO CHECKLIST

Set the hospital name in Administrator → Settings before the demo if the screen must say City Central General Hospital.

- [ ] Sign in as reception
- [ ] Reception dashboard: admitted count, pending approvals, today’s deposits, current inpatients
- [ ] Add Patient: identity, available bed, optional doctor, deposit or credit
- [ ] Show the bed is no longer offered as available
- [ ] Open the stay: room, bed, assigned doctor, deposits, approved charges, remaining balance, pending charges kept separate
- [ ] Search the patient by name or patient ID from the top search
- [ ] Sign in as nurse
- [ ] Nurse dashboard: census, pending discharge queue, current inpatients, room type and ward filters
- [ ] Open the stay and show that prices are not shown
- [ ] Add a clinical note and show author and time
- [ ] Add a catalog service and save the record
- [ ] Show the record as pending in the nurse’s history
- [ ] Request discharge and show the patient still on the ward in the same bed
- [ ] Sign in as reception
- [ ] Pending Approvals: open the nurse’s record, show the amount, approve it
- [ ] Return to the stay and show the approved amount now included and the pending warning gone
- [ ] Record an additional deposit and open the receipt
- [ ] Show a summary or detailed invoice built only from approved charges
- [ ] If a record is still pending, show that discharge completion is refused
- [ ] Reject the discharge request back to admitted, or, with records clear and the balance rule satisfied, complete discharge
- [ ] Show the bed available again and the stay locked against new services
- [ ] Open the discharged stay and show the closing record still readable
- [ ] Sign in as manager: census, occupancy, deposits, approved charges, outstanding or credit list
- [ ] Sign in as administrator: Hospital Setup for wards and beds, Doctors, Catalog. Skip Room Charges or explain that page is sample data

Do not demonstrate a doctor signing in to write orders, a card payment, Ebirr collection, insurance, laboratory machines, or a second admission history for the same person. Those are not in the system.
