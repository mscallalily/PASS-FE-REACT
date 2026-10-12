# PASS DYCI UI update notes

This is the existing React + Vite PASS prototype with focused UI updates.

## Updates included
- Added an **RFID Requests** tab to the regular user's Vehicle page. A user can select a registered vehicle and submit a request; the UI clearly labels it as temporary demo state and explains that request submission does not assign an RFID.
- Added an **RFID Requests** tab to Admin RFID Access so the admin can review the prototype queue and approve/reject requests separately from RFID assignment.
- Removed hard-coded example RFID/vehicle credential cards from Profile so the profile no longer implies that sample credentials are real.
- Added a note explaining that account approval, vehicle approval, and RFID assignment are separate processes.

## Important limitations
- The request queue is prototype/demo state, not connected to Laravel or a database. Actions reset on refresh.
- The ZIP did not contain the official PASS logo image. `public/branding/` has only a README, so the supplied official logo could not be embedded. Add the original logo asset there and update `src/config/branding.ts` to reference its exact filename; do not use a recreated logo.
- Account auto-verification, notifications, persistent vehicle records, and RFID assignment still require backend integration.
- `npm run build` could not be verified because dependency installation did not complete in this environment (`vite: not found`). Run `npm ci` and then `npm run build` locally.

## Run locally
1. Extract the ZIP.
2. Open a terminal in `pass_mobile_fix`.
3. Run `npm ci`.
4. Run `npm run dev`.
