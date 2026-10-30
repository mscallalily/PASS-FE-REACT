import React, { useState } from 'react';
import { changes, valueText } from '../lib/recordPresentation';

export default function RecordChanges({ before, after }: { before: unknown; after: unknown }) {
  const [all, setAll] = useState(false);
  const rows = changes(before, after, all);
  return <section aria-label="Field changes" className="space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-semibold text-slate-800">What changed</h3><label className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={all} onChange={e => setAll(e.target.checked)} className="h-4 w-4 accent-[#080677]" />Include unchanged fields</label></div>
    {!rows.length ? <p className="rounded-xl bg-slate-50 p-5 text-sm text-slate-500">No visible field changes were retained for this activity.</p> : <div className="overflow-x-auto rounded-xl border border-slate-200"><table className="w-full table-fixed text-sm"><thead className="bg-slate-50 text-left text-xs text-slate-500"><tr><th className="w-1/3 p-3 font-medium">Field</th><th className="w-1/3 p-3 font-medium">Previous value</th><th className="w-1/3 p-3 font-medium">Updated value</th></tr></thead><tbody>{rows.map(row => <tr key={row.key} className="border-t border-slate-100 align-top"><th scope="row" className="break-words p-3 text-left font-medium text-slate-700">{row.label}</th><td className="whitespace-pre-wrap break-words p-3 text-slate-500">{valueText(row.key, row.before)}</td><td className={`whitespace-pre-wrap break-words p-3 ${row.changed ? 'bg-blue-50/50 font-medium text-slate-800' : 'text-slate-500'}`}>{valueText(row.key, row.after)}</td></tr>)}</tbody></table></div>}
  </section>;
}
