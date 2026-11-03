# Hardware workspace and task-first layout — audit A12

`Hardware & Station` is a dedicated protected page at `/app/hardware`, linked
from the admin and Parking Staff navigation. General System Settings remains
separate. The hardware setup form no longer appears above User Management,
Records & History, vehicle authorization reviews or unrelated tasks; those
pages no longer mount or poll the slot-station panel.

Parking Staff retain a compact read-only sensor summary on Dashboard, Gate
Monitoring, QR Verification, Occupancy Monitor and Emergency Vehicle Release.
It includes occupancy and arrival feedback without binding controls. The full
station information and configuration live in the dedicated workspace.

## Permissions and gate results

The existing backend policy stays authoritative: Parking Staff configure
physical stations; administrators view them read-only. Setup controls require
both the staff role and the server's `can_configure` permission. Regular users
receive neither hardware navigation nor station polling. No API permission,
reader key, firmware, wire or actuator rule changes in this batch.

Idle gate notices are hidden on normal pages. Active results and required
reviews of uncertain outcomes remain visible across navigation. An uncertain
result cannot be dismissed or repeated until the existing record review is
checked and confirmed. Completed informational notices may be dismissed. A
later hardware acknowledgement or failure raises a new notice. Changing the
account/token clears the old notice and invalidates old callbacks; navigation
by the same account preserves the review. Browser presentation never cancels
or repeats a recorded backend action. Servo control remains disabled.

## Loading, saving and mobile use

Station reads stop on unmount or hidden tabs, resume with a fresh check, and
back off after errors. Reads do not overlap configuration saves. Stale or
unverified responses do not retain healthy/arrival badges or enable saving.
Incoming JSON is validated; database flags `0` and `"0"` are explicitly false.
Malformed or unconfirmed save responses are errors, never invented successes.
Writes have an immediate double-submit lock and are not retried automatically.
Failed inputs remain selected so staff can check the current mapping first.
The backend still validates reader/area/slot choices and serializes competing
configuration writes.

The mobile form stacks fields, wraps long labels and provides 44-pixel
controls. Navigation closes the mobile menu and returns the main content to
its top. Existing branding and route guards are retained.

One sensor monitors one fixed physical slot. Moving it requires selecting its
new slot and restarting the station; page navigation never reconfigures it.
Occupancy detects an object, not vehicle identity. Staff must still verify the
vehicle even when the OLED has guided it to that slot.

## Validation and remaining work

Checks use production builds in headless Chromium at 320, 360, 390, 768 and
1280 pixels with synthetic API responses, screenshots and overflow/control
measurements. They cover readonly admin/denied regular-role routes, mobile
navigation, stale/hidden-tab reads, double submissions and failed writes.
Actual React panels/AuthProvider are exercised in JSDOM across navigation
and account changes. Node tests cover response parsing and the notice/review
lifecycle. Existing backend station/readonly permissions tests run only on
an isolated synthetic database. No user database, inbox or physical hardware
is used. These checks do not replace tests on actual supported devices.

A09's remaining dependency findings, the separate 3D bundle warning and deployment,
camera, inbox and hardware acceptance remain open. Historical PDF inspection
remains on the authorized website as documented in A10. Passing this batch
does not establish launch readiness.

The updater backs up exact original source bytes and stops on unreviewed
changes. It does not run migrations, install dependencies, edit environment
or hardware configuration, flash Arduino, commit or push Git. Runtime changes
are web-only; backend/native changes update documentation. Run the supplied
web checks, then refresh with Ctrl+Shift+R.
