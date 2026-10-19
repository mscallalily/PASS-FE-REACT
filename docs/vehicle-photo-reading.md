# Vehicle photo suggestions and license retry isolation

## User flow

Regular users: My Vehicle → Register Vehicle → upload the required JPG/PNG photo → Read vehicle photo → compare the preview and suggestions → Use these suggestions → edit details and submit. Existing license, photo, ownership and staff authorization requirements still apply. No automatic RFID assignment or vehicle approval is added.

Guests: My Vehicles → optional photo for suggestions → read/apply/edit → register declared vehicle details. This analysis photo is temporary; the visitor request still requires its existing vehicle photo and document checks. No QR pass is issued by this reader.

When several vehicles are detected, the user must choose one before plate OCR runs. Changing/removing the file invalidates previous suggestions and cancels its request. Manual entry remains available if detection/OCR fails. Applying suggestions never submits the form.

## Recognition and limitations

- A self-hosted COCO-SSD SSD Lite MobileNet V2 model detects broad car/motorcycle categories in the browser. Inference runs on a dedicated CPU Web Worker, so model loading and prediction cannot block the form. Detection uses a resized copy (up to 640 pixels); plate OCR/color sampling retain the larger photo. A 45-second worker deadline terminates an unavailable/stalled reader and permits manual entry. The first read downloads about 18 MB of bundled weights from the app itself. Model JavaScript is lazy loaded; no cloud vision key or third-party image upload is required.
- This is not exact wheel counting or body-style classification. Motorcycle can fill that type; car users choose Sedan/SUV/etc. Truck/uncertain detections require manual category confirmation. Small/background objects below configured thresholds are ignored; visually inspect the original photo.
- Color is a coarse central-body pixel estimate, not a trained paint classifier. Lighting, reflections, chrome, tinted windows, decals and multiple colors can cause errors. All suggestions are editable; no accuracy percentage is promised.
- Laravel/Tesseract reads the selected vehicle crop, then full/lower grayscale variants. Only common printed plate patterns are recognized. Leading zeros are preserved; letters are never silently converted into digits. Special, temporary, personalized or unreadable plates can be entered manually.
- One unambiguous plate with plate-token confidence ≥70 is suggested. Multiple/weak candidates need explicit user selection after checking the photo. Full-image average OCR confidence cannot certify the plate.
- A photo/OCR match does not prove ownership, document authenticity, or permission to enter campus. Existing staff authorization, selected-vehicle, one-vehicle-inside and RFID/gate rules are unchanged.

## API and privacy

`POST /api/vehicles/read-photo`, multipart field `vehicle_photo`.

Requires an authenticated, email-verified active account with an active student/faculty/employee/guest role. Admin-only/security-only accounts cannot use this owner/guest suggestion endpoint. JPG/PNG only, maximum 5 MB and 20 megapixels. Uploaded images are temporary and not stored by the read endpoint. Response has `Cache-Control: private, no-store`; no raw OCR/path is returned. Existing registration/request endpoints retain their own private photo storage.

Response: `{ data: { status, plate_number, candidates: [{ plate, confidence }], message } }`. Status is suggested/review_needed/unavailable. An unavailable engine permits manual entry; it is not a finding that the vehicle is invalid.

## Too Many Attempts fix

Numeric Laravel throttles without distinct prefixes previously shared an authenticated user's signature across polling and write routes. Background `/api/sync/revision` polling could exhaust the effective license submission budget.

Named per-user limits now isolate `license-submit` (10/minute), `license-recheck` (10/minute), and `vehicle-photo-read` (6/minute). Other routes retain their existing policies. A real limit returns HTTP 429, Retry-After and `{ code: "rate_limited", action, retry_after, message }`. License and photo-reader buttons display a countdown and preserve entered details. License submission has an immediate double-click lock. Polling no longer consumes these three budgets; each user's budget is independent.

## Installation

Import matching BE/FE bundles on the same working code line. No new migration, Python, model-server process or API key is needed. Existing PHP GD and Tesseract setup must work for plate OCR.

Backend: `php artisan route:clear`, then `php artisan test --filter="PhotoReadAndLicenseThrottleTest|VehiclePlateReaderTest"`. Restart a long-lived application/queue server when loading new code.

Frontend: stop Vite (Ctrl+C) before `npm ci` so Windows does not lock native dependencies. Run `npx tsc --noEmit`, `npm run build`, then `npm run dev`. Keep `public/models/vehicle-detector/` and all five shards when building/deploying. Dependencies are pinned in package-lock.json. Model provenance, license and SHA-256 hashes are beside the model assets.

## Acceptance still required

Try actual local vehicle photos in daylight and poor lighting, a clear and unreadable plate, motorcycle and car, several vehicles, manual corrections and slow phone hardware. Confirm original-photo staff review and existing authorization/RFID rules. Development screenshots and synthetic plate tests are software checks, not a measured Philippine plate/paint recognition accuracy study.
