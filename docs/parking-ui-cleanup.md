# Parking UI and administrator access cleanup — 18 October 2026

The public-facing Inventory diagram option is removed for every role. Plan, 3D and SVG fallback always display the same 45-car / 84-motorcycle proposal. The database still holds 139 slot records. Ten car codes have no measured position; they are not drawn as fictional bays. Staff can review these records in the existing unpositioned-record list. Geometry, dimensions and recorded occupancy remain unchanged.

The former PINK-TOP label now reads **Upper junction: 3.36 m** in both canvas and SVG. The lower C3 segment remains **2.60 m**. Boundary estimates and the tight 4.50m car aisle allowance remain subject to site/vehicle validation.

Administrator `/app/parking/layout` uses the read-only availability map: view Plan/3D, zoom, area focus, measurements, slot status and refresh. It does not offer entry/exit, parked-location confirmation/reporting, or maintenance controls. It requests the redacted availability endpoint rather than the operational map. Parking staff retains its operational screen.

The backend independently rejects administrator mutations on:

- POST `/api/parking/entry`
- POST `/api/parking/exit`
- POST `/api/parking/transactions/{id}/observed-slot`
- PATCH `/api/parking/slots/{id}`

These return HTTP 403 before validation or writes. Admin-type accounts, parking_admin role accounts and security accounts carrying an admin role are all read-only for these operations. Existing monitoring/reporting, RFID assignment, account approvals and other admin management functions retain their separate permissions. Development simulators retain their existing explicit tester-only, non-production rules.

Tests verify rejected requests leave events, transactions, incidents, audit records and slot state untouched. Staff still records gate movements, confirms parking and changes maintenance state. Existing QR/RFID tests now reflect the role handoff: admins approve/revoke; staff scans at the gate.

Matching cumulative bundles: PASS-parking-ui-cleanup-backend.bundle and PASS-parking-ui-cleanup-frontend.bundle. Branch: feature/parking-readonly-ui-20261018. No migration or reseed. The import guide preserves local Vite settings and uses the actual USERPROFILE Downloads path.

Verification: Laravel 128 tests passed (52,738 assertions); TypeScript check and Vite production build passed. Browser verification passed 341 checks across admin/security/student/guest at 320px and 1440px plus a 390px admin SVG fallback, with zero JavaScript page errors. Checks cover absence of Inventory diagram, human-readable junction dimensions, admin read-only controls before/after slot selection, staff maintenance/return-to-service and gate form, live record preservation, slot sizes, Plan/3D and overflow.
