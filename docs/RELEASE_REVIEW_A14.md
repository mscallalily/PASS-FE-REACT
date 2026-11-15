# Release review after source fixes — 1 November 2026

Status: **release not cleared**. Source fixes and automated checks can be completed before the team's formal app/web acceptance, but passing that acceptance is part of deciding whether the system is complete.

## Source batches already delivered

A01 reconciled the license-review migration. A02–A06 corrected native forms, operations/role contracts, bounded API handling and session recovery. A07 addressed shared-campus registration limits for the stated 1–10 concurrent applicants while retaining abuse controls. A08 corrected website type compatibility. A10 added native inventory/records administration, A11 bounded list APIs and clients, A12 separated hardware setup from operational pages, and A13 corrected registration category classification/current-flow tests. A14 makes the web plan independent of the optional 3D renderer and adds local release-source inspection.

These descriptions concern the reviewed patch sequence, not independent proof that a teammate's later edits, the hosted environment or every real document template have passed. Current-file guards stop the source updater on an unreviewed file version.

## A09 remains open

The reviewed SDK 58.0.22 / React Native 0.88.1 native lock retains CLI 58.1.18, config 58.0.10 and node-forge 1.4.2. Earlier fixes upgraded Symfony MIME and Forge, removed Zod from Expo CLI and removed deepmerge from Expo config. A fresh website audit returned zero findings. The native audit still reported 31 moderate and 1 low affected package entries, with no high or critical entries; these propagated entries are not 32 separate vulnerabilities.

The remaining roots are deepmerge (Jest), glob and minimatch. The published latest deepmerge remains 4.3.1, while Jest configuration still requires it. The installed supported Jest/Expo consumers require glob 13.x, while the advisory's patched glob is 14.0.2 and minimatch's patched major is 11.0.1. Forcing incompatible major overrides is not a reviewed fix. Keep configurations, test presets and filesystem patterns trusted, and restrict Metro to the intended development network while a supported remediation is assessed. A09 is not closed by this map patch.

Primary advisory references:

- https://github.com/advisories/GHSA-gcqx-w48m-w2h4
- https://github.com/advisories/GHSA-3g3m-2fjr-6pw4
- https://github.com/advisories/GHSA-g3hv-75wg-m249

Audit databases and compatible package releases can change; these are the completed review's results, not a permanent guarantee.

## Deployment/source gates

`vercel.json` currently fixes `/api/:path*` to one Railway HTTPS destination. The local `PASS_API_PROXY_TARGET` Vite setting does not replace that deployment rule. Confirm the intended staging and production backend/database before publishing. A host name containing “production” does not prove which database it uses, and the review makes no writes to that host. The patch does not guess a future domain or change this destination.

`tools/Inspect-PassRelease.cjs` inspects current tracked filenames, selected SQL/environment history filenames, and the Vercel API rule. It does not read environment contents, SQL rows, private uploads or historical blobs, and does not fetch, push, rewrite history, run database commands or change configuration. Configuration templates are distinguished from real environment filenames; a parent Git repository is not substituted for a missing individual repository. Candidate filenames prompt private inspection rather than declaring a secret exposure. A zero tool exit status means the inspection completed, not release approval.

Two SQL backups were previously untracked, but old Git blobs can remain. Review actual repository history/access to determine whether private records or secrets were present. If an actual secret was exposed, remediate that exposure and rotate the relevant secret; a SQL filename alone is not proof. The supplied source ZIP omits history, so this part needs evidence from the user's real repositories.

The backend already contains `php artisan pass:check-production` (and its Railway option). Run it against the intended hosted configuration when deployment is being prepared. It checks effective Laravel settings, extensions/tools, real mail transport configuration, persistent rate limiting and private storage; its temporary private-storage probe is created and removed. Its success still does not prove actual inbox delivery, database backups, deployment isolation or worker/scheduler operation. Do not change a local LAN setup to production merely to make the checker green.

Before deployment, verify HTTPS, debug disabled, the intended API/reset/capture origins, restricted database access, retained encryption keys, persistent private storage, backups/recovery and the actual mail/queue/scheduler setup. Never share an unredacted environment file or database dump as inspection output.

## Later formal acceptance

Use owned test accounts and the exact revisions that will be deployed. Cover login/logout/recovery; college/SHS/employee registration and readonly institutional/license results; real OTP/resend/camera/retake/cross-device handoff; OR/CR create/correction; RFID register/auto-assign/hand-over/revoke/replacement; visitor QR and emergency exit permissions; parking assignment/history/notifications; and slow/offline/invalid/concurrent requests.

Historical PDF inspection remains an authorized website workflow where the native client directs it there; do not describe that as complete native document-viewing parity. No implemented payment checkout/ledger/webhook was found in the reviewed source.

The hardware is a servo-disabled prototype. One configured sensor reports that station's state, which alone does not identify a vehicle or certify every physical slot. Actual OLED/reader/sensor reconnection and stale-state checks, physical phone camera/QR permissions, supported devices and installable release builds remain acceptance gates. Formal testing may follow the source fixes, but these gates cannot be certified from source or mocked tests alone.
