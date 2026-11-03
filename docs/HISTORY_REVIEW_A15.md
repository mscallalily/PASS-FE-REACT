# A15 — targeted local history triage

The Windows A14 follow-up passed 57 web tests, the production build and 66 map-build checks. Its filename classifier also marked `storage/app/private/.gitignore` as private uploaded content. That exact repository-root protection filename is now exempted; neighboring files and nested lookalikes remain candidates. Do not remove the protection file.

`node tools/Inspect-PassHistory.cjs` adds a separate read-only check for the indexed protection rules and selected historical SQL/environment blobs. Run it from PASS-FE-REACT with all three PASS repositories beside each other. `--json` provides the same redacted information as JSON. A successful command exit means the tool ran, not that the system is launch-ready.

## Output and limits

- The protection check reads the Git index blob, never follows a working-tree symlink, and recognizes only `*` followed by `!.gitignore`, with optional blank/comment lines. Unstaged changes and actual hosted storage configuration are outside this check.
- History selection includes root/nested, case-insensitive `.sql`, `.sql.gz`, `.sql.zip`, `.sql.enc`, `.env` and `.env.*` paths across existing local refs. Names ending `.example`, `.sample` or `.template` are excluded for environment templates. No remote is contacted. Reflog-only/unreachable objects and uncommitted file contents are outside scope.
- Output contains fixed key/table categories and counts. Nonempty allowlisted dotenv credential fields are candidates, not verified live credentials. SQL INSERT/REPLACE VALUES headers are statement candidates, not a row/person count or proof of real production records. Unknown table names, values, paths, SQL rows and Git error details are withheld.
- SQL comments and ordinary quoted values are masked before header detection. This is a targeted MySQL-dump heuristic, not a complete SQL parser or general secret scanner. Credentials in arbitrary source files, alternative variable names, other SQL formats and document contents are not certified safe.
- UTF-8 and BOM-marked UTF-16LE/BE are supported. Compressed/encrypted filenames are explicitly skipped even if their bytes look like text; nothing is unpacked or decrypted. Binary, invalid text, missing objects, shallow history and exhausted bounds remain coverage gaps.
- Per repository: at most 4,000 selected metadata objects, 120 blobs, 4 MiB per blob and 32 MiB of blob contents. One 40-second deadline is shared by the three-repository CLI run; each Git child also has a 10-second cap. Oversized metadata output fails closed. Partial results never turn into a clean release decision.
- Git runs without a shell, inherited `GIT_*` overrides, replacement objects, optional locks, lazy fetch, filters or text conversion. Git must support `--no-lazy-fetch`; unsupported versions report a coverage gap instead of retrying with network access. Git 2.49+ is recommended.

## Interpreting the next result

`CHECKED_SCOPE` means these selected patterns were assessed without a matching finding or coverage gap. It does not mean the repository is free of secrets. `REVIEW` means a candidate or gap remains. The final output always withholds release clearance.

If SQL data statements are found, an owner must privately distinguish synthetic test fixtures from actual records. If credential candidates are found, privately establish whether they were genuine and whether they remain in use. Do not paste original `.env`, SQL values, keys or records into chat. Redacted terminal output is sufficient for the next assessment.

No automatic rotation, `key:generate`, history rewrite, deletion, database command, Git push or remote scan is performed. An exposed Laravel APP_KEY needs a controlled plan that preserves access to existing encrypted data and backups; do not replace it blindly. Any history cleanup must be coordinated with collaborators.

## Remaining launch gates

A09 remains open for deepmerge (Jest), glob and minimatch. Actual hosted environment/API/database isolation, storage, mail/workers/backups and real device/OCR/hardware/concurrency acceptance remain unverified. This tooling update changes no runtime UI, dependencies, environment, database or hardware settings. Formal app/web acceptance can remain deferred until the agreed source-fix phase is complete.

## Primary references

- NUL-delimited historical file diffs, including merge parents: https://git-scm.com/docs/git-log
- Object metadata/content reads: https://git-scm.com/docs/git-cat-file
- Disabled replacement objects, lazy fetch and optional locks: https://git-scm.com/docs/git
- Coordinating remediation of sensitive repository data: https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository
