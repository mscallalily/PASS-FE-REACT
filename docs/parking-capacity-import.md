# Apply the corrected 45-position car proposal

Download both bundles into Downloads. This is a **45-position independent-bay proposal**, with per-slot sizes. All 55 car inventory records and the existing capacity rules remain. The physical 55-car layout still requires actual parking-position evidence; this update does not certify 55 independent bays.

In your PASS-BE-LARAVEL PowerShell terminal:

```powershell
git fetch "$env:USERPROFILE\Downloads\PASS-independent-car-backend.bundle" feature/independent-car-density-20261018
if ($LASTEXITCODE -eq 0) {
    git merge --ff-only FETCH_HEAD
    if ($LASTEXITCODE -eq 0) {
        php artisan route:clear
        php artisan parking:refresh-layout
    }
}
```

In your PASS-FE-REACT PowerShell terminal:

```powershell
git fetch "$env:USERPROFILE\Downloads\PASS-independent-car-frontend.bundle" feature/independent-car-density-20261018
if ($LASTEXITCODE -eq 0) {
    git merge --ff-only FETCH_HEAD
    if ($LASTEXITCODE -eq 0) {
        npm run build
    }
}
```

No migration or operational seeding is required. Refresh `/app/parking/layout` (or the guest Parking Layout page). Choose **Parking layout**, then **Show measurements**. Select a bay to see its proposed width × length; expand **Measurements & design basis** for the individual slot table. **Inventory diagram** retains all 55 car codes and explicitly uses schematic symbols.

A merge error stops the guarded sequence. Preserve any uncommitted changes rather than overwriting layout files or forcing the merge.

The owner-numbered six edges and corrected lower pink 2.60m segment are shown in the evidence panel. The shared motorcycle end is restored. The short NW return (4.66m) and boundary bearings remain estimates; internal car aisles are a tight 4.50m concept allowance. The 45 bays require physical boundary and manoeuvring validation. All regular bays remain 2.50 × 5.00m; C-42 is 4.00 × 5.00m with its front walkway. There are no tandem bays.
