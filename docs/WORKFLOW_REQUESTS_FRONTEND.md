# Inpatient Pharmacy and Laboratory Requests (Frontend Prototype)

This is a frontend-only extension of the inpatient stay workflow. It is not a laboratory information system, pharmacy inventory system, or a replacement for reception billing.

Demonstration data is labeled on screen and stored in `sessionStorage` under `medbill_workflow_requests`. It is separate from MongoDB patient records.

## Current frontend routes

| Role | Path | Purpose |
|------|------|---------|
| Nurse | `/nurse/patient/:patientId` | Create and track requests on the stay |
| Nurse | `/nurse/pharmacy` | That nurse’s pharmacy request list |
| Nurse | `/nurse/laboratory` | That nurse’s laboratory request list |
| Pharmacist | `/pharmacist` | Queue summary |
| Pharmacist | `/pharmacist/queue` | Fulfill / reject |
| Laboratory | `/laboratory` | Queue summary |
| Laboratory | `/laboratory/queue` | Accept / complete |

Demo logins (password `password`), used when the API has no matching account:

- `pharmacist@cc`
- `laboratory@cc`

## Status models

Pharmacy: `pending` → `approved` or `rejected` or `cancelled`  
Laboratory: `pending` → `processing` → `completed`, or `cancelled` from `pending`

Approval of a pharmacy request means the medicine was handed to the nurse. It does not create a billed service record in this phase.

## Backend work required later

Do not assume final paths. Suggested operations:

- `GET` list requests with filters: kind, status, patientId, query, priority, date, sort
- `POST` create pharmacy request (patientId, admissionId, medicine, quantity, instructions, note)
- `POST` create laboratory request (patientId, admissionId, catalog test ids, priority, note)
- `GET` request by id, including history
- `POST` pharmacy approve (explicit action; not implied by GET)
- `POST` pharmacy reject (reason required)
- `POST` laboratory accept (`pending` → `processing`)
- `POST` laboratory complete (`processing` → `completed`, optional completion note)
- `POST` cancel pending request

Authorization (not implemented on the server yet):

- New access roles or permission keys for Pharmacist and Laboratory staff
- Nurse: create and cancel own pending requests; view own and stay history
- Pharmacist: view pharmacy requests; approve/reject
- Laboratory: view laboratory requests; accept/complete
- Reception continues to bill through existing service records; later, pharmacist approval may optionally create a pending/approved pharmacy service line
- Manager/Admin: optional read-only oversight

The backend user `role` enum currently allows only Reception, Nurse, Admin, and Manager. Pharmacist and Laboratory cannot persist as API users until that is extended.
