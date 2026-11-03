import React from 'react';
import { Button } from './ui';
import type { ListMeta } from '../lib/listPage';

export default function ListPager({ meta, busy, onChange, label = 'results' }: { meta: ListMeta | null; busy?: boolean; onChange: (page: number) => void; label?: string }) {
  if (!meta) return null;
  return <nav aria-label={`${label} pages`} className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm text-slate-500">
    <p role="status">{meta.total} {label} · Page {meta.current_page} of {meta.last_page}</p>
    <div className="flex gap-2"><Button className="min-h-11" variant="outline" disabled={busy || meta.current_page <= 1} onClick={() => onChange(meta.current_page - 1)}>Previous</Button><Button className="min-h-11" variant="outline" disabled={busy || meta.current_page >= meta.last_page} onClick={() => onChange(meta.current_page + 1)}>Next</Button></div>
  </nav>;
}
