export interface BarrierState { busy: boolean; reviewing: boolean; message: string }
export interface GateTicket { readonly generation: number }
export interface GateOutcome { opened: boolean; queued?: boolean; disabled?: boolean; denied?: boolean; message: string }
export type GateDecision =
  | { kind: 'visitor'; direction: 'entry' | 'exit'; status: string; barrier_receipt?: string | null; barrier_command_id?: number | null; barrier_status?: string }
  | { kind: 'emergency'; action: string; gate_action?: string; status?: string;
      release_id?: number; expected_release_id: number; barrier_receipt?: string | null; barrier_command_id?: number | null; barrier_status?: string };
export class StaffBarrier {
  snapshot: () => BarrierState;
  subscribe: (listener: () => void) => () => void;
  begin(): GateTicket;
  approved(ticket: GateTicket, decision: GateDecision): Promise<GateOutcome>;
  failed(ticket: GateTicket, error: unknown): void;
  finish(ticket: GateTicket): void;
  reviewed(): void;
}
export const staffBarrier: StaffBarrier;
