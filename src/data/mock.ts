export const MOCK_USERS = [
  { id: 1, name: 'Maria Santos', idNum: '2021-00123', email: 'maria.santos@university.edu', role: 'student', dept: 'College of Engineering', status: 'active', contact: '09171234567', registered: '2024-08-12' },
  { id: 2, name: 'Juan dela Cruz', idNum: '2019-00456', email: 'jdelacruz@university.edu', role: 'faculty', dept: 'College of Science', status: 'active', contact: '09281234567', registered: '2024-07-20' },
  { id: 3, name: 'Ana Reyes', idNum: 'EMP-0021', email: 'a.reyes@university.edu', role: 'employee', dept: 'Registrar Office', status: 'active', contact: '09391234567', registered: '2024-06-15' },
  { id: 4, name: 'Carlos Bautista', idNum: '2022-00789', email: 'c.bautista@university.edu', role: 'student', dept: 'College of Business', status: 'pending', contact: '09451234567', registered: '2024-09-01' },
  { id: 5, name: 'Liza Gonzales', idNum: 'PST-001', email: 'l.gonzales@dyci.edu.ph', role: 'parking_staff', dept: 'Parking Office', status: 'active', contact: '09561234567', registered: '2024-05-10' },
  { id: 6, name: 'Ramon Villanueva', idNum: '2020-00321', email: 'r.villanueva@university.edu', role: 'student', dept: 'College of Arts', status: 'suspended', contact: '09671234567', registered: '2024-03-22' },
];

export const MOCK_VEHICLES = [
  { id: 1, plate: 'ABC-1234', owner: 'Maria Santos', type: 'Sedan', make: 'Toyota', model: 'Vios', year: 2021, color: 'White', status: 'active', rfid: 'RFID-001' },
  { id: 2, plate: 'XYZ-5678', owner: 'Juan dela Cruz', type: 'SUV', make: 'Honda', model: 'CR-V', year: 2020, color: 'Silver', status: 'active', rfid: 'RFID-002' },
  { id: 3, plate: 'DEF-9012', owner: 'Ana Reyes', type: 'Hatchback', make: 'Mitsubishi', model: 'Mirage', year: 2022, color: 'Red', status: 'pending', rfid: null },
  { id: 4, plate: 'GHI-3456', owner: 'Carlos Bautista', type: 'Motorcycle', make: 'Yamaha', model: 'NMAX', year: 2023, color: 'Blue', status: 'pending', rfid: null },
  { id: 5, plate: 'JKL-7890', owner: 'Ramon Villanueva', type: 'Van', make: 'Toyota', model: 'Hi-Ace', year: 2019, color: 'White', status: 'suspended', rfid: 'RFID-005' },
  { id: 6, plate: 'MNO-2345', owner: 'Liza Gonzales', type: 'Sedan', make: 'Ford', model: 'Fiesta', year: 2020, color: 'Black', status: 'active', rfid: 'RFID-006' },
];

export const MOCK_RFID = [
  { id: 'RFID-001', user: 'Maria Santos', vehicle: 'ABC-1234', type: 'Card', status: 'active', assigned: '2024-08-15', expires: '2025-08-15' },
  { id: 'RFID-002', user: 'Juan dela Cruz', vehicle: 'XYZ-5678', type: 'Tag', status: 'active', assigned: '2024-07-22', expires: '2025-07-22' },
  { id: 'RFID-005', user: 'Ramon Villanueva', vehicle: 'JKL-7890', type: 'Card', status: 'suspended', assigned: '2024-03-25', expires: '2025-03-25' },
  { id: 'RFID-006', user: 'Liza Gonzales', vehicle: 'MNO-2345', type: 'Tag', status: 'active', assigned: '2024-05-12', expires: '2025-05-12' },
  { id: 'RFID-010', user: null, vehicle: null, type: 'Card', status: 'unassigned', assigned: null, expires: null },
];

export const MOCK_PARKING_SLOTS = [
  { id: 'A-01', zone: 'Zone A', type: 'Regular', floor: 'Ground', status: 'available', vehicle: null },
  { id: 'A-02', zone: 'Zone A', type: 'Regular', floor: 'Ground', status: 'occupied', vehicle: 'ABC-1234' },
  { id: 'A-03', zone: 'Zone A', type: 'Reserved', floor: 'Ground', status: 'reserved', vehicle: null },
  { id: 'A-04', zone: 'Zone A', type: 'Regular', floor: 'Ground', status: 'available', vehicle: null },
  { id: 'A-05', zone: 'Zone A', type: 'Disabled', floor: 'Ground', status: 'available', vehicle: null },
  { id: 'B-01', zone: 'Zone B', type: 'Regular', floor: 'Ground', status: 'occupied', vehicle: 'XYZ-5678' },
  { id: 'B-02', zone: 'Zone B', type: 'Regular', floor: 'Ground', status: 'occupied', vehicle: 'MNO-2345' },
  { id: 'B-03', zone: 'Zone B', type: 'Regular', floor: 'Ground', status: 'maintenance', vehicle: null },
  { id: 'B-04', zone: 'Zone B', type: 'Motorcycle', floor: 'Ground', status: 'available', vehicle: null },
  { id: 'C-01', zone: 'Zone C', type: 'Regular', floor: 'Level 2', status: 'available', vehicle: null },
  { id: 'C-02', zone: 'Zone C', type: 'Regular', floor: 'Level 2', status: 'available', vehicle: null },
  { id: 'C-03', zone: 'Zone C', type: 'Reserved', floor: 'Level 2', status: 'reserved', vehicle: null },
];

export const MOCK_TRANSACTIONS = [
  { id: 'TXN-20240901-001', plate: 'ABC-1234', driver: 'Maria Santos', entry: '2024-09-01 07:32', exit: '2024-09-01 17:45', duration: '10h 13m', entryGate: 'Gate 1', exitGate: 'Gate 2', method: 'RFID', status: 'completed' },
  { id: 'TXN-20240901-002', plate: 'XYZ-5678', driver: 'Juan dela Cruz', entry: '2024-09-01 08:05', exit: '2024-09-01 12:30', duration: '4h 25m', entryGate: 'Gate 1', exitGate: 'Gate 1', method: 'RFID', status: 'completed' },
  { id: 'TXN-20240901-003', plate: 'MNO-2345', driver: 'Liza Gonzales', entry: '2024-09-01 06:50', exit: null, duration: 'In Lot', entryGate: 'Gate 2', exitGate: null, method: 'RFID', status: 'ongoing' },
  { id: 'TXN-20240901-004', plate: 'VISITOR-01', driver: 'John Smith', entry: '2024-09-01 10:00', exit: '2024-09-01 11:45', duration: '1h 45m', entryGate: 'Gate 1', exitGate: 'Gate 1', method: 'QR', status: 'completed' },
];

export const MOCK_VISITORS = [
  { id: 'VIS-001', name: 'John Smith', contact: '09911234567', purpose: 'Meeting with Dean', host: 'Dr. Santos', date: '2024-09-01', arrival: '10:00', departure: '12:00', vehicle: 'N/A', status: 'checked-out' },
  { id: 'VIS-002', name: 'Alice Brown', contact: '09921234567', purpose: 'Campus Tour', host: 'Admissions Office', date: '2024-09-02', arrival: '09:00', departure: '11:00', vehicle: 'SGD-7890', status: 'approved' },
  { id: 'VIS-003', name: 'Bob Johnson', contact: '09931234567', purpose: 'Delivery', host: 'Supply Office', date: '2024-09-02', arrival: '14:00', departure: '15:00', vehicle: 'PQR-4567', status: 'pending' },
];

export const MOCK_VIOLATIONS = [
  { id: 'VIO-001', plate: 'DEF-9012', driver: 'Unknown', type: 'Unauthorized Parking', location: 'Zone A - Slot A-03', datetime: '2024-09-01 09:15', reportedBy: 'Officer Gonzales', status: 'open', notes: 'Vehicle parked in reserved slot without authorization.' },
  { id: 'VIO-002', plate: 'GHI-3456', driver: 'Carlos Bautista', type: 'Overstaying', location: 'Zone B - Slot B-01', datetime: '2024-09-01 18:30', reportedBy: 'Officer Reyes', status: 'under-review', notes: 'Vehicle exceeded maximum parking duration of 12 hours.' },
  { id: 'VIO-003', plate: 'JKL-7890', driver: 'Ramon Villanueva', type: 'Invalid Authorization', location: 'Gate 1', datetime: '2024-08-30 07:45', reportedBy: 'System', status: 'resolved', notes: 'Suspended RFID card used at entry.' },
];

export const MOCK_AUDIT_LOGS = [
  { id: 'LOG-001', user: 'Admin User', role: 'System Administrator', action: 'User Approved', module: 'User Management', description: 'Approved registration of Carlos Bautista (2022-00789)', ip: '192.168.1.100', timestamp: '2024-09-01 08:02:15', status: 'success' },
  { id: 'LOG-002', user: 'Liza Gonzales', role: 'Parking Staff', action: 'Access Reviewed', module: 'Parking Operations', description: 'Reviewed denied access for vehicle JKL-7890', ip: '192.168.1.102', timestamp: '2024-09-01 09:15:30', status: 'success' },
  { id: 'LOG-003', user: 'Liza Gonzales', role: 'Parking Staff', action: 'Violation Recorded', module: 'Violations', description: 'Recorded unauthorized parking for DEF-9012', ip: '192.168.1.105', timestamp: '2024-09-01 09:16:00', status: 'success' },
  { id: 'LOG-004', user: 'RFID System', role: 'System', action: 'Access Denied', module: 'RFID Control', description: 'Access denied for suspended RFID RFID-005 at Gate 1', ip: '10.0.0.5', timestamp: '2024-08-30 07:45:01', status: 'warning' },
  { id: 'LOG-005', user: 'Admin User', role: 'System Administrator', action: 'Settings Changed', module: 'System Settings', description: 'Updated QR pass validity to 4 hours', ip: '192.168.1.100', timestamp: '2024-08-29 14:30:00', status: 'success' },
];

export const MOCK_RFID_EVENTS = [
  { id: 1, timestamp: '2024-09-01 07:32:14', rfidId: 'RFID-001', plate: 'ABC-1234', driver: 'Maria Santos', gate: 'Gate 1', type: 'entry', result: 'granted' },
  { id: 2, timestamp: '2024-09-01 08:05:22', rfidId: 'RFID-002', plate: 'XYZ-5678', driver: 'Juan dela Cruz', gate: 'Gate 1', type: 'entry', result: 'granted' },
  { id: 3, timestamp: '2024-09-01 09:15:03', rfidId: 'RFID-005', plate: 'JKL-7890', driver: 'Ramon Villanueva', gate: 'Gate 1', type: 'entry', result: 'denied' },
  { id: 4, timestamp: '2024-09-01 12:30:45', rfidId: 'RFID-002', plate: 'XYZ-5678', driver: 'Juan dela Cruz', gate: 'Gate 1', type: 'exit', result: 'granted' },
  { id: 5, timestamp: '2024-09-01 17:45:18', rfidId: 'RFID-001', plate: 'ABC-1234', driver: 'Maria Santos', gate: 'Gate 2', type: 'exit', result: 'granted' },
  { id: 6, timestamp: '2024-09-01 17:55:00', rfidId: 'RFID-006', plate: 'MNO-2345', driver: 'Liza Gonzales', gate: 'Gate 2', type: 'exit', result: 'granted' },
];

export const MOCK_NOTIFS = [
  { id: 1, title: 'Parking Access Approved', body: 'Your vehicle ABC-1234 has been approved for campus parking.', time: '2 hours ago', read: false, type: 'success' },
  { id: 2, title: 'RFID Card Assigned', body: 'RFID Card RFID-001 has been assigned to your account.', time: '1 day ago', read: false, type: 'info' },
  { id: 3, title: 'Parking Area Nearing Capacity', body: 'Zone B is 90% full. Consider parking in Zone C.', time: '3 hours ago', read: true, type: 'warning' },
  { id: 4, title: 'System Maintenance', body: 'PASS will undergo maintenance on Sept 5 from 11 PM to 1 AM.', time: '2 days ago', read: true, type: 'info' },
  { id: 5, title: 'Parking Violation Alert', body: 'A violation has been recorded for vehicle GHI-3456 at Zone B.', time: '4 hours ago', read: false, type: 'danger' },
];

export const OCCUPANCY_DATA = [
  { time: '6am', entries: 8, exits: 0 },
  { time: '7am', entries: 45, exits: 2 },
  { time: '8am', entries: 112, exits: 5 },
  { time: '9am', entries: 68, exits: 15 },
  { time: '10am', entries: 34, exits: 22 },
  { time: '11am', entries: 18, exits: 30 },
  { time: '12pm', entries: 25, exits: 48 },
  { time: '1pm', entries: 55, exits: 35 },
  { time: '2pm', entries: 20, exits: 18 },
  { time: '3pm', entries: 12, exits: 40 },
  { time: '4pm', entries: 8, exits: 75 },
  { time: '5pm', entries: 5, exits: 92 },
];

export const ZONE_CAPACITY = [
  { zone: 'Zone A', capacity: 50, occupied: 32, reserved: 5 },
  { zone: 'Zone B', capacity: 40, occupied: 38, reserved: 0 },
  { zone: 'Zone C', capacity: 60, occupied: 21, reserved: 8 },
  { zone: 'Zone D', capacity: 30, occupied: 12, reserved: 10 },
];
