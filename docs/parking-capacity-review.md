# PASS car capacity review — 17 October 2026

The owner reports an existing capacity of **55 cars**. That value and all 55 inventory records are retained. It is not replaced by the smaller count in a proposed drawing.

The earlier 30-bay perimeter drawing was a candidate arrangement, not a maximum-capacity finding. A new search of opposing rows, perimeter banks, mixed orientations and parallel bays found **32 full-size proposed positions** with clear geometric access frontages. No physical bay has been shrunk to the size of an inventory symbol.

| Item | Proposed arrangement |
| --- | --- |
| North row | C-01–C-12, 12 regular bays |
| Opposing central row | C-13–C-23, 11 regular bays |
| Western/lower regular bays | C-25, C-26, C-27, C-30, C-31 |
| Western parallel bays | C-24, C-28, C-29 |
| Existing accessible code | C-42 |
| Total drawn car positions | 32 |
| Remaining car codes | 23, retained without a measured position |

Regular bays are **2.50 × 5.00 m**. Parallel bays are **2.15 × 6.00 m**. C-42 is **4.00 × 5.00 m** with a **1.20 m front walkway**. Perpendicular frontages retain **6.00 m** clear depth; parallel frontages use a proposed **3.60 m** access depth. The shared gate and approach remain **3.06 m**, for alternating traffic. Slot sizes appear in Plan/3D/SVG when Show measurements is enabled and in each positioned slot’s details and the measurement table. Unpositioned inventory codes have no invented measured size or surveyed position.

The car width supplied by the owner is **2.0447 m body-only**, excluding mirrors; maximum measured length is **4.7752 m**. Those dimensions do not replace parking-bay widths. Mirrors, wheelbase, steering lock, turn envelopes, surface slope and adjacent obstructions remain unmeasured.

## What the checks establish

The software checks retain the supplied parcel-edge lengths, all 139 inventory records, live statuses, access rules, existing transactions and the gate state. Proposed bay rectangles stay inside their parcel and do not overlap each other, access frontages, motorcycle aisles or the shared road. A clear-envelope grid was used to connect every proposed access frontage to the approach; it is not a swept-path or vehicle turning-radius analysis. Direction arrows do not represent two simultaneous lanes on the narrow approach.

The car polygon is reconstructed from supplied lengths and estimated bearings. Its approximate 972 m² model area is not a surveyed usable area. Lengths alone do not define the actual polygon. The layout search does **not** prove that 32 is the physical maximum or that 55 is impossible.

## Defense wording

“PASS retains the campus-reported capacity of 55 cars. Our scaled proposal currently establishes 32 full-size candidate positions with geometric access clearances. The remaining positions require actual parking-position and circulation validation. The software’s inventory count is kept separate from the validated physical layout.”

Before presenting all 55 as independently accessible bays, obtain the current car-position arrangement and establish whether the reported 55 includes tandem, double or blocked parking, staff vehicle movements, smaller vehicles, another parking surface or a different boundary. Accessible-space count and continuous accessible routes also need campus/professional review; retaining C-42 is not a full accessibility compliance claim.

## References

- DPWH Department Order 56, series of 2016, Annex A: 2.50 × 5.00 m perpendicular/diagonal and 2.15 × 6.00 m parallel bay references: https://www.dpwh.gov.ph/dpwh/sites/default/files/issuances/DO_056_s2016.pdf
- NCDA revised 2024 BP 344 IRR, parking dimensions and accessible-space provisions: https://ncda.gov.ph/revised-2024-rules-and-regulations-implementing-batas-pambansa-344/

## Apply the update

Import the matching PASS-parking-capacity-backend.bundle and PASS-parking-capacity-frontend.bundle from branch feature/parking-capacity-review-20261017. Run route:clear and parking:refresh-layout in Laravel; build the frontend with npm run build. No migration or operational seeding is required. Use /app/parking/layout or the guest Parking Layout page. The optional Inventory diagram still contains all 55 car codes and is explicitly schematic.
