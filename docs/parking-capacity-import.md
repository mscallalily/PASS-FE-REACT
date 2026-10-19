# Apply the parking UI cleanup

Save both matching bundles in Downloads. This update removes Inventory diagram, renames Upper junction and makes the admin parking layout read-only. It includes the corrected 45-car proposal and retains all database records. No migration or reseeding is required.

In the **PASS-BE-LARAVEL** PowerShell terminal:

```powershell
$bundlePath = Join-Path $env:USERPROFILE "Downloads\PASS-parking-ui-cleanup-backend.bundle"

if (Test-Path -LiteralPath $bundlePath) {
    git fetch "$bundlePath" feature/parking-readonly-ui-20261018
    if ($LASTEXITCODE -eq 0) {
        git merge --ff-only FETCH_HEAD
        if ($LASTEXITCODE -eq 0) {
            php artisan route:clear
            php artisan parking:refresh-layout
        }
    }
} else {
    Write-Host "Hindi makita ang PASS-parking-ui-cleanup-backend.bundle sa Downloads. Check ang filename."
}
```

In the **PASS-FE-REACT** PowerShell terminal:

```powershell
$bundlePath = Join-Path $env:USERPROFILE "Downloads\PASS-parking-ui-cleanup-frontend.bundle"

if (Test-Path -LiteralPath $bundlePath) {
    git fetch "$bundlePath" feature/parking-readonly-ui-20261018
    if ($LASTEXITCODE -eq 0) {
        git merge --ff-only FETCH_HEAD
        if ($LASTEXITCODE -eq 0) {
            npm run build
        }
    }
} else {
    Write-Host "Hindi makita ang PASS-parking-ui-cleanup-frontend.bundle sa Downloads. Check ang filename."
}
```

Refresh `/app/parking/layout` (guest: `/guest-dashboard/parking`). There is one parking layout with Plan/3D controls and Show measurements. The admin layout has no operational controls. Sign in as Parking Staff to confirm the staff controls remain. No changes are needed to your local Vite proxy settings; if the dev server is stopped, run npm run dev in a separate frontend terminal.

Stop if Git reports a merge conflict or uncommitted files would be overwritten. Keep your local changes; do not force/reset or replace the entire project. The guarded commands do not continue after a failed fetch or merge.

The proposal still requires site confirmation of boundary estimates, vehicle manoeuvres, the 4.50m internal aisle allowance, and accessibility. Removing the diagram does not certify physical capacity or remove the ten unpositioned car records.
