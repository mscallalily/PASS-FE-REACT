# PASS independent parking proposal — 18 October 2026

The corrected owner-numbered outline produces **45 full-size independent proposed car positions**. This is a conditional geometric arrangement, not a surveyed capacity, proven maximum or turning certification. It supersedes the previous 32-position arrangement and its incorrect interpretation of all eight supplied values as consecutive boundary edges.

## Corrected dimensions

| Owner number | Segment | Metres |
| --- | --- | ---: |
| 1 | Right boundary | 18.42 |
| 2 | Lower-right boundary | 12.04 |
| 3 | Lower pink/notch segment | 2.60 |
| 4 | Lower diagonal | 20.18 |
| 5 | Long left diagonal, starting at the motorcycle end | 33.37 |
| 6 | Top boundary | 49.26 |

The upper pink junction is **3.36m**. The owner corrected the earlier lower-pink 3.00m to **2.60m**, the same segment as #3; it is counted once. Neither 3.00m nor an additional duplicate opening is included in the perimeter.

The car parcel shares the **8.80m end of the motorcycle parcel**, which the old model omitted. This restores the longer left-side connection. The remaining short NW return is estimated at **4.66m from the image**, not measured by the owner. All bearings are reconstructed from the image. Consequently, the implied polygon area and bay count are conditional on those estimates. They must not be presented as surveyed land area or approved physical capacity. See `parking-boundary-input-review.md` and the numbered source image.

## Row arrangement

| Row | Codes | Regular bays |
| --- | --- | ---: |
| North perimeter | C-01–C-17, C-42 | 18 |
| Interior row A | C-18–C-32 | 15 |
| Interior row B | C-33–C-40 | 8 |
| South row | C-41, C-43–C-45 | 4 |
| Inventory without measured positions | C-46–C-55 | 10 unresolved |

All 45 proposed car bays, including C-42, are regular **2.50 × 5.00m** bays. The prototype has no PWD eligibility or reserved-bay allocation workflow. The C-42 PWD designation has been removed at the owner’s request; this does not settle campus physical accessibility requirements. All proposed bays have their own frontage; no tandem or blocked bays are used. North-perimeter sections use separate spacing grids around C-42 rather than wasting a regular position to maintain one global grid.

Internal car frontages are **4.50m** deep. This is a **tight concept design allowance**, not a claim of a legal standard aisle or suitability for every vehicle. The widest owner-measured car body is 2.0447m, excluding mirrors, and the longest is 4.7752m. Mirrors, wheelbase, steering lock and actual reversing/turning movements were not measured. A connected 3.06m geometric envelope does not prove those vehicles can complete every turn. Validate the narrower aisles, end manoeuvres and the estimated boundary on site before marking bays.

The separate diagonal shared approach remains **3.06m**, with the same gate location and alternating entry/exit. It is not two simultaneous car lanes. The motorcycle parcel remains **30.96 × 8.80m**, with 84 compact **1.00 × 2.00m** proposed bays, two 1.20m walk/push aisles and a 2.56m connecting end aisle. These narrow motorcycle dimensions require actual vehicle and campus confirmation.

## Live inventory and shared UI

All **55 car + 84 motorcycle = 139 inventory records** remain. Coordinate refresh changes drawing positions only; it preserves IDs, operating capacity, statuses, transactions, gate state and access policies. Ten car codes have no proposed physical position. The Inventory diagram UI is removed. All codes remain in the database; the ten unpositioned codes have no invented physical bay symbols.

Plan, 3D and SVG fallback consume the same geometry across admin, parking staff, regular users and guests. Use Show measurements for per-bay W/L labels and Measurements & design basis for the full slot table, source images and assumptions. Private availability remains sign-in restricted and redacted for users/guests.

## Validation and physical review

Software regression checks cover the owner-numbered lengths, shared motorcycle endpoints, estimated-edge disclosure, unique codes, bay sizes, whole-edge parcel containment, no bay/bay/road/frontage/connector overlap, clear flow arrows and preservation of operating data. A 0.25m connection grid with 1.60m edge clearance checks every frontage connects to the shared approach; it does not simulate steering. Browser checks cover desktop/mobile Plan/3D, slot selection, physical-size labels, source evidence, read-only admin access, staff controls and SVG fallback.

Before physical use: verify the short NW return and boundary bearings; test actual vehicles and mirrors through all manoeuvres; confirm pedestrian and accessible routes, slope, drainage, accessible-space count, motorcycle circulation and campus approval. The 45 proposal and 55 configured inventory must not be treated as an approved operating-capacity decision.

Suggested defense wording: “PASS retains the campus-reported 55-car inventory. Our current reconstructed outline contains 45 full-size independent candidate positions. The short NW boundary and bearings are estimates, and the 4.50m aisles require actual manoeuvring validation. The remaining ten inventory positions have no established measured placement. Software checks establish consistent geometry, not certified physical capacity.”

## References for dimensions

- DPWH Department Order 56 (2016), Annex A, car bay dimensions: https://www.dpwh.gov.ph/dpwh/sites/default/files/issuances/DO_056_s2016.pdf
- NCDA revised 2024 BP 344 IRR, accessible parking: https://ncda.gov.ph/revised-2024-rules-and-regulations-implementing-batas-pambansa-344/
- North Tyneside Council, Transport and Highways SPD 2022, Appendix E, compact motorcycle design reference, not a Philippine legal minimum: https://legacy.northtyneside.gov.uk/sites/default/files/web-page-related-files/Transport%20and%20Highways%20SPD%202022.pdf

## Delivery

Matching PASS-parking-ui-cleanup-backend.bundle and PASS-parking-ui-cleanup-frontend.bundle, branch feature/parking-readonly-ui-20261018. Cumulative bundles include prior parking updates. No migration or operational reseeding. After backend merge run route:clear and parking:refresh-layout; build frontend. See the frontend `docs/parking-capacity-import.md` for guarded commands.

Current UI/access cleanup: see `parking-ui-cleanup.md`. Administrators monitor the layout without operational controls; only Parking Staff may mutate the live Parking Operations endpoints. The upper junction has a human-readable label.

Verification: Laravel 128 tests passed (52,738 assertions); TypeScript check and Vite production build passed. Browser verification passed 341 checks across admin/security/student/guest at 320px and 1440px plus a 390px admin SVG fallback, with zero JavaScript page errors. Checks cover absence of Inventory diagram, human-readable junction dimensions, admin read-only controls before/after slot selection, staff maintenance/return-to-service and gate form, live record preservation, slot sizes, Plan/3D and overflow.
