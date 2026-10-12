# PASS UI Final Audit — Before Backend Integration

## Scope
This package is the UI/prototype layer for the existing React + Vite PASS project. It is not a production-ready parking system and does not include a connected Laravel API or database.

## UI areas present
- Public landing, login, regular registration, guest registration/landing, forgot-password, and mobile information pages.
- Role-aware protected routes for Admin, Parking Staff, Student, Faculty, Employee, and Guest.
- Dashboards, profile, notifications, parking history, account management, vehicle management, RFID management, parking operations, visitor QR, reports, audit logs, violations, and system settings.
- Official PASS logo asset at `public/branding/pass-logo.png`, used by the PASS branding component.
- RFID request and assignment concepts are separate in the interface; a request approval does not equal actual RFID assignment.
- Legacy account-request and role links redirect to the consolidated User Management screen to avoid duplicate pages.

## Explicitly prototype-only / backend required
- Login currently uses mock accounts and does not validate passwords.
- Registration, forgot password, account verification/approval, notifications, and session persistence are not connected to an API.
- Vehicle forms and vehicle/driver records use mock data; submit/save actions do not persist.
- RFID requests, approval/rejection, assignment, activation/deactivation, and entry/exit events are not database-backed.
- Visitor QR approval, parking transactions/occupancy, violations, reports, audit logs, and system settings use prototype/mock behavior.
- Role checks in React are for UI navigation only. Authorization must also be enforced by Laravel middleware/policies.
- Automatic account approval must only be implemented when identity and school affiliation can be reliably verified. Unverifiable/mismatched records should be sent for manual review.

## Backend integration checklist
1. Confirm ERD/table names and map each screen to the existing schema; do not invent parallel tables without checking the approved ERD.
2. Implement authentication, password hashing, password reset, session/token handling, and server-side role/permission checks.
3. Implement account registration states and manual review; keep account approval separate from vehicle authorization and RFID processing.
4. Persist vehicle, driver/license, and vehicle-authorization records with ownership checks and validation.
5. Implement RFID request states: Submitted → Under Review → Approved for Assignment → RFID Assigned → Active, with Rejected/Needs Correction/Inactive where applicable.
6. Enforce unique RFID identifiers and prevent duplicate active assignments; log who processed each request and when.
7. Implement guest/visitor request approval and temporary QR expiry/validation. Do not treat a submitted visitor request as approved access.
8. Implement parking entry/exit logging, occupancy rules, violation handling, notifications, reports, and audit logs according to the approved process.
9. Replace mock data with API loading, error, empty, loading, and success states. Never show success before the server confirms the action.
10. Test every role and route, desktop/mobile breakpoints, form validation, and forbidden direct URL access.

## Build verification
Run locally from this folder:

```bash
npm ci
npm run build
npm run dev
```

A production build has **not** been verified in this environment. Resolve any install/build errors before starting backend integration. The archive intentionally excludes `node_modules`; dependencies should be installed from the lockfile.
