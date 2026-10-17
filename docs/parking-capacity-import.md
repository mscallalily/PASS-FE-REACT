# Apply the parking capacity review build

Download both bundles into Downloads. This is a **32-position review proposal**, with per-slot sizes. All 55 car inventory records and the existing capacity rules remain. The physical 55-car layout still requires actual parking-position evidence; this update does not certify 55 independent bays.

In your PASS-BE-LARAVEL PowerShell terminal:

```powershell
git fetch "$env:USERPROFILE\Downloads\PASS-parking-capacity-backend.bundle" feature/parking-capacity-review-20261017
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
git fetch "$env:USERPROFILE\Downloads\PASS-parking-capacity-frontend.bundle" feature/parking-capacity-review-20261017
if ($LASTEXITCODE -eq 0) {
    git merge --ff-only FETCH_HEAD
    if ($LASTEXITCODE -eq 0) {
        npm run build
    }
}
```

No migration or operational seeding is required. Refresh `/app/parking/layout` (or the guest Parking Layout page). Choose **Parking layout**, then **Show measurements**. Select a bay to see its proposed width × length; expand **Measurements & design basis** for the individual slot table. **Inventory diagram** retains all 55 car codes and explicitly uses schematic symbols.

A merge error stops the guarded sequence. Preserve any uncommitted changes rather than overwriting layout files or forcing the merge.
