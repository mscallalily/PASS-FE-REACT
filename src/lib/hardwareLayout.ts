export const HARDWARE_PATH = '/app/hardware';

export function hasHardwareAccess(role: string | null | undefined): boolean {
  return role === 'admin' || role === 'parking_staff';
}

export function showSlotSummary(role: string | null | undefined, pathname: string): boolean {
  return role === 'parking_staff' && [
    '/app/dashboard', '/app/rfid/monitor', '/app/qr-verify',
    '/app/parking/occupancy', '/app/vehicle-releases',
  ].includes(pathname);
}

export function showGateNotice(role: string | null | undefined, pathname: string): boolean {
  return hasHardwareAccess(role) && pathname !== HARDWARE_PATH;
}
