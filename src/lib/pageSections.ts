/** Sidebar destinations and the page section shown at each URL. */
export type PageSection = { label: string; to: string; simulatorOnly?: boolean };
export const PAGE_SECTIONS = {
  users: [
    { label: 'All Users', to: '/app/users' },
    { label: 'Pending Approval', to: '/app/users/requests' },
    { label: 'Roles & Permissions', to: '/app/roles' },
  ],
  vehicleStaff: [
    { label: 'Authorization', to: '/app/vehicles/authorization' },
    { label: 'License Verification', to: '/app/vehicles/licenses' },
  ],
  vehicleUser: [
    { label: 'My Vehicles', to: '/app/vehicles' },
    { label: 'Driver & License', to: '/app/drivers' },
    { label: 'Authorization Status', to: '/app/vehicles/status' },
    { label: 'RFID Requests', to: '/app/vehicles/rfid-requests' },
  ],
  rfid: [
    { label: 'Access Records', to: '/app/rfid/monitor' },
    { label: 'RFID Credentials', to: '/app/rfid' },
    { label: 'Gate Simulator', to: '/app/rfid/simulator', simulatorOnly: true },
  ],
  parking: [
    { label: 'Entry & Exit Records', to: '/app/parking/transactions' },
    { label: 'Occupancy Monitor', to: '/app/parking/occupancy' },
    { label: 'Parking Layout', to: '/app/parking/layout' },
    { label: 'Availability', to: '/app/parking/availability' },
  ],
  visitors: [
    { label: 'Visitor Requests', to: '/app/visitors' },
    { label: 'QR Passes', to: '/app/visitors/passes' },
    { label: 'QR Verification', to: '/app/qr-verify' },
  ],
  settings: [
    { label: 'General', to: '/app/settings' },
    { label: 'Parking', to: '/app/settings/parking' },
    { label: 'Access Control', to: '/app/settings/access' },
    { label: 'Notifications', to: '/app/settings/notifications' },
    { label: 'Security', to: '/app/settings/security' },
  ],
} satisfies Record<string, PageSection[]>;

export function selectedSection(sections: PageSection[], pathname: string, fallback = sections[0].label): string {
  return sections.find(section => section.to === pathname)?.label ?? fallback;
}
export function sectionPath(sections: PageSection[], label: string): string {
  return sections.find(section => section.label === label)?.to ?? sections[0].to;
}
