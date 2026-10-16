import React, { useEffect, useState } from 'react';
import { apiBlob } from '../lib/apiClient';

/** Private document bytes are fetched with the session token; object URLs never persist. */
export default function VisitorDocuments({ requestId, onReady, stacked = false }: { requestId: number; onReady?: (ready: boolean) => void; stacked?: boolean }) {
  const [images, setImages] = useState<{ kind: string; label: string; url?: string; error?: string }[]>([]);
  useEffect(() => {
    let cancelled = false;
    const urls: string[] = [];
    onReady?.(false);
    setImages([]);
    const docs = [{ kind: 'license', label: 'Actual driver’s license' }, { kind: 'vehicle', label: 'Vehicle and visible plate' }];
    Promise.all(docs.map(async doc => {
      try {
        const blob = await apiBlob(`/api/visitors/requests/${requestId}/documents/${doc.kind}`);
        const url = URL.createObjectURL(blob);
        urls.push(url);
        return { ...doc, url };
      } catch (error) {
        return { ...doc, error: error instanceof Error ? error.message : 'Unable to load document.' };
      }
    })).then(result => {
      if (cancelled) { urls.forEach(url => URL.revokeObjectURL(url)); return; }
      setImages(result);
    });
    return () => { cancelled = true; urls.forEach(url => URL.revokeObjectURL(url)); };
  }, [requestId]);
  const [loaded, setLoaded] = useState<Record<string, boolean>>({});
  useEffect(() => { setLoaded({}); }, [requestId]);
  useEffect(() => { onReady?.(!!loaded.license && !!loaded.vehicle); }, [loaded, onReady]);
  return <div className={`grid min-w-0 gap-4 ${stacked ? "" : "sm:grid-cols-2"}`}>
    {!images.length && <p role="status" className="text-sm text-slate-500 py-6">Loading private photos…</p>}
    {images.map(doc => <figure key={doc.kind} className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <figcaption className="text-sm font-semibold text-slate-700 mb-3">{doc.label}</figcaption>
      {doc.url ? <a href={doc.url} target="_blank" rel="noopener noreferrer" aria-label={`Open ${doc.label} at full size`}><img src={doc.url} alt={doc.label} onLoad={() => setLoaded(previous => ({ ...previous, [doc.kind]: true }))} onError={() => setLoaded(previous => ({ ...previous, [doc.kind]: false }))} className="w-full max-h-80 object-contain rounded-lg" /><span className="block text-xs text-blue-700 mt-2 underline">Open full-size photo</span></a> : <p role="alert" className="text-sm text-red-700">{doc.error}</p>}
    </figure>)}
  </div>;
}
