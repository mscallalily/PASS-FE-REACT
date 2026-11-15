import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { Link } from 'react-router-dom';
import { staffBarrier } from '../lib/staffBarrier';

export default function StaffBarrierPanel({ mode = 'full' }: { mode?: 'full' | 'notice' }) {
  const state = useSyncExternalStore(staffBarrier.subscribe, staffBarrier.snapshot, staffBarrier.snapshot);
  const [reviewed, setReviewed] = useState(false);
  useEffect(() => { setReviewed(false); }, [state.reviewing]);
  if (mode === 'notice' && !state.notice && !state.busy && !state.pending && !state.reviewing) return null;
  return <section aria-label="Automatic boom barrier" className="mb-5 min-w-0 rounded-xl border border-blue-200 bg-white p-4 space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold text-[#080677]">Gate Action Status</h2>
      {mode === 'notice' && !state.busy && !state.pending && !state.reviewing && <button type="button" onClick={() => staffBarrier.dismiss()} className="min-h-11 rounded-lg border border-slate-300 px-3 text-sm">Dismiss notice</button>}
    </div>
    <p role="status" className="break-words text-sm text-slate-700">{state.message}</p>
    {state.reviewing && <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm">
      <Link to="/app/rfid/monitor" className="mb-2 inline-flex min-h-11 items-center text-blue-800 underline">Check access records</Link>
      <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={reviewed} disabled={state.busy}
        onChange={e => setReviewed(e.target.checked)} />I checked the PASS records before continuing.</label>
      <button type="button" className="mt-2 min-h-11 rounded-lg border border-amber-500 px-3 underline disabled:opacity-50" disabled={!reviewed || state.busy}
        onClick={() => staffBarrier.reviewed()}>Confirm review</button>
    </div>}
    {mode === 'full' && <p className="text-xs text-slate-500">Gate actions are recorded in PASS. Security staff can record a verified visitor QR entry/exit, an authorized RFID action, or a staff-verified vehicle exit. When automatic passage mode is running, the gate PC closes after fresh blocked-then-clear sensor readings; otherwise closing is supervised at the gate PC. Servo acknowledgements do not measure the physical arm position.</p>}
  </section>;
}
