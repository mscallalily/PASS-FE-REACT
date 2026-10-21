# PASS prelaunch software audit — 20 October 2026

**Decision: NOT READY FOR A PUBLIC LAUNCH.** Verified source fixes are packaged on a review branch. The remaining release blockers and acceptance gaps below are still open.

This audit covers the Laravel backend and React web app, including their mobile web layouts. Hardware integration remains deferred. Native Android/iOS builds are not certified by this audit. Payments are not applicable to this nonpaid school parking system.

## Exact scope

| Component | Audited source |
| --- | --- |
| Backend baseline | `origin/staging` `edf07ad`, including the previously pushed backend work |
| Backend runtime fixes | `09e8b8f`, on `feature/prelaunch-audit-20261020` |
| Frontend baseline | `origin/main` `aec965d`; contains frontend staging |
| Frontend runtime fixes | `ce58e00`, on the same review branch |
| Backend main | `dc7d48d`; still divergent from the audited staging branch |
| Remote verification | Both repositories fetched again during the final verification; these remote heads were unchanged |
| Test data | Isolated testing databases and synthetic accounts/documents; no operating database reset or production stress test |

The resumed workspace did not contain the earlier uncommitted v4/v5 OCR work. Those earlier test totals and claimed wider-crop/long-name fixes are **not** evidence for this delivered revision. The current bundles include the independently verified fixes described here.

**The colored College/Employee images were annotation guides.** They were not the actual application uploads. No conclusion about the real OCR failure is based on their colors.

## Verified results

| Check | Result | Practical limit |
| --- | --- | --- |
| Backend regression suite | **211 passed; 53,353 assertions** | PHP 8.3.6 with an isolated MariaDB database; rerun in the owner's Windows environment |
| API permission coverage | Every configured authenticated API route rejects anonymous requests; controller methods resolve; additional role/ownership tests pass | Not a claim that every possible role/input combination was exhaustively enumerated |
| Browser layout crawl | **348 checks = 87 route/role combinations × 320, 390, 768, 1440px**; no page exceptions, unexpected API 5xx, or whole-page overflow | Primarily synthetic/empty fixture states; not real iOS/Android device certification |
| Interactive browser flows | **42 assertions passed** | Local web app and actual isolated Laravel APIs; the 503 session failure and persisted-page event were deliberately injected |
| HTTP failure tests | **10 passed** | Includes delayed headers, stalled bodies, offline/network failure, malformed JSON, HTML returned with 200, cancellation, retry-after and uncertain writes |
| Database concurrency | **50 independent PHP worker operations across 7 scenarios passed** | Service/controller calls in separate processes against MariaDB; **not an HTTP throughput or full campus load test** |
| Frontend TypeScript / production build | Passed | Large optional map/model chunks still produce a build warning |
| Frontend dependency audit | 0 reported advisories at the checked lockfile versions | Does not certify application logic or native dependencies |
| Backend dependency audit | 0 reported advisories; 0 abandoned packages | Checked locked dependencies |
| Credential scan | 0 non-placeholder candidates in the performed tracked-source scans; no tracked actual `.env` found in the inspected refs | Not a full secret-manager, production environment or complete historical entropy audit |

The main frontend entry bundle is approximately **265 kB minified / 82 kB gzip** after route splitting. Optional parking-map and recognition assets are larger and need real slow-device/network acceptance.

### Concurrent outcomes

| Scenario | Result |
| --- | --- |
| 8 entries for one vehicle | 1 granted, 7 already inside; one active stay |
| 8 exits for one stay | 1 completed, 7 not inside |
| 8 owners competing for 5 free slots | 5 granted, 3 denied; five distinct slots |
| 8 RFID assignments to one vehicle | 1 assigned, 7 validation errors; one active assignment |
| One guest enters two vehicles across car/motorcycle areas | 1 granted, 1 denied; one active stay |
| 8 approvals of one visitor request | 1 approved, 7 conflicts; one QR pass |
| 8 competing approve/reject decisions for one pending account | 1 decision, 7 conflicts; one decision audit record |

The repeatable harness is in `tests/Concurrency/verify.php` and `worker.php`. It requires a **new, dedicated database ending in `_concurrency_testing`**, already migrated and configuration-seeded. It refuses a database containing users or vehicles and does not delete existing records.

### Interactive flows exercised

- Invalid and valid login; session refresh; contact persistence; failed session restore with retry; logout and history navigation.
- SHS manual-review registration → email code → pending-only access → administrator approval → dashboard → password change → old token revoked.
- Guest registration → email code → login → vehicle registration → request wizard → same-day rejection → future-date submission with both private photos → administrator approval → QR pass listing.
- Selecting the other vehicle → its RFID admission → denial of the inactive vehicle's RFID → switching disabled during the stay → exit releases the stay.
- Pending accounts remain signed in without calling protected background services; inactive account handling; legacy administrator email-state compatibility; persisted-page session revalidation.

Uploaded browser fixtures were synthetic documents. These flows **do not prove document authenticity or OCR recognition accuracy**.

## Confirmed findings fixed in the source bundles

| Finding | Reproduced / observed behavior | Delivered change |
| --- | --- | --- |
| Password recovery | UI simulated success; real API threw `Route [password.reset] not defined`; reset page was not routed | Real request/reset flow; trusted `FRONTEND_URL`; mounted reset page; atomic password/token update, single-use reset and session revocation |
| Profile | Hardcoded phone number and demo save/password buttons | Own profile API, persisted contact, current-password validation, real password change and audit events |
| Add User | Missing POST endpoint returned 405; UI required an invisible department and sent department ID 9 | Admin-only staff creation; server resolves Security Office and assigns only Parking Staff; correct form validation |
| Personal parking history | Mock records; endpoint absent | Own historical transaction query with date/search/pagination and loading/error/empty states |
| User list | Only the first 15 users were accessible; role filter operated on that page | Server role filtering and visible pagination |
| Rate limits | Sync polling consumed an unrelated RFID write budget | Separate action prefixes and isolated named document limits |
| RFID authorization race | A tag revoked between initial identification and entry locking still admitted a vehicle | Fresh credential/owner/vehicle checks under consistent locks; area lock before snapshot reads; bounded database retries |
| Entry/exit consistency | Concurrent operations could contend under inconsistent lock order | Owner/vehicle locking and retries; emergency-release paths use the same lock order |
| Guest admission | Previously approved QR could admit a deactivated linked guest | Shared pass policy checks active/verified guest and blacklist state |
| Identifier aliases | Different separators could register the same physical plate; normalized account IDs lacked a database invariant | Normalized unique generated columns/indexes, duplicate preflight and normalized plate lookup |
| Account decisions | Pending-state check happened outside the decision transaction | Locked pending account decision with a single winner and conflict responses |
| Unknown exit audit | Unrecognized exit was not retained as a denied event | Denied exit event is recorded while preserving the response's existing not-found status |
| Image work bounds | Compressed dimensions and extreme aspect ratio could reach expensive decoding/upscaling | Reject oversized dimensions before decode; bound working dimensions and upscale |
| Password input | New passwords could exceed bcrypt's byte capacity; nonstring guest input needed a controlled validation path | Explicit 72-byte validation for newly set passwords; invalid input returns validation errors |
| Session restoration | Temporary network/server failure erased a saved session | Preserve session on reachability failures; retry/sign-out controls; expire on authoritative invalid-session response |
| Pending-session regression caught during this audit | New invalid-session handling initially logged out a pending user after a protected background poll | Pending/unverified status screens are isolated from protected data providers; full registration-to-approval flow retested |
| Stale client state | Late requests could update the wrong filter/account; background polls could continue after unmount | Cancel/ignore stale work, remount account-specific services, cross-tab and persisted-page revalidation |
| HTTP/loading behavior | Requests could wait indefinitely or treat invalid successful JSON as an empty success | Header/body deadline, safe error messages, request cancellation, no automatic mutation retry |
| Routes and page failures | Missing reset route; silent unknown-route redirect; fake mobile demo exposed as an entry page | Reset route, explicit not-found page, lazy route loading, error boundary and real mobile-web sign-in entry |
| API errors without JSON header | Local reproduction and live unauthenticated `/api/me` probe returned 500 because the login redirect route did not exist | API errors render JSON; authentication failure returns 401; private/no-store error headers |
| Public registration diagnostics | Scores, thresholds and internal checker details were returned to public forms | Public status/message/suggestions/receipt allowlist; detailed evidence remains in authorized staff review |
| Identity casing / stale upload suggestions | Newly entered names/IDs could have inconsistent case; a replaced upload could retain old suggestions | Uppercase identity inputs/server values and clear prior upload suggestions; preserve leading zeros |
| Permission reference | Visitor and vehicle/gate reference rows did not match enforced roles | Reference now distinguishes admin approval from staff gate operations |
| Production default seeding | General seeding invoked a development-only demo seeder | General seeding creates configuration only; demo fixtures remain explicit and environment-guarded |

Hiding diagnostic conditions is a UI/privacy change. Authorization, receipt binding, validation and database constraints remain the security controls.

## Open launch blockers

| ID | Priority / classification | Required resolution |
| --- | --- | --- |
| L1 | **P0 release alignment** | Reconcile backend main with the audited review/staging work while preserving team changes. Deploy matching BE/FE revisions, set the correct frontend origin, and run authenticated deployed smoke tests. The local bundles are not a deployment. |
| L2 | **P1 identity correctness and trust** | Reproduce the actual unmarked College/Employee files, including long first names, complete surnames, suffixes and ID numbers. The underlying reported OCR extraction defect is still open. OCR text matching alone does not establish current DYCI affiliation or document authenticity; require a trusted membership check or staff approval before treating activation as trusted. SHS remains manual until its format is confirmed. |
| L3 | **P1 unfinished account lifecycle** | Add and test authorized identity correction, pending/rejected ID resubmission, and suspension/deactivation/reactivation of active accounts. Current management handles staff creation and pending approval/rejection, not a complete maintenance workflow. |
| L4 | **P1 unfinished settings scope** | Parking, Access Control, Notifications and Security settings are disabled previews. Logo upload returns 501. General preferences persist, but global application of timezone/date/display preferences is incomplete. Complete these features or formally remove them from the launch scope. |
| L5 | **P1 missing user-facing content** | Terms and Privacy Notice are consent text without working document pages/links. Publish the school-approved content and test links before collecting launch registrations. |
| L6 | **P1 rollout validation** | Public registration/OCR/email limits are shared by IP. The current 5 registrations and 6 fresh OCR reads per minute/IP can constrain a shared school network. Test expected enrollment volume, bounded OCR concurrency/queueing and web-worker behavior before campus-wide use; do not raise limits blindly. |

### Release checks still requiring the operator / actual environment

- Confirm the Railway source branch and matching Vercel revision. A read-only live probe found the old public registration-options contract and the unauthenticated 500 described above.
- Set `FRONTEND_URL` to the actual HTTPS web origin in production. Verify a real email-code delivery and password-reset link using an owned mailbox.
- Verify license/OCR queue workers, PHP GD/Exif/Tesseract/PDF dependencies and failure recovery on the actual deployment.
- Verify durable private upload storage, backup restoration, database account privileges, production debug settings and environment secrets. These were not accessible for a production configuration review.
- Exercise populated histories/reports, large uploads, dropped responses, slow connections and expected user counts through the real deployed HTTP stack. The vehicle listing still has unpaginated/per-row query behavior that needs scale testing.
- Test actual Android/iOS browsers and browser-history restoration. Native app builds, device permissions and physical RFID/servo/sensor integration remain separate work.

Recorded availability is based on transactions/staff observations. This audit does not certify physical slot sensing or site measurements.

## Import and verification

Download both matching bundles and use `feature/prelaunch-audit-20261020` from each. Create a new review branch from `FETCH_HEAD`; Git must stop if local changes would be overwritten. Preserve the owner's existing `.env`, private uploads and local files.

The new backend migration is:

`2026_10_20_010000_enforce_normalized_identifier_uniqueness.php`

It checks for existing separator aliases before schema changes and **does not delete or merge accounts/vehicles**. If it stops, review the conflicting ownership/records first. Do not bypass the index or reset the database.

After a successful review checkout:

1. Set the backend frontend origin, clear configuration/routes, and run `php artisan migrate`.
2. Migrate the dedicated testing database and run `php artisan test`. A fresh testing database also needs RoleSeeder, DepartmentSeeder, VehicleTypeSeeder, ParkingAreaSeeder and ViolationTypeSeeder.
3. In FE run `npm run test:http` and `npm run build`. Dependencies and lockfiles were not upgraded by this patch.
4. Repeat the owner's real account/ID/device acceptance and close L1–L6 before claiming public launch readiness.

Runtime source fixes are committed. No force push, operating-database reset or deployment was performed.
