export type Slot = { slot_id: number; slot_code: string; zone_name: string; area_name: string; parking_area_id: number };
export type Reader = { reader_id: number; reader_code: string; gate_name: string; parking_area_id: number | null };
export type Station = {
  station_id: number; slot_id: number; reader_id: number; slot_code: string;
  zone_name: string; area_name: string; reader_code: string;
  online: boolean; oled_ready: boolean; arrival_detected: boolean;
  display_state: 'available' | 'occupied' | 'unknown' | 'offline';
  distance_cm: number | null; last_seen_at: string | null;
  assignment: { transaction_id: number; plate_number: string } | null;
};
export type StationData = { data: Station[]; slots: Slot[]; readers: Reader[]; can_configure: boolean; servo_available: boolean };

function invalid(): never { throw new Error('The sensor response is incomplete. Refresh its status before continuing.'); }
function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : invalid();
}
function text(value: unknown): string { return typeof value === 'string' && value.trim() ? value : invalid(); }
function id(value: unknown): number {
  const n = typeof value === 'number' ? value : typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : NaN;
  return Number.isSafeInteger(n) && n > 0 ? n : invalid();
}
function flag(value: unknown): boolean {
  if (value === true || value === 1 || value === '1') return true;
  if (value === false || value === 0 || value === '0') return false;
  return invalid();
}
function list<T>(value: unknown, parse: (v: Record<string, unknown>) => T): T[] {
  return Array.isArray(value) ? value.map(v => parse(record(v))) : invalid();
}
function time(value: unknown): string | null {
  return value === null ? null : typeof value === 'string' && Number.isFinite(Date.parse(value)) ? value : invalid();
}
function distance(value: unknown): number | null {
  if (value === null) return null;
  const n = typeof value === 'number' ? value : typeof value === 'string' && /^\d+(?:\.\d+)?$/.test(value) ? Number(value) : NaN;
  return Number.isFinite(n) && n >= 0 ? n : invalid();
}
export function parseStationData(value: unknown): StationData {
  const input = record(value);
  return {
    can_configure: flag(input.can_configure), servo_available: flag(input.servo_available),
    slots: list(input.slots, s => ({ slot_id: id(s.slot_id), slot_code: text(s.slot_code), zone_name: text(s.zone_name), area_name: text(s.area_name), parking_area_id: id(s.parking_area_id) })),
    readers: list(input.readers, r => ({ reader_id: id(r.reader_id), reader_code: text(r.reader_code), gate_name: text(r.gate_name), parking_area_id: r.parking_area_id === null ? null : id(r.parking_area_id) })),
    data: list(input.data, s => {
      const online = flag(s.online), lastSeen = time(s.last_seen_at);
      if (online && lastSeen === null) invalid();
      if (!['available', 'occupied', 'unknown', 'offline'].includes(String(s.display_state))) invalid();
      const a = s.assignment === null ? null : record(s.assignment);
      return {
        station_id: id(s.station_id), slot_id: id(s.slot_id), reader_id: id(s.reader_id),
        slot_code: text(s.slot_code), zone_name: text(s.zone_name), area_name: text(s.area_name), reader_code: text(s.reader_code),
        online, last_seen_at: lastSeen, oled_ready: flag(s.oled_ready), arrival_detected: flag(s.arrival_detected),
        display_state: s.display_state as Station['display_state'], distance_cm: distance(s.distance_cm),
        assignment: a ? { transaction_id: id(a.transaction_id), plate_number: text(a.plate_number) } : null,
      };
    }),
  };
}
export function stationLabel(station: Station, fresh: boolean): string {
  if (!fresh) return 'Status unavailable';
  if (!station.online || station.display_state === 'offline') return 'Sensor offline';
  return station.display_state === 'occupied' ? 'Slot occupied' : station.display_state === 'available' ? 'Slot clear' : 'Reading uncertain';
}
export function stationTone(station: Station, fresh: boolean): string {
  if (!fresh || !station.online || station.display_state === 'offline') return 'text-slate-500';
  return station.display_state === 'occupied' ? 'text-red-700' : station.display_state === 'available' ? 'text-green-700' : 'text-amber-800';
}
