# A14 follow-up — repository path identity

Review date: 2 November 2026 (Philippine client date).

The A14 source update installed, but its first Windows run stopped at `releaseReview.test.mjs:40`: the temporary repository had two tracked synthetic private-file candidates, while the inspector reported zero. This assertion runs before the historical-file assertion; it is not evidence that actual application records or old SQL blobs were deleted.

## Reproduced defect and correction

The inspector compared Git's top-level path and the requested folder with `path.resolve` and a Windows case fold. Two spellings of the same directory can differ: a directory alias/junction, an expanded Windows short name, or another resolved filesystem path. In the isolated reproduction, the original inspector recognized both tracked files through the real path but treated an alias of that same repository as unavailable and returned no candidates.

The corrected check compares directory identity with BigInt device/file IDs when available. It resolves canonical filesystem paths as a fallback where IDs are unavailable. It still rejects a child folder that merely inherits its parent's Git repository, including an aliased child. Missing or unverifiable metadata remains REVIEW rather than a healthy empty-history result.

The inspection's Git child processes also discard inherited `GIT_*` overrides, so another shell operation's Git directory/worktree/index does not redirect this three-repository review. It remains a local metadata inspection; it does not fetch, rewrite history, read environment/SQL contents, or change user records.

## Test isolation and verification

The original two-file and retained-history assertions remain. The synthetic Git fixtures use isolated system/global configuration, empty hooks, disabled signing/fsmonitor and explicit synthetic paths, avoiding project Git writes. New regression cases verify:

1. The same repository through a directory alias still exposes its tracked private-file candidates and retained history after untracking.
2. An aliased child cannot substitute its parent's repository.
3. Inherited Git directory/worktree/index overrides cannot redirect the inspector to another synthetic repository.

The alias fixture uses a junction on Windows and a directory symlink on POSIX; an environment that prohibits aliases reports that specific extra case as skipped. The original tracked-file/history check is retained and must pass when Git is available. A failed root check now has an explicit diagnostic assertion before the file count.

Verification in the review environment covers the complete website Node suite, TypeScript, production build, map build checks and source-updater backup/rollback checks. The reproduced alias behavior was exercised on Linux; the user's Windows rerun is still required. No claim is made that a Windows runtime was used in the review environment.

This follow-up changes only `tools/Inspect-PassRelease.cjs`, `tests/releaseReview.test.mjs` and this guide. Run the small follow-up updater, then repeat the website checks/build/inspection from the chat. A09 and actual deployment/device acceptance remain open.

Primary API references:

- https://nodejs.org/docs/latest-v24.x/api/fs.html — directory metadata, BigInt stats and native realpath.
- https://git-scm.com/docs/git-rev-parse — repository top-level discovery.
- https://github.com/nodejs/node/issues/50019 — Windows mountpoint path spelling can differ for the same filesystem object.
