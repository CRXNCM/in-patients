# Security

Related documents: [AUTHENTICATION.md](./AUTHENTICATION.md) · [ERROR_HANDLING.md](./ERROR_HANDLING.md) · [KNOWN_ISSUES.md](./KNOWN_ISSUES.md)

This is an analysis of **what the code does**, not a certification. Demo credentials and a long-lived JWT are appropriate only for local development.

---

## Authentication

- Passwords are hashed with **bcryptjs** (seed cost 10).
- Login compares hash; inactive users are rejected with the same message as bad passwords.
- JWT is the only session mechanism (7-day HS256).
- Token lives in **sessionStorage** (XSS-accessible; cleared when the tab closes).
- `/me` does not re-check `status === 'active'`.
- No lockout, MFA, password reset, or email verification.

---

## Authorization

| Control | Status |
|---------|--------|
| Frontend route gates by role | Implemented |
| Settings writes require Admin | Implemented |
| Manager routes require Manager or Admin | Implemented |
| Patient/record/bed writes require a specific role | **Not implemented** |
| `source` must match caller role | **Not implemented** |
| Object-level ownership (nurse can only edit own records) | **Not implemented** |

Any valid JWT can admit patients, add deposits, approve records, or transfer rooms.

---

## Password handling

- Stored as bcrypt hashes.
- Never returned from `/me` (`select('-password')`).
- Demo password `password` is shown on the login page and documented in seed output.
- Mock mode compares the password in plaintext to `DEMO_PASSWORD`.

---

## Input validation

- Admit, deposit, and transfer have dedicated validators.
- Settings `PUT` applies **`$set: req.body`** with no allowlist (mass assignment).
- Category `billingType` is not checked against the enum before save (invalid values can be stored; Mongoose may throw 500).
- Record line prices/quantities are `Number(...)` with no range or catalog-price check — clients can submit arbitrary amounts.
- Report `type` is switched explicitly; unknown → 400.

---

## Injection prevention

| Risk | Mitigation |
|------|------------|
| Mongo operator injection | Mongoose parameterized queries; login uses a plain email string. `req.body` on settings is an object passed to `$set` — unexpected keys can be set on the settings document. |
| XSS | React text interpolation for most UI. `printReport` builds HTML with **unescaped** `report.title`, `hospitalName`, and row fields — unsafe if those strings contain HTML. |
| SQL injection | N/A (MongoDB). |

---

## CORS

- Reflects a single `CORS_ORIGIN` (default Vite localhost).
- `credentials: true` is set though auth is header-based.
- No CSRF token (acceptable for Bearer-in-header if CORS origin is strict).

---

## Rate limiting

**Not implemented.** Login and all APIs are unlimited at the application layer.

---

## Sensitive data

| Data | Handling |
|------|----------|
| Password hashes | Stored; excluded from `/me` |
| JWT | Browser sessionStorage; sent on every API call |
| Patient phone, address | Stored; address and contacts are **omitted** from `toFrontendPatient` |
| National ID / MRN | Stored; uniqueness checked; **not** in list mapper |
| Deposit reference numbers | Stored, unique |
| Demo emails/passwords | Visible in UI |

Hospital TIN and addresses appear on printed invoices.

---

## Other controls that are absent

- Helmet / security headers
- HTTPS enforcement
- Account lockout
- Refresh-token rotation
- Audit log for login or settings changes
- Field-level encryption
- File upload scanning (no uploads)

---

## Potential security risks (from current implementation)

1. **Broken function-level authorization** on patient and record writes.
2. **Client-controlled auto-approve** via `source: "reception"`.
3. **Arbitrary charge amounts** on record lines.
4. **Settings mass assignment.**
5. **Weak demo secret and password** if deployed with `.env.example` values.
6. **XSS in report print HTML.**
7. **No rate limit** on login (credential stuffing).
8. **Long-lived JWT** with no revocation list (logout is client-only).
9. **XSS → token theft** because the token is in sessionStorage.
10. Login page advertises working passwords.

Treat the system as an **internal demo** until these are addressed.
