# PASS institutional ID registration — 19 October 2026

Web flow: User Details → ID Verification → Account Info → Review → six-digit email code. Vehicle/photo/license enrollment happens inside the account dashboard afterward. College/SHS receive student access; employees receive employee access. Guest registration retains its separate visitor flow.

## Activation decisions

New College/Employee registrations begin pending with an unverified email. After successful email verification, a current server-generated `matched` ID result activates the account automatically. Every required check must pass; the saved identity, category, regular role and private document must still match. Changes to names/number/suffix, privileged roles, missing documents and legacy policy records do not activate automatically. Only pending accounts qualify; suspension/rejection is never reversed by a verification code/link. Activation and email completion run under a database lock and produce one `account_auto_approved` audit event. Replayed codes/links cannot activate again.

Uncertain OCR, conflicting reads, reader failure, PDF, disputed OCR and unsupported SHS templates remain pending for staff review after email verification. Confident mismatches ask for correction; a registrant can dispute an incorrect OCR reading and request staff review. Year/length/duplicate rules cannot be overridden. No account is rejected solely because OCR cannot read it. Existing pending/verified accounts are not bulk approved by deployment; staff can review these records.

OCR compares document text, not enrollment/employment records, issuer authenticity or the physical holder. Automatic activation implements the chosen PASS workflow; an official school roster is not integrated. It does not approve vehicles, verify licenses or assign RFID tags.

## Number and name rules

- College: exactly nine digits, YYYY-NNNNN; first four encode start year, no later than the current Manila year (not hard-coded 2026).
- Employee: seven digits, NNN-NNNN; digits 2–3 encode 2000+YY. Prefix 022 means 2022. Preserve leading zero; encoded year cannot be in the future.
- Spaces/hyphens normalize for duplicate checks and sign-in. User-entered letters are not silently stripped. Duplicate checks include legacy separator variations. Ambiguous legacy normalized IDs require exact saved ID/email for sign-in.
- SHS: printed alphanumeric number, upload and staff review until its sample/rules are supplied; no invented College/Employee pattern.
- First name, complete surname, optional M.I. and optional suffix are separate editable fields. Compound names are preserved; initials are not expanded. Suffix supports Jr., Sr. and Roman numerals I–X. A first-name trailing I. remains an initial. Detected surname/first-name suffixes are extracted separately. Entered but unread suffix requires review; confident suffix mismatch requires correction. Existing user_profiles.suffix stores the value; no new suffix migration is needed.

## Reader

The two supplied upright portrait templates use relative field positions, never highlight colors. Upload the full front, upright and cropped to the card edges. Wider surname/name regions reduce clipping of compound names. Field reads use grayscale/threshold passes and page segmentation modes. A supplemental number-only color-preserving bilinear crop improves separation of ink and background. It can raise confidence only when a broader read also contains that complete number. Conflicting strong numbers require staff review; no read is selected to match the user's typed answer. Confidence threshold remains 80, an application threshold, not an authenticity probability.

TESSERACT_PATH and PHP GD/EXIF use the existing configuration. No new external OCR service or dependency. Read endpoint uses PHP temporary uploads only; final registration saves the private ID. No supplied real image, name/number or raw OCR is committed to Git, test fixtures or bundles.

Local sample smoke test: Employee required fields read above threshold. College complete number read rose from 70.6 to 95.5 with unchanged threshold. This is evidence for these two images only, not a general accuracy rate. No supplied sample contains a suffix; suffix/compound-name behavior additionally uses synthetic fixtures and regression cases. Other layouts, skew, glare and worn IDs can require staff review.

## API

GET /api/registration/options returns categories/current Manila year. POST /api/registration/id-check accepts category + school_id_file, optionally edited first_name/last_name/middle_initial/suffix/user_code, receipt and request_manual_review. It returns suggestions/checks and an encrypted authenticated 20-minute receipt bound to exact file bytes/category/policy. Policy v2 invalidates previous cached receipts: read again after deployment. Responses are no-store/private. Fresh OCR six/minute/IP; cached checks 30/minute/IP; registration five/minute/IP, separate counters.

POST /api/register requires registration_category, first_name, last_name, user_code, department/office, contact_number, email, password+confirmation, school_id_file, agree; optional middle_initial/suffix/request_manual_review. College/Employee require the current receipt. Client-side flags cannot grant activation. Vehicle/license inputs are prohibited. Existing external native clients must adopt this API; separate React Native/Expo source is not updated by web bundles.

College needs an active College department. Employees may enter their office; SHS uses Senior High School. Registration saves user/profile/role/audit atomically and cleans up uploads on persistence failure. Mail failure preserves the pending account and permits resend. Email-code and legacy signed-link endpoints share the activation rule. Admin users can inspect structured results/private ID; ordinary users and parking staff cannot fetch another user's ID. No public document URL is returned.

## Apply and acceptance

Branch feature/registration-auto-approval-20261019. Apply matching PASS-registration-auto-approval-backend.bundle and PASS-registration-auto-approval-frontend.bundle. Bundles include the previous registration changes. Migrate development and separate testing DBs for the earlier registration metadata migration; clear config/routes, run registration/email/guest tests, and build frontend. No environment changes, data reset, reseeding or bulk approval.

Pending: owner Windows/PHP 8.2/MySQL import, actual inbox delivery, real devices/photos including suffix/long surnames, SHS sample, native-client API update and any future school roster integration. Acceptance remains FOR TESTING until those are confirmed.

## Prepared verification

174 PHPUnit tests passed with 52,860 assertions, zero errors/failures/skips, on isolated PHP 8.3/MariaDB. Includes email-first gating, College/Employee activation, guest regression, replay and suspended/rejected-account protection, legacy/identity/role/document guards, suffix mismatch/unread cases, compound names and conflicting numbers. TypeScript and production build passed with existing Vite/chunk warnings. Browser: 116 real-API checks across College/Employee/SHS at 320/1440px including synthetic suffix extraction, edited details, registration, email-code completion, active-or-pending outcomes and private admin preview; 26 final label/mobile surname-width/navigation/overflow checks at 320/390/768/1440px. Zero JavaScript page errors. Browser email uses a seeded QA code and is not inbox delivery evidence. Real supplied samples are read-only local smoke tests; synthetic test images and QA runtime are not shipped.
