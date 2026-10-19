# PASS institutional ID registration decisions — 19 October 2026

Web flow: User Details → ID Verification → Account Info → Review → six-digit email code. Vehicle/photo/license enrollment happens inside the approved account dashboard. College/SHS receive student access; Employee receives employee access. Guest registration retains its separate visitor flow.

## Decision policy v3

New College/Employee registrations start pending with an unverified email. A current server-generated matched ID result plus successful email verification activates the account automatically. Every required text check must pass. The saved identity/category, regular role and private ID must still match. The activation is locked, occurs once and records account_auto_approved. Suspension/rejection, changed identity, missing document, privileged additional roles, old policy and verification replays cannot grant activation. Existing pending/verified accounts are not bulk approved.

- First name/surname: exact normalized document match and field OCR confidence at least 80. Compound names remain intact. Names/initial/suffix are separate editable fields.
- ID number: valid category/year/length plus an exact document match. Direct OCR confidence at least 80 remains one path. A lower confidence read can qualify through agreement across at least three distinct reading methods, each with number confidence at least 40, including both a broader document/label crop and a number-only crop. All qualifying number candidates must agree. Changing page segmentation on the same preprocessing counts as one method, not two. Sources are allowlisted. The typed answer never selects or manufactures the OCR consensus. Original scores remain available; this is corroboration, not a calibrated authenticity probability.
- Image quality: minimum image size 500 × 300 remains required. Global sharpness 60 is a reference rather than an automatic veto: when image size and every required identity/school text check pass, lower global sharpness becomes an advisory. If text is still uncertain, the account stays pending for those unresolved checks. A blurry image without corroborated text does not get approved.
- School marker: recognizes Dr. Yanga's Colleges text, the official dyci.edu.ph domain (allowing one OCR glyph/edit), or DYCI together with the school motto. Branding reads retry the header/website in color when needed. ID-number format alone never confirms school identity. An unconfirmed school marker requires staff review, even if other text matches. Absence of detected school text is not treated as proof of a wrong ID or automatic rejection.
- Optional M.I./suffix: an entered value must be confirmed to qualify automatically; unread values need review and confident differences need correction. A detected suffix omitted by the user requires correction. Jr., Sr. and Roman numerals I–X use the existing user_profiles.suffix column. Trailing single Roman-letter initials in first names are not guessed as suffixes.

Uncertain/conflicting text, unconfirmed school branding, PDF, reader failure, SHS and explicit disputed OCR stay pending staff review after email verification. Confident name/number/suffix mismatches ask for correction; disputed readings can be submitted to staff. Invalid year/length/duplicates cannot be overridden. OCR failure alone never rejects an account.

OCR compares document text, not enrollment/employment records, issuer authenticity or the physical holder. An official school roster is not integrated. Account activation does not approve vehicles, verify driving licenses or assign RFID tags.

## Institutional numbers and categories

College: exactly nine digits, YYYY-NNNNN; first four encode start year, no later than the current Manila year, not hard-coded 2026. Employee: seven digits, NNN-NNNN; positions 2–3 encode 2000+YY, e.g. 022 means 2022. Preserve leading zeros; no future encoded year. Spaces/hyphens normalize for duplicate checks and sign-in, including older separator variations. User-entered letters are not silently removed. Ambiguous legacy normalized sign-in IDs require the exact stored ID/email.

SHS: manual printed alphanumeric number/upload and staff review until its sample and rules are supplied; no invented College/Employee pattern. Public registration cannot request admin/security access. College requires an active College department; Employee can enter an office and SHS stores Senior High School.

## Reader and response

Supplied upright portrait templates use relative field positions, never highlight colors. Upload the complete front, upright and cropped to card edges. Grayscale, binarized, color and wider-margin crops tolerate framing, recompression and soft edges. Number-only variants and an additional broad color pass supply agreement without using the submitted answer. Contradictory strong number reads remain uncertain. No longer number is truncated into the required pattern.

The web form shows Checks that need attention and an expandable full checklist, including field confidence and quality values. Passed with advisory explains a low sharpness result supported by readable identity text. Passed ID format refers only to number/year syntax. All suggestions remain editable; server re-evaluates final edits.

Existing TESSERACT_PATH / PHP GD / EXIF configuration is reused; no new OCR dependency/service. Read endpoint uses temporary uploads only; final registration saves privately. No real sample image/name/number or raw OCR is committed to Git, fixtures or bundles.

## API and privacy

GET /api/registration/options returns categories/current Manila year/policy. POST /api/registration/id-check accepts category + school_id_file and optional edited first_name/last_name/middle_initial/suffix/user_code, receipt and request_manual_review. The encrypted authenticated receipt expires in 20 minutes and binds exact file/category/policy. Policy v3 invalidates prior cached receipts: Read ID again after deployment. OCR/check responses are no-store/private.

POST /api/register requires registration_category, first_name, last_name, user_code, department/office, contact_number, email, password+confirmation, school_id_file, agree; optional middle_initial/suffix/request_manual_review. College/Employee require the current receipt. Client matched/consensus flags cannot grant activation; only server-issued evidence is used. Vehicle/license inputs are prohibited. Fresh OCR six/minute/IP, cached checks 30/minute/IP, registration five/minute/IP use separate counters.

User/profile/regular role/audit save atomically; persistence failure removes the upload. Mail failure retains the pending account and permits resend. Code and legacy signed-link verification share the activation rule. Only authorized active admins can stream another user's private ID; ordinary users and parking staff are denied. No public document path is returned.

## Deployment and prepared verification

Branch feature/registration-evidence-decision-20261019. Paired cumulative PASS-registration-decision-backend.bundle / PASS-registration-decision-frontend.bundle include prior registration/auto-approval/suffix/review-detail updates. No new migration beyond the previous included registration metadata migration. No .env edit, database reset, reseed, bulk approval, push or deployment. External React Native/Expo source is unchanged and must adopt the revised registration API separately.

Testing includes the reported 1308×2049 / sharpness 59.1 / ID confidence 49.3 case with three-method agreement, actual email-code activation, and negative cases for single weak reads, wrong/mismatched numbers, repeated/unknown methods, conflicts, missing branding, insufficient resolution, roles, legacy policy, replay, private storage and existing guest/parking/license/report flows.

Real Tesseract smoke tests: both supplied originals and four recompressed/softened variants match their known supplied identity. A more softened College variant with sharpness 51.6 and number confidence 50.7 matches through three-method agreement. A still softer variant with unconfirmed school text remains manual_review. These local examples are not a general accuracy rate, and the owner's exact Windows upload/engine result remains to be confirmed. All sample derivatives stay outside Git/bundles.

Owner acceptance remains FOR TESTING: import matching bundles, Read ID again on actual Windows/photos, verify email delivery and active-or-pending decisions. SHS sample/format, broader photos/long names/suffixes, native API update and any school roster integration remain open.

Final prepared checks: 182 PHPUnit tests / 52,926 assertions, zero failures/errors/skips (JUnit verified), TypeScript and production build passed. Existing Vite/chunk warnings remain. 72 UI checks at 320/390/768/1440px cover matched, matched-with-advisory, review, correction and outage states, check expansion and overflow, with zero JS page errors. These UI-only response fixtures are simulated; real extraction evidence is the separate Tesseract smoke testing described above. Prior real-API registration/end-to-end checks are retained in earlier commits.
