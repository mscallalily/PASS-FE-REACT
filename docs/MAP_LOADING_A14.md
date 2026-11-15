# A14 — Optional 3D loading and usable plan fallback

The staff Parking Layout previously mounted the Three.js renderer for both its 3D and Plan buttons. Its first visit also defaulted to 3D. The reviewed build contained a roughly 980 kB minified renderer chunk, and a failed module download could reach the page-level error boundary.

## Resulting behavior

- A first staff visit opens the lightweight SVG plan. An explicitly saved 3D preference is retained.
- The staff plan supports slot selection, area focus, zoom, measurements and existing record entry/exit controls without requesting the renderer.
- The optional renderer downloads when 3D is selected and WebGL2 is available. The public/read-only map keeps its existing plan default.
- A working plan remains visible during loading. After 15 seconds the notice explains the delay and offers Use plan view. Choosing the plan prevents a late download from replacing it.
- A failed entry/vendor chunk, unavailable WebGL, rendering failure or lost WebGL context falls back within the map. Existing account state and surrounding forms are retained. Retry is explicit; a stale deployment asset can still require a later page refresh.
- The existing proposed geometry, inventory/capacity warnings and server-authoritative availability remain. The availability copy now limits any sensor status to its configured station rather than claiming there are no connected sensors anywhere.

## Build and verification

Vite 8/Rolldown splits the Three.js dependency without pulling its dependencies recursively into an eager vendor group. The production manifest is emitted for `tools/Check-PassMapBuild.cjs`. The default chunk warning threshold is retained; no warning limit was raised and no dependency versions were changed.

In the review build, the old 979,624-byte renderer chunk became an approximately 220 kB renderer plus two optional Three.js chunks of approximately 377/386 kB. The largest JavaScript file is below 500 kB. Splitting does not make the complete 3D scene smaller overall or prove better frame rate on a phone. The main improvement is that the plan does not download or initialize optional 3D code.

Verified in an isolated production build with synthetic accounts/API responses:

- TypeScript and the complete website Node test suite.
- Build structure: the renderer and Three.js chunks are absent from the entry/plan static import graphs; files remain below the 500 kB JavaScript budget and adjacent source maps are absent.
- Real Chromium browser: staff plan and gate-form access; regular-user permission boundary; staff and regular views at 360 px; no WebGL; failed entry and shared-vendor downloads; slow loading and late completion; real 3D scene rendering, context loss and explicit retry. The browser tests perform no API mutations.
- Source installer: reviewed-file guards, exact backups, rollback, repeated-run no-op, concurrent-edit preservation, Windows BOM/CRLF and link/collision refusal.

The browser uses a software WebGL implementation on Linux and synthetic API responses. This is not physical-phone performance, actual reader/sensor acceptance, a release APK/AAB, or testing against the team's database. Native runtime code and backend API contracts are not changed by A14.

## Local commands

```
node node_modules/typescript/bin/tsc --noEmit
node --test tests/*.test.mjs
node node_modules/vite/bin/vite.js build
node tools/Check-PassMapBuild.cjs
node tools/Inspect-PassRelease.cjs
```

The last command is an informational, read-only inspection with explicit REVIEW items. An exit code of zero means the inspection ran; its output explicitly withholds release clearance.

Primary implementation references:

- https://v8.vite.dev/guide/build — dynamic-import failures, build output and chunk splitting.
- https://rolldown.rs/reference/OutputOptions.codeSplitting — bounded dependency groups and recursive-dependency behavior.
- https://react.dev/reference/react/lazy — rejected imports require a local error-handling path; Suspense alone is a loading state.

Actual device acceptance and the outstanding security/deployment gates are recorded separately in RELEASE_REVIEW_A14.md.
