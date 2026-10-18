# PASS marked parking lineup — 18 October 2026

The owner-marked sketch is the row-placement reference: red car rows, yellow motorcycle parcel, green shared access. Its cumulative ruler marks are not parcel dimensions. The supplied car edges and 30.96 × 8.80 m motorcycle parcel are retained; the separate shared road remains 3.06 m.

The revised arrangement contains **32 full-size proposed car bays**. It follows the long perimeter row and two interior strokes, with a lower-perimeter bay where the geometry permits. It does not fill every red stroke: additional perimeter boxes would block access frontages or the lower aisle. This is a rearrangement of the previous 32-bay candidate, not an increase in certified physical capacity.

| Row | Existing codes | Clear bay width × length |
| --- | --- | --- |
| North perimeter, 15 bays | C-01–C-15 | 2.50 × 5.00 m |
| Interior row A, 13 bays | C-16–C-28 | 2.50 × 5.00 m |
| Shorter interior row B, 2 parallel bays | C-29, C-30 | 2.15 × 6.00 m |
| Lower perimeter, 1 bay | C-31 | 2.50 × 5.00 m |
| Proposed accessible position, 1 bay | C-42 | 4.00 × 5.00 m, plus 1.20 m front walkway |
| Car inventory without a measured position | 23 codes | No invented dimensions or positions |

The two short-row bays use the parallel reference dimensions, rather than miniature perpendicular symbols. Perpendicular frontages have 6.00 m clear depth; parallel frontages have a proposed 3.60 m depth. The accessible frontage is also wholly inside the model parcel. The western passage connects the shared approach to the lower aisle. A first arrangement of 36 rectangles failed connection/parcel-clearance checks and was rejected.

All **55 car + 84 motorcycle = 139 inventory records** remain. Operational capacity, statuses, active parking transactions, gate state and entry policies are unchanged. The optional Inventory diagram shows every code schematically; it does not establish physical fit for 55 independent car bays.

## Measurements and interpretation

Regular car: 2.50 × 5.00 m; parallel car: 2.15 × 6.00 m. These use Philippine NBCP bay-dimension references. C-42 uses the 4.00 × 5.00 m accessible reference; its location and retaining one code do not establish required accessible-space count or accessible-route compliance.

Motorcycles retain 84 compact 1.00 × 2.00 m bays, three rows of 28, with 1.20 m walk/push aisles and a 2.56 m end aisle. This is a compact UK council design reference, not a Philippine legal minimum or suitable for every motorcycle.

The largest owner-measured car body is 2.0447 × 4.7752 m; mirrors were excluded. Motorcycles were measured at 0.5969 × 1.905 m. The body sizes do not replace full bay dimensions.

The car parcel is reconstructed from eight supplied lengths and estimated bearings. Lengths alone do not determine the actual boundary or usable area. The arrangement is a geometric proposal, not a surveyed plan, capacity maximum, professional approval or swept-path certification. Actual mirrors, wheelbase, steering, turning space, gates, end manoeuvres, obstructions, slopes and accessible routes must still be verified on site. A 3.06 m shared road is shown for alternating traffic, not two simultaneous car lanes.

## Software validation

Tests check bay and frontage boundaries, no bay-to-bay/road/aisle/connector overlaps, unique slot codes and preservation of operating data. A reproducible 0.25 m connection grid with 1.60 m edge clearance checks every car frontage connects to the reserved approach; this does not simulate vehicle steering. Plan, 3D and SVG use the same metric data. Measurements are available on each proposed slot, the measurement table, and the map overlay. Slot availability colours retain their existing meaning; the sketch colours appear only in the reference legend.

## Defense wording

“PASS retains the campus-reported 55-car inventory. Our current scaled arrangement follows the proposed row pattern and contains 32 full-size candidate bays with geometric access clearances. The remaining 23 positions require actual parking-position and circulation validation. This drawing does not establish a physical maximum or prove that the reported 55 includes independent standard bays.”

## References

- DPWH Department Order 56 (2016), Annex A, perpendicular and parallel bay dimensions: https://www.dpwh.gov.ph/dpwh/sites/default/files/issuances/DO_056_s2016.pdf
- NCDA revised 2024 BP 344 IRR, accessible parking: https://ncda.gov.ph/revised-2024-rules-and-regulations-implementing-batas-pambansa-344/
- North Tyneside Council, Transport and Highways SPD 2022, Appendix E, compact motorcycle reference: https://legacy.northtyneside.gov.uk/sites/default/files/web-page-related-files/Transport%20and%20Highways%20SPD%202022.pdf

## Import

Use matching PASS-parking-lineup-backend.bundle and PASS-parking-lineup-frontend.bundle, branch feature/parking-marked-lineup-20261018. The cumulative bundles include prior parking fixes. No migration or operational reseeding is required. See the frontend docs/parking-capacity-import.md for guarded PowerShell commands.

Verification for this build: Laravel suite 125 tests passed (41,410 assertions); Vite production build passed. Browser verification passed 184 checks across admin/security/student/guest at 320px and 1440px, plus a 390px SVG fallback, with no page errors. Checks cover slot selection, physical dimensions, reference legend, Plan/3D, inventory switching, overflow and read-only role separation.
