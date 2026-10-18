# PASS registration ID checking — 19 October 2026

The web registration sequence is User Details → ID Verification → Account Info → Review & Submit → six-digit email verification. Vehicle, vehicle photo and driver’s license enrollment now happen inside the approved account dashboard. New regular accounts remain pending administrator approval even when the ID text matches. Guest registration is unchanged.

## Categories and number rules

- College Student: exactly nine digits, displayed YYYY-NNNNN. The first four digits are the start year, from 1000 through the current Manila year. The year is not hard-coded to 2026.
- Employee: exactly seven digits, displayed NNN-NNNN. Digits 2–3 encode 2000 + YY; for example prefix 022 means 2022. The encoded year cannot exceed the current Manila year. Keep the leading zero.
- SHS Student: ID upload and manual entry with staff review. The SHS format is not known; no college or employee year/length rule is invented for it.
- Spaces/hyphens are accepted in college/employee input and normalized for display and duplicate checks. Letters are not silently removed from user-entered numbers. Existing ID records using another separator also block duplicates. Sign-in accepts both the printed and digits-only ID; ambiguous legacy normalized IDs require the exact saved ID or email.
- Public registration derives only student (College/SHS) or employee access. Existing faculty and other accounts/roles are retained. Admin/security accounts cannot be requested through this form.

## Document processing

A user-selected JPG/PNG is read automatically. Full-card school text and per-field template regions suggest first name, surname, optional middle initial and institutional ID number. Templates use relative positions from the two supplied upright portrait samples, not highlight colors; unmarked IDs are supported. Crop to the card edges. The reader uses the configured TESSERACT_PATH and existing PHP GD/EXIF support. No new OCR package or third-party document service is introduced.

Name fields remain separate and editable; compound surnames/first names are preserved. An initial is never expanded into a guessed middle name. Before advancing from ID Verification and again during final registration, the server compares edited details against the current evidence. Routine field rechecks reuse the signed evidence and do not rerun OCR. Changing the file/category invalidates the previous result.

Results: matched (required text/quality checks pass), needs_correction (confident mismatch or invalid number), manual_review (uncertain/unsupported evidence or an explicit disputed OCR reading), unavailable (reader failure). If OCR is wrong, the registrant can request staff review; original failed checks and the dispute remain visible to the admin and the account stays pending. This cannot override year/length/duplicate validation. A document can have correctly suggested text while still requiring staff review. Per-field 80% OCR confidence is an application threshold, not a calibrated identity/authenticity probability. PDFs are retained for staff review, not automatically matched from an editable text layer.

The two supplied sample images were used locally to inspect layouts and smoke-test actual Tesseract extraction; neither the images nor their names/numbers are included in Git, bundles, fixtures or documentation. College sample number extraction had lower confidence and correctly required manual review. This small sample is not a measured OCR accuracy rate across school IDs.

## API and privacy

- GET /api/registration/options: current Manila year and policy/categories.
- POST /api/registration/id-check: registration_category + school_id_file, optionally edited first_name/last_name/middle_initial/user_code and id_check_receipt. Returns suggestions, checks and an opaque authenticated receipt. File limit 5 MB / 20 megapixels. Original temporary upload is not permanently stored by this read endpoint.
- Read receipts are encrypted/authenticated with the application key, expire after 20 minutes, and bind exact upload SHA-256 plus category and policy. Registration rejects expired/tampered/swapped receipts. No client-supplied matched flag is trusted. OCR responses use Cache-Control: no-store, private.
- Fresh OCR: six requests/minute/IP. Cached detail checks: 30/minute/IP. Regular registration: five/minute/IP, isolated from OCR and polling limits.
- POST /api/register now requires registration_category, first_name, last_name, optional middle_initial, user_code, department/office, contact_number, email, password + confirmation, school_id_file, agree; College/Employee also require the current receipt. Vehicle/license inputs are rejected. The older full_name/user_type/has_vehicle registration contract must be updated in external native clients; separate React Native/Expo source is not changed by these bundles. The web MobileApp preview shares the updated component.
- College requires an active college department. Employee office may be entered as text; SHS stores Senior High School without requiring a guessed department seed. registration_unit preserves that label even without a department foreign key.
- User profiles retain category/unit and structured check status/reasons, not raw OCR text. Uploads live on the private disk. Only authorized active administrators can stream GET /api/admin/users/{id}/school-id; regular users and parking staff are denied. Admin User Details shows the check and a protected ID preview. No public document path is returned.
- Registration saves account/profile/regular role/audit atomically and deletes the upload if persistence fails. Email is sent after commit; failure preserves the pending account and allows resend. No vehicle/driver/RFID record or active account is created by an ID read or registration.

## Deployment

Branch feature/registration-id-check-20261019. Apply matching PASS-registration-automation-backend.bundle and PASS-registration-automation-frontend.bundle. Backend has one new migration: 2026_10_19_020000_add_registration_id_checks_to_user_profiles. Run migrations in the development and separate testing environments, clear routes/config, refresh layout for cumulative prior parking changes, then run the matching tests and frontend build. Do not reseed or reset operating data. No environment file is changed by this update.

Pending owner acceptance: actual Windows/PHP 8.2/MySQL runs and device/photo review; SHS sample/format; broader ID-template/photo testing and any official student/employee roster integration. OCR checks do not verify current enrollment/employment, issuer authenticity or the physical ID holder.

## Prepared verification

163 Laravel/PHPUnit tests passed, 52,763 assertions, zero errors/failures (JUnit report checked), on isolated PHP 8.3 / MariaDB. This includes registration atomicity/private-file cleanup, mail failure retention, roles, normalized duplicates, year rollover, signed-receipt tampering/expiry/file/category swaps, cached edit validation, manual/outage states and admin-only ID streaming. Existing license, parking, RFID, guest/QR and reporting suites passed.

TypeScript and production build passed (existing Vite configuration/chunk-size warnings remain). Real local Laravel API with Chromium/Tesseract: 111 registration checks across all three categories at 320/1440px, plus 390/768px layout checks, then 20 focused final step-navigation checks at 320/390/768/1440px. Zero page errors. Three synthetic registrations reached email verification and remained pending; browser email-code tests use an explicitly seeded QA code, not proof of actual inbox delivery. Admin protected preview and editable mismatch/year/password states were exercised. No supplied real ID image or holder data is committed.

Additional final browser checks: eight desktop/mobile disputed-OCR checks passed, including staff-review request and future-year rejection despite that request. Total prepared browser checks: 139; zero JavaScript page errors. POST id-check/register accept optional boolean request_manual_review; this requests a pending staff decision and never claims an automatic match or activation.
