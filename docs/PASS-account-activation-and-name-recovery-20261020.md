# PASS — Admin/staff activation and student-name recovery

20 October 2026, Asia/Manila. Source add-on for owner acceptance; public-launch blockers from the earlier audit remain open.

An active, fully activated administrator can invite another Administrator or Parking Staff member. PASS generates a 24-character temporary password, emails it with a six-digit code and a trusted frontend login link, and issues only a restricted setup token at first sign-in. The recipient activates email, chooses a different password, then receives a fresh dashboard session. The temporary password and prior setup sessions stop working. Existing accounts without an invitation keep their existing sign-in flow.

Temporary passwords expire in 24 hours. Codes expire in 10 minutes, allow five wrong attempts, and are single-use. Authenticated code resend has a 60-second cooldown. An administrator can resend an incomplete invitation; doing so rotates its password/code and revokes setup sessions. Completed accounts cannot be reset through invitation resend. Inactive accounts cannot complete setup. Passwords and codes are hashed in the database; plaintext credentials are neither returned to the administrator API nor saved in audit records or queued notification jobs. Temporary passwords use letters/numbers to prevent Markdown formatting from changing their displayed value.

The email code proves access to the same mailbox that receives the temporary password. This is onboarding/email activation, not independent multi-factor authentication.

Mail failure preserves the incomplete account and reports `invitation_sent: false`. SMTP acceptance does not prove inbox delivery. Resend remains available after the cooldown. `FRONTEND_URL` must be the actual trusted frontend origin; production requires HTTPS. Configure it in the owner's environment. The installer does not read or rewrite `.env`.

The new invitation form has separate first-name and surname fields, account ID, role, email, and optional contact number. Identity text is uppercase. A fully activated administrator can choose only the supported Admin/Parking Staff roles. Ordinary staff and regular users cannot invite accounts. The selected-user details show activation status and the resend action.

The backend gates protected APIs during setup. The frontend setup boundary prevents dashboard/provider polling until completion. Tokens rotate after password setup; stale setup tokens and reset links requested during onboarding are revoked. The previous manually-passworded `/api/admin/users` creation route, when present, is redirected to invitation creation by the installer and now follows the new request contract.

## Actual OCR failure and fix

The owner supplied two actual unmarked student photographs. Both had wrong given-name/initial readings in the baseline. The fixed name region clipped letters; faint blue-gray lettering was reduced to fragments by a fixed dark-ink projection threshold.

The new helper locates a complete text band with horizontal margins and a local paper-contrast threshold. It retries a bounded set of line reads, preserves multiple given names, separates initial punctuation, and records initial confidence independently of the given-name average. It does not use a dictionary of expected personal names, substitute the owner's supplied answers, or raise raw OCR confidence to manufacture a match.

Both original photographs now produce the correct given name, initial, surname and printed ID number and evaluate `matched` under existing rules. An existing employee reference retained its prior extraction. This is a limited smoke test, not a general OCR accuracy estimate or proof of school affiliation/authenticity. SHS and other layouts still require further acceptance testing. Real holder photographs, ID numbers, raw OCR and credentials are excluded from the source package.

The owner must select the file again / read it again after installation. A previously cached OCR receipt contains the previous reading and is not silently reinterpreted.

## Verification and source limits

- Full available-source suite: 206 tests / 53,177 assertions, zero failures/errors. Includes 12 targeted invitation/security tests / 151 assertions.
- 43 browser assertions: 31 Admin/Staff setup assertions on synthetic accounts plus 12 real-photo form/field/overflow assertions; tested widths 320, 390 and 1440 px. No page exceptions or unexpected API 5xx in these flows.
- 16 parallel PHP operations in two dedicated MariaDB scenarios: eight code verifications produce one winner; eight password completions produce one winner. These are service operations, not an HTTP throughput test.
- TypeScript and Vite production build pass. Existing Vite native-config and chunk-size warnings remain.
- Guarded installer tested for initial application, repeat application, preservation of unrelated sentinel edits, and missing-anchor rejection before any application-file write.

The restored workspace did not contain the previously delivered audit heads BE `24d557e` / FE `78fc222`. This add-on was developed on fetched BE staging `edf07ad` / FE main `aec965d`, with the tests available there. Earlier audit totals are not claimed as rerun here. A bounded installer imports new files and adds checked hooks to the owner's current source; it does not replace the owner's AuthContext, API client, provider, route or OCR files with the older snapshot. If an expected anchor differs, installation stops for source-specific integration. Run the owner's full suite afterward; any old staff-creation test must be reviewed against the changed invitation contract.

## Installation

Use the paired `PASS-accounts-ocr-backend.bundle` and `PASS-accounts-ocr-frontend.bundle`, branch `feature/admin-staff-activation-20261020`. Do not merge that older source branch over the audited checkout. Fetch the bundle, restore only `tools/Install-PrivilegedAccounts.ps1`, then run that script with `-Target Backend` or `-Target Frontend` and `-SourceRef FETCH_HEAD` from the matching repository. The script checks the complete plan first, refuses to overwrite differing existing feature files, and backs up modified existing files under Git's private directory. No force-push, database reset/reseed, deployment, real email send, or account activation is performed by the installer.

Backend: `php artisan config:clear`, `php artisan route:clear`, `php artisan migrate`; migrate only the owner's separately configured testing database before tests. Run `php artisan test --filter="PrivilegedAccountSetupTest|InstitutionalNameRowsTest"`, then the full owner test suite. Frontend: `npm run build`. Do not run database tests against the operating database.

Owner acceptance: actual inbox delivery, both role setup flows, a retry after code expiry, required password change, old-password/session rejection, and re-reading both original photographs on the owner's Windows/Tesseract runtime. Public deployment and existing launch gates remain open.

Token-ability reference: [Laravel Sanctum documentation](https://laravel.com/framework/docs/12.x/sanctum).
