type Figures = { area_code?: string; capacity: number; available: number; occupied: number; maintenance: number; sensor_unavailable?: number; unverified_occupied?: number; occupancy_percent?: number };
type SensorSlot = { area_code: string; status: string; recorded_occupied?: boolean; occupant?: unknown; sensor?: { online: boolean; state: string; distance_cm: number | null; last_seen_at: string | null } | null };

export type SensorSnapshot<T> = { value: T; requestStartedAt: number };

/** Keep each response paired with its own request time, including overlapping polls. */
export async function loadSensorSnapshot<T>(request: () => Promise<T>, now: () => number = () => performance.now()): Promise<SensorSnapshot<T>> {
  const requestStartedAt = now();
  return { value: await request(), requestStartedAt };
}

/** Include time spent waiting for the HTTP response when aging cached readings. */
export function ageSensorAvailability<T extends { generated_at: string; slots: SensorSlot[]; areas?: Figures[]; overall?: Figures }>(input: T, elapsedMs: number): T {
  const serverNow = Date.parse(input.generated_at) + Math.max(0, elapsedMs);
  const changes = new Map<string, { available: number; occupied: number; unknown: number }>();
  const slots = input.slots.map(slot => {
    const sensor = slot.sensor;
    if (!sensor) return slot;
    const age = sensor.last_seen_at ? serverNow - Date.parse(sensor.last_seen_at) : Infinity;
    if (sensor.online && Number.isFinite(age) && age >= 0 && age <= 12000) return slot;
    const held = slot.recorded_occupied ?? !!slot.occupant;
    const next = { ...slot, sensor: { ...sensor, online: false, state: 'offline', distance_cm: null } };
    if (held || slot.status === 'maintenance' || slot.status === 'unknown') return next;
    const d = changes.get(slot.area_code) ?? { available: 0, occupied: 0, unknown: 0 };
    if (slot.status === 'available') d.available--;
    if (slot.status === 'occupied') d.occupied--;
    d.unknown++; changes.set(slot.area_code, d);
    return { ...next, status: 'unknown' };
  });
  function adjust(f: Figures, all = false): Figures {
    const single = changes.get(f.area_code ?? '');
    const deltas = all ? [...changes.values()] : single ? [single] : [];
    const d = deltas.reduce((a, b) => ({ available: a.available + b!.available, occupied: a.occupied + b!.occupied, unknown: a.unknown + b!.unknown }), { available: 0, occupied: 0, unknown: 0 });
    const occupied = f.occupied + d.occupied;
    return { ...f, occupied, available: f.available + d.available, sensor_unavailable: (f.sensor_unavailable ?? 0) + d.unknown,
      unverified_occupied: Math.max(0, (f.unverified_occupied ?? 0) + d.occupied), occupancy_percent: f.capacity ? Math.round(occupied / f.capacity * 1000) / 10 : 0 };
  }
  return { ...input, slots, ...(input.areas ? { areas: input.areas.map(a => adjust(a)) } : {}), ...(input.overall ? { overall: adjust(input.overall, true) } : {}) } as T;
}
