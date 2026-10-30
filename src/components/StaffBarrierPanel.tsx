import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { staffBarrier } from '../lib/staffBarrier';

export default function StaffBarrierPanel() {
  const state = useSyncExternalStore(staffBarrier.subscribe, staffBarrier.snapshot, staffBarrier.snapshot);
  const [reviewed, setReviewed] = useState(false);
  useEffect(() => { setReviewed(false); }, [state.reviewing]);
  return <section aria-label="Automatic boom barrier" className="mb-5 rounded-xl border border-blue-200 bg-white p-4 space-y-3">
    <h2 className="font-semibold text-[#080677]">Gate Action Status</h2>
    <p role="status" className="text-sm text-slate-700">{state.message}</p>
    {state.reviewing && <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm">
      <label className="flex gap-2"><input type="checkbox" checked={reviewed} disabled={state.busy}
        onChange={e => setReviewed(e.target.checked)} />I checked the PASS records before continuing.</label>
      <button type="button" className="mt-2 underline disabled:opacity-50" disabled={!reviewed || state.busy}
        onClick={() => staffBarrier.reviewed()}>Confirm review</button>
    </div>}
    <p className="text-xs text-slate-500">Gate actions are recorded in PASS. The parking station handles OLED guidance and fixed-slot sensing while the servo is disconnected.</p>
  </section>;
}
