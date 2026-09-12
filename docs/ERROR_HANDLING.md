# Error Handling

Related documents: [API_REFERENCE.md](./API_REFERENCE.md) · [SECURITY.md](./SECURITY.md) · [CODING_STANDARDS.md](./CODING_STANDARDS.md)

---

## Strategy

The API uses **per-route try/catch** and a single JSON error field. There is **no** Express `app.use((err, req, res, next) => ...)` handler, no problem+json, and no error-id correlation.

The SPA treats any thrown `Error` from `apiFetch` as a toast or inline message.

---

## Exception handling (backend)

Typical pattern (`patients.routes.js` and others):

```js
try {
  // ...
} catch (err) {
  console.error(err)
  res.status(500).json({ error: 'Failed to <action>' })
}
```

Unhandled rejections during startup (`start().catch`) log `Failed to start server` and `process.exit(1)`.

Missing `MONGODB_URI` logs `MONGODB_URI is required` and exits before listen.

JWT failures are handled inside `authRequired` (not thrown to a global handler).

---

## Global handlers

| Layer | Present? |
|-------|----------|
| Express error middleware | No |
| 404 JSON for unknown `/api/*` | No — Express default HTML/empty 404 |
| Frontend React error boundary | No |
| `window.onunhandledrejection` | No |

Unknown API paths do not return `{ error }` consistently.

---

## Validation errors

| Source | HTTP | Body |
|--------|------|------|
| Missing login fields | 400 | `{ error: 'Email and password required' }` |
| Admit / deposit / transfer validators | 400 | `{ error: '<first string>' }` |
| Empty services / return items | 400 | `{ error: 'Services required' }` or `Return items required` |
| Bed not available, duplicate MRN, etc. | 400 | Specific string |
| Record not pending | 400 | `{ error: 'Record is not pending' }` |
| Unknown report type | 400 | `{ error: 'Unknown report type' }` |
| Client forms | — | Field-level `{ name: '...' }` plus toast of `firstError` |

Mongoose validation failures (enum, required) usually fall into the generic `500` catch — they are not mapped to 400.

Duplicate unique index (e.g. `referenceNumber`) also becomes generic `500` `Failed to add deposit` rather than a 409.

---

## HTTP errors

| Status | Meaning in this API |
|--------|---------------------|
| 400 | Validation or illegal state (not pending, bed taken) |
| 401 | Missing/invalid token or bad login |
| 403 | Authenticated but wrong role (`requireRole`) |
| 404 | Patient, record, user, or category not found |
| 500 | Unexpected exception or mapped failure message |

Success codes: `200` for reads/updates, `201` for admit, deposit, and new records.

---

## Database errors

- Connection failure prevents startup.
- Query errors are logged and returned as 500 with a generic action message.
- No retry, no circuit breaker, no distinction between timeout vs duplicate key.
- Multi-step admit/transfer is **not transactional**. A failure after occupying a bed can leave occupancy and patient data inconsistent.

---

## Frontend handling

| Situation | Behavior |
|-----------|----------|
| `apiFetch` non-OK | `throw new Error(data.error \|\| statusText)` |
| Login failure | Destructive toast; stay on `/login` |
| Admit / deposit / transfer / submit / approve | Destructive toast; stay on page |
| Settings save | Destructive toast |
| Manager report | Destructive toast; popup-blocked has its own message |
| Context used outside provider | Throw (developer error) |
| Patient id not in memory | “Patient not found” empty state |
| `authReady === false` | Full-page “Loading...” |
| `USE_API` list load failure | `console.error` only — user may see empty lists |

Invalid JSON on error responses is tolerated (`res.json().catch(() => ({}))`).

---

## Logging strategy

- **Server:** `console.log` / `console.error`. No log levels, files, or PII redaction utility.
- **Client:** `console.error` on bootstrap fetches; user-facing toasts otherwise.
- Seed script logs counts to stdout.

There is no audit collection for failed logins or API errors. Service-record `auditTrail` only tracks record lifecycle actions.
