# Apply the owner-marked parking lineup

Download both bundles into Downloads. This is a **32-position marked-lineup proposal**, with per-slot sizes. All 55 car inventory records and the existing capacity rules remain. The physical 55-car layout still requires actual parking-position evidence; this update does not certify 55 independent bays.

In your PASS-BE-LARAVEL PowerShell terminal:

```powershell
git fetch "$env:USERPROFILE\Downloads\PASS-parking-lineup-backend.bundle" feature/parking-marked-lineup-20261018
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
git fetch "$env:USERPROFILE\Downloads\PASS-parking-lineup-frontend.bundle" feature/parking-marked-lineup-20261018
if ($LASTEXITCODE -eq 0) {
    git merge --ff-only FETCH_HEAD
    if ($LASTEXITCODE -eq 0) {
        npm run build
    }
}
```

No migration or operational seeding is required. Refresh `/app/parking/layout` (or the guest Parking Layout page). Choose **Parking layout**, then **Show measurements**. Select a bay to see its proposed width × length; expand **Measurements & design basis** for the individual slot table. **Inventory diagram** retains all 55 car codes and explicitly uses schematic symbols.

A merge error stops the guarded sequence. Preserve any uncommitted changes rather than overwriting layout files or forcing the merge.

The row arrangement follows the red/yellow/green sketch. It retains 32 proposed car positions after full-size bay and circulation checks; the sketch does not establish 55 independent bays. The lower row uses two parallel bays. Car and motorcycle availability colours keep their original meaning.
