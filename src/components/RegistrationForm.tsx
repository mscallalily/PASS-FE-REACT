import React, { useEffect, useRef, useState } from 'react';
import { Check, Loader2, RefreshCw, ShieldCheck, Smartphone, Camera } from 'lucide-react';
import { ApiError, jsonRequest } from '../lib/http';
import QrCode from './QrCode';

export const REGISTRATION_STEPS = ['Institutional ID', 'Verify email', 'Driver’s license', 'Review & create'] as const;
type Category = 'college' | 'employee' | 'shs';
type Draft = { email: string; registration_category: Category; first_name: string; middle_name: string; last_name: string; suffix: string; birth_date: string; user_code: string; department: string; contact_number: string; year_level: string; section: string };
type IdCheck = { status: 'passed' | 'retake' | 'unavailable'; message: string; fields: Record<string, string>; profile_fields: Record<string, string>; receipt: string | null };
const ID_LABELS: Record<string, string> = { first_name: 'First name', last_name: 'Surname', middle_initial: 'Middle initial', suffix: 'Suffix', user_code: 'Institutional ID number' };
type License = { status: 'passed' | 'blocked' | 'retake' | 'unavailable'; message: string; fields: Record<string, string | null>; reasons: string[] };
type Status = { email_verified: boolean; completed: boolean; expires_at: string; license_processing: boolean; license: License | null };
type Session = { id: string; key: string };
type Department = { department_id: number; department_code: string; department_name: string };
const INITIAL: Draft = { email: '', registration_category: 'college', first_name: '', middle_name: '', last_name: '', suffix: '', birth_date: '', user_code: '', department: '', contact_number: '', year_level: '', section: '' };
const LABELS: Record<string, string> = { full_name: 'Full printed name', license_number: 'License number', birth_date: 'Birth date', expiry_date: 'Expiration date' };

export default function RegistrationForm({ onBackToLogin, onExit }: { variant?: 'web' | 'mobile'; onBackToLogin: () => void; onExit?: () => void }) {
  const [draft, setDraft] = useState<Draft>(INITIAL), [step, setStep] = useState(0);
  const [session, setSession] = useState<Session | null>(null), [status, setStatus] = useState<Status | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]), [code, setCode] = useState('');
  const [password, setPassword] = useState(''), [confirmation, setConfirmation] = useState(''), [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false), [uploading, setUploading] = useState(false), [message, setMessage] = useState(''), [error, setError] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({}), [file, setFile] = useState<File | null>(null), [preview, setPreview] = useState('');
  const [handoff, setHandoff] = useState<{ url: string; expires: string } | null>(null), [done, setDone] = useState(false), [expired, setExpired] = useState(false);
  const generation = useRef(0), alive = useRef(true), busyRef = useRef(false), selectedRef = useRef(false), camera = useRef<HTMLInputElement>(null), library = useRef<HTMLInputElement>(null);
  const autoChecked = useRef<File | null>(null);
  const [idFile, setIdFile] = useState<File | null>(null), [idCheck, setIdCheck] = useState<IdCheck | null>(null), [idPreview, setIdPreview] = useState('');
  const [readingId, setReadingId] = useState(false);
  const idCamera = useRef<HTMLInputElement>(null), idLibrary = useRef<HTMLInputElement>(null), autoIdChecked = useRef<File | null>(null);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { alive.current = true; return () => { alive.current = false; generation.current++; }; }, []);
  useEffect(() => { let current = true; jsonRequest<{ data: Department[] }>('/api/departments').then(r => { if (current) setDepartments(r.data); }).catch(() => { if (current) setError('Departments could not be loaded. Check the server connection, then restart registration.'); }); return () => { current = false; }; }, []);
  useEffect(() => { if (!file) { setPreview(''); return; } const url = URL.createObjectURL(file); setPreview(url); return () => URL.revokeObjectURL(url); }, [file]);
  useEffect(() => { if (!idFile) { setIdPreview(''); return; } const url = URL.createObjectURL(idFile); setIdPreview(url); return () => URL.revokeObjectURL(url); }, [idFile]);
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  useEffect(() => {
    if (!session || done || expired) return;
    let current = true, pending = false;
    const poll = async () => {
      if (pending || busyRef.current || selectedRef.current || document.hidden) return;
      pending = true; const g = generation.current;
      try {
        const r = await jsonRequest<{ data: Status }>(`/api/registration/sessions/${session.id}`, { headers: { 'X-Registration-Key': session.key } });
        if (current && g === generation.current) { setStatus(r.data); if (r.data.license?.status === 'passed') setHandoff(null); }
      } catch (e) { if (current && e instanceof ApiError && [404, 410].includes(e.status)) { setExpired(true); setError(e.message); } }
      finally { pending = false; }
    };
    const timer = window.setInterval(() => { void poll(); }, 3000);
    return () => { current = false; clearInterval(timer); };
  }, [session, done, expired]);
  const fail = (e: unknown) => { if (!alive.current) return; setError(e instanceof Error ? e.message : 'The action could not complete. Try again.'); if (e instanceof ApiError) { setErrors(e.fieldErrors); if ([404, 410].includes(e.status)) setExpired(true); } };
  const act = async (action: () => Promise<void>) => {
    if (busyRef.current) return; busyRef.current = true; generation.current++; setBusy(true); setError(''); setErrors({});
    try { await action(); } catch (e) { fail(e); } finally { busyRef.current = false; if (alive.current) setBusy(false); }
  };
  const call = async <T,>(suffix: string, options: RequestInit = {}, timeout = 30000): Promise<T> => {
    if (!session) throw new Error('Start registration first.');
    return jsonRequest<T>(`/api/registration/sessions/${session.id}${suffix}`, { ...options, headers: { Accept: 'application/json', 'X-Registration-Key': session.key, ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }), ...options.headers } }, timeout);
  };
  const chooseId = (chosen?: File) => {
    if (!chosen || busyRef.current) return;
    if (!['image/jpeg', 'image/png'].includes(chosen.type) || chosen.size > 5 * 1024 * 1024) { setError('Choose a JPG or PNG ID photo of 5 MB or smaller.'); return; }
    setIdFile(chosen); setIdCheck(null); setError(''); setMessage('Reading your institutional ID…');
    setDraft(d => ({ ...INITIAL, email: d.email, registration_category: d.registration_category, department: d.registration_category === 'shs' ? 'Senior High School' : '', contact_number: d.contact_number }));
  };
  const readId = () => act(async () => {
    if (!idFile) throw new Error('Upload your institutional ID first.');
    setReadingId(true); const body = new FormData(); body.append('registration_category', draft.registration_category); body.append('school_id_file', idFile);
    try {
      const r = await jsonRequest<{ data: IdCheck }>('/api/registration/institutional-id', { method: 'POST', headers: { Accept: 'application/json' }, body }, 110000);
      setIdCheck(r.data); setMessage(r.data.message);
      if (r.data.status === 'passed') setDraft(d => ({ ...d, ...r.data.fields, ...r.data.profile_fields }));
    } finally { setReadingId(false); }
  });
  useEffect(() => {
    if (idFile && !busy && autoIdChecked.current !== idFile) { autoIdChecked.current = idFile; void readId(); }
    // Read each selected ID once. A retry remains available after a network error.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idFile, busy]);
  const start = () => act(async () => {
    if (!/^[^@\s]+@dyci\.edu\.ph$/i.test(draft.email.trim())) throw new Error('Use your institutional email ending exactly in @dyci.edu.ph.');
    if (!idFile || idCheck?.status !== 'passed' || !idCheck.receipt) throw new Error('Upload and read a clear institutional ID first.');
    const body = new FormData();
    for (const key of ['email', 'registration_category', 'department', 'contact_number'] as const) body.append(key, draft[key]);
    if (draft.registration_category === 'shs') { body.append('year_level', draft.year_level); body.append('section', draft.section); }
    body.append('school_id_file', idFile); body.append('id_check_receipt', idCheck.receipt);
    const r = await jsonRequest<{ session_id: string; owner_key: string; data: Status; message: string }>('/api/registration/sessions', { method: 'POST', headers: { Accept: 'application/json' }, body });
    if (!alive.current) return;
    setSession({ id: r.session_id, key: r.owner_key }); setStatus(r.data); setStep(1); setMessage(r.message); setIdFile(null);
  });
  const verify = () => act(async () => { const r = await call<{ data: Status; message: string }>('/verify', { method: 'POST', body: JSON.stringify({ code }) }); setStatus(r.data); setMessage(r.message); setCode(''); setStep(2); });
  const choose = (chosen?: File) => {
    if (!chosen || busyRef.current) return;
    if (!['image/jpeg', 'image/png'].includes(chosen.type) || chosen.size > 5 * 1024 * 1024) { setError('Choose a JPG or PNG photo of 5 MB or smaller.'); return; }
    setFile(chosen); selectedRef.current = true; setError(''); setMessage('Photo selected. Check this photo to read and validate it.');
    // A new selection cannot silently reuse a previous passed result.
    setStatus(s => s ? { ...s, license: null } : s);
  };
  const checkPhoto = () => act(async () => {
    if (!file) throw new Error('Take or choose a license photo first.');
    setUploading(true); setHandoff(null); const body = new FormData(); body.append('license_file', file);
    try { const r = await call<{ data: Status }>('/license', { method: 'POST', headers: { Accept: 'application/json' }, body }, 110000); setStatus(r.data); setMessage(r.data.license?.message || 'License check finished.'); setFile(null); selectedRef.current = false; }
    finally { setUploading(false); }
  });
  useEffect(() => {
    if (file && !busy && autoChecked.current !== file) {
      autoChecked.current = file;
      void checkPhoto();
    }
    // Check each newly captured/selected photo once; retries remain an explicit action.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file, busy]);
  const createLink = () => act(async () => {
    const r = await call<{ capture_key: string; capture_path: string; expires_at: string }>('/handoff', { method: 'POST', body: '{}' });
    const url = new URL(r.capture_path, window.location.origin); url.hash = new URLSearchParams({ id: session!.id, key: r.capture_key }).toString();
    setStatus(s => s ? { ...s, license: null, license_processing: false } : s);
    setHandoff({ url: url.toString(), expires: r.expires_at }); setMessage('Scan this QR using the camera on your other device. Keep this registration open.');
  });
  const cancelLink = () => act(async () => { await call('/handoff', { method: 'DELETE' }); setHandoff(null); setMessage('The photo link was cancelled.'); });
  const restart = () => act(async () => {
    if (session && !expired) await call('', { method: 'DELETE' });
    setSession(null); setStatus(null); setIdFile(null); setIdCheck(null); setDraft(d => ({ ...INITIAL, email: d.email })); setStep(0); setHandoff(null); setExpired(false); setFile(null); selectedRef.current = false; setPassword(''); setConfirmation(''); setAgree(false); setCode(''); setMessage('Upload your institutional ID again, then verify your email and license.');
  });
  const submit = () => act(async () => {
    if (!session || status?.license?.status !== 'passed' || file) throw new Error('Check the current license photo first.');
    await jsonRequest('/api/register', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Registration-Key': session.key }, body: JSON.stringify({ session_id: session.id, password, password_confirmation: confirmation, agree }) });
    setPassword(''); setConfirmation(''); setHandoff(null); setFile(null); setDone(true);
  });
  const input = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:opacity-60';
  const field = (key: keyof Draft, label: string, type = 'text', placeholder = '') => <label className="block text-sm font-medium text-slate-700" key={key}>{label}<input className={`${input} mt-1`} value={draft[key]} onChange={e => setDraft(d => ({ ...d, [key]: e.target.value }))} type={type} placeholder={placeholder} required={!['middle_name', 'suffix'].includes(key)} maxLength={key === 'user_code' ? 50 : 150} autoComplete={key === 'email' ? 'email' : key === 'first_name' ? 'given-name' : key === 'last_name' ? 'family-name' : 'off'} disabled={busy} aria-invalid={!!errors[key]} />{errors[key] && <span className="block text-xs text-red-600 mt-1">{errors[key]}</span>}</label>;
  const license = status?.license, working = busy || !!status?.license_processing, canContinue = license?.status === 'passed' && !file && !working && !expired;
  if (done || status?.completed) return <div className="space-y-4 text-center"><ShieldCheck className="mx-auto text-emerald-600" size={44} /><h2 className="text-xl font-semibold text-slate-900">Your PASS account is ready</h2><p className="text-sm text-slate-600">Your institutional ID, email and license checks passed. You can now sign in and register your vehicle.</p><button type="button" className="w-full rounded-xl bg-blue-700 p-3 text-white" onClick={onBackToLogin}>Go to sign in</button></div>;
  return <div className="space-y-5">
    <ol className="grid grid-cols-4 gap-2" aria-label="Registration progress">{REGISTRATION_STEPS.map((label, i) => <li key={label} aria-current={step === i ? 'step' : undefined} className={`text-xs ${i === step ? 'text-blue-800 font-semibold' : 'text-slate-500'}`}><span className={`mb-2 flex h-7 w-7 items-center justify-center rounded-full ${i <= step ? 'bg-blue-700 text-white' : 'bg-slate-100'}`}>{i < step ? <Check size={14} /> : i + 1}</span>{label}</li>)}</ol>
    {error && <div role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{error}{Object.values(errors).length > 0 && <ul className="mt-2 list-disc pl-5">{Object.entries(errors).filter(([k]) => !['email'].includes(k)).map(([k, value]) => <li key={k}>{value}</li>)}</ul>}</div>}
    {message && <p role="status" className="rounded-xl bg-blue-50 p-3 text-sm text-blue-900">{message}</p>}
    {expired ? <button type="button" className="w-full rounded-xl bg-blue-700 p-3 text-white" onClick={restart} disabled={busy}>Start a new registration</button> : <>
    {step === 0 && <form onSubmit={e => { e.preventDefault(); void start(); }} className="space-y-4">
      <p className="text-sm text-slate-600">Upload your institutional ID to fill your name and ID number automatically. Your birth date and full middle name will be read from your driver’s license in the next step.</p>
      {field('email', 'Institutional email', 'email', 'yourname@dyci.edu.ph')}
      <label className="block text-sm font-medium text-slate-700">Profile type<select className={`${input} mt-1`} value={draft.registration_category} disabled={busy} onChange={e => { setIdFile(null); setIdCheck(null); setDraft(d => ({ ...INITIAL, email: d.email, contact_number: d.contact_number, registration_category: e.target.value as Category, department: e.target.value === 'shs' ? 'Senior High School' : '' })); setError(''); setMessage('Upload the ID for this profile type.'); }}><option value="college">College student</option><option value="employee">Employee</option><option value="shs">SHS student</option></select></label>
      <p className="text-xs text-slate-500">Choose the type of ID you will upload. Your DYCI inbox is verified separately.</p>
      <input aria-label="Institutional ID camera" ref={idCamera} type="file" accept="image/jpeg,image/png" capture="environment" hidden onChange={e => { chooseId(e.target.files?.[0]); e.target.value = ''; }} /><input aria-label="Institutional ID upload" ref={idLibrary} type="file" accept="image/jpeg,image/png" hidden onChange={e => { chooseId(e.target.files?.[0]); e.target.value = ''; }} />
      <div className="grid grid-cols-2 gap-3"><button type="button" disabled={busy} className="rounded-xl border border-blue-200 p-3 text-sm text-blue-800 disabled:opacity-50" onClick={() => idCamera.current?.click()}>Take ID photo</button><button type="button" disabled={busy} className="rounded-xl border border-blue-200 p-3 text-sm text-blue-800 disabled:opacity-50" onClick={() => idLibrary.current?.click()}>Upload institutional ID</button></div>
      <p className="text-xs text-slate-500">Use a clear JPG/PNG front of your DYCI ID, up to 5 MB. Frame the entire card upright, close to its edges, without glare.</p>
      {idPreview && <img src={idPreview} className="max-h-64 w-full rounded-xl object-contain bg-slate-50" alt="Selected institutional ID" />}
      {readingId && <p role="status" className="text-sm text-blue-800">Reading the printed ID details… Keep this page open.</p>}
      {idFile && !busy && <button type="button" onClick={readId} className="text-sm text-blue-700">Read ID again</button>}
      {idCheck && <div role="status" className={`rounded-xl p-4 ${idCheck.status === 'passed' ? 'bg-emerald-50' : 'bg-amber-50'}`}><strong>{idCheck.status === 'passed' ? 'ID details filled automatically' : idCheck.status === 'unavailable' ? 'ID reader unavailable' : 'Retake your ID photo'}</strong><p className="mt-1 text-sm">{idCheck.message}</p>{idCheck.status === 'passed' && <dl className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">{Object.entries(ID_LABELS).map(([key, label]) => <div key={key}><dt className="text-xs text-slate-500">{label}</dt><dd className="font-semibold break-words">{idCheck.fields[key] || 'Not printed'}</dd></div>)}</dl>}</div>}
      {idCheck?.status === 'passed' && <div className="space-y-4 border-t pt-4">
        <p className="text-sm text-slate-600">Complete only the details not read from your ID. Printed fields stay read-only.</p>
        {idCheck.profile_fields.department ? <p className="rounded-xl bg-slate-50 p-3 text-sm">Department / office · <strong>{draft.department}</strong> <span className="text-xs">(from ID)</span></p> : draft.registration_category === 'college' ? <label className="block text-sm font-medium text-slate-700">College department<select className={`${input} mt-1`} required disabled={busy} value={draft.department} onChange={e => setDraft(d => ({ ...d, department: e.target.value }))}><option value="">Choose department</option>{departments.filter(d => !['SHS', 'JHS', 'BED'].includes(d.department_code.toUpperCase()) && !['SECURITY OFFICE', 'HR DEPARTMENT', 'IT DEPARTMENT', 'REGISTRAR OFFICE'].includes(d.department_name.toUpperCase())).map(d => <option key={d.department_id} value={d.department_name}>{d.department_name}</option>)}</select></label> : draft.registration_category === 'employee' ? field('department', 'Department or office') : <p className="text-sm text-slate-600">Senior High School</p>}
        {draft.registration_category === 'shs' && <div className="grid grid-cols-2 gap-3">{idCheck.profile_fields.year_level ? <p>Grade <strong>{draft.year_level}</strong> (from ID)</p> : <label className="text-sm font-medium text-slate-700">Grade<select className={`${input} mt-1`} value={draft.year_level} onChange={e => setDraft(d => ({ ...d, year_level: e.target.value }))} required disabled={busy}><option value="">Choose grade</option><option value="11">Grade 11</option><option value="12">Grade 12</option></select></label>}{idCheck.profile_fields.section ? <p>Section <strong>{draft.section}</strong> (from ID)</p> : field('section', 'Section')}</div>}
        {field('contact_number', 'Your contact number', 'tel')}
        <p className="text-xs text-slate-500">Use your own contact number. Emergency contacts printed on an ID are not used as your number.</p>
      </div>}
      <button disabled={busy || idCheck?.status !== 'passed'} className="w-full rounded-xl bg-blue-700 px-4 py-3 font-semibold text-white disabled:opacity-50">{readingId ? 'Reading ID…' : busy ? 'Starting…' : 'Send verification code'}</button>
    </form>}
    {step === 1 && <form onSubmit={e => { e.preventDefault(); void verify(); }} className="space-y-4"><h2 className="font-semibold text-slate-900">Verify your institutional email</h2><p className="text-sm text-slate-600">Enter the 6-digit code sent to <strong className="break-all">{draft.email}</strong>. It expires after 10 minutes.</p><label className="block text-sm">Verification code<input className={`${input} mt-1 tracking-widest`} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" pattern="[0-9]{6}" autoComplete="one-time-code" required disabled={busy} /></label><button className="w-full bg-blue-700 rounded-xl p-3 text-white disabled:opacity-50" disabled={busy || code.length !== 6}>Verify email</button><button type="button" className="text-sm text-blue-700" disabled={busy} onClick={() => act(async () => { const r = await call<{ message: string }>('/code', { method: 'POST', body: '{}' }); setMessage(r.message); })}>Send / resend code</button></form>}
    {step === 2 && <div className="space-y-4"><h2 className="font-semibold text-slate-900">Driver’s license front</h2><p className="text-sm text-slate-600">Keep all four corners visible and hold the camera parallel to the card. Use good light without glare. Details are filled by the reader and cannot be edited.</p>
      <input ref={camera} type="file" accept="image/jpeg,image/png" capture="environment" hidden onChange={e => { choose(e.target.files?.[0]); e.target.value = ''; }} /><input ref={library} type="file" accept="image/jpeg,image/png" hidden onChange={e => { choose(e.target.files?.[0]); e.target.value = ''; }} />
      <div className="grid grid-cols-2 gap-3"><button type="button" disabled={working} className="rounded-xl border border-blue-200 p-3 text-sm text-blue-800 disabled:opacity-50" onClick={() => camera.current?.click()}><Camera size={18} className="mx-auto mb-1" />Take photo</button><button type="button" disabled={working} className="rounded-xl border border-blue-200 p-3 text-sm text-blue-800 disabled:opacity-50" onClick={() => library.current?.click()}>Choose photo</button></div>
      {preview && <img src={preview} className="max-h-60 w-full rounded-xl object-contain bg-slate-50" alt="Selected license photo" />}
      {file && <button type="button" disabled={working} onClick={checkPhoto} className="w-full rounded-xl bg-blue-700 p-3 text-white disabled:opacity-50">Check this photo</button>}
      {working && <p role="status" className="flex gap-2 text-sm text-blue-800"><Loader2 size={18} className="animate-spin" />{uploading ? 'Reading your photo… This can take up to 90 seconds.' : 'Please wait for the current check…'}</p>}
      <button type="button" disabled={working || !!file} onClick={createLink} className="flex items-center gap-2 text-sm text-blue-700 disabled:opacity-50"><Smartphone size={18} />Continue on another device</button>
      {handoff && <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 space-y-3"><p className="text-sm">Scan with your phone camera. It will only upload the photo to this registration.</p><QrCode value={handoff.url} size={180} label="Temporary PASS license capture link" /><p className="text-xs text-slate-600">{Date.parse(handoff.expires) > now ? `Expires in ${Math.ceil((Date.parse(handoff.expires) - now) / 60000)} minute(s).` : 'This link has expired. Generate a new link.'}</p>{['localhost', '127.0.0.1', '::1', '[::1]'].includes(window.location.hostname) && <p role="alert" className="text-sm text-rose-800">This page uses a localhost address. For a phone link, open PASS using your laptop’s Wi-Fi IP address instead, then create a new link.</p>}<button type="button" className="text-sm text-blue-700" onClick={() => { if (!navigator.clipboard) { setError('Select and copy the temporary link below, or scan the QR with your phone.'); return; } void navigator.clipboard.writeText(handoff.url).then(() => setMessage('Temporary link copied. Share it only with your own device.')).catch(() => setError('Select and copy the temporary link below, or scan the QR with your phone.')); }}>Copy temporary link</button><input aria-label="Temporary photo link" className={`${input} text-xs`} readOnly value={handoff.url} autoComplete="off" spellCheck={false} onFocus={e => e.currentTarget.select()} /><button type="button" disabled={busy} onClick={cancelLink} className="block text-sm text-rose-700">Cancel this phone link</button></div>}
      {license && <div className={`rounded-xl p-4 ${license.status === 'passed' ? 'bg-emerald-50 text-emerald-900' : 'bg-amber-50 text-amber-950'}`} role="status"><strong>{license.status === 'passed' ? 'License checks passed' : license.status === 'blocked' ? 'Registration blocked' : license.status === 'unavailable' ? 'Reader unavailable' : 'Retake your photo'}</strong><p className="mt-1 text-sm">{license.message}</p><ul className="mt-2 list-disc pl-5 text-sm">{license.reasons.map(r => <li key={r}>{r}</li>)}</ul><dl className="mt-3 space-y-2">{Object.entries(LABELS).map(([k, label]) => <div key={k}><dt className="text-xs opacity-70">{label}</dt><dd className="font-semibold break-words">{license.fields[k] || 'Could not be read'}</dd></div>)}</dl></div>}
      <p className="text-xs text-slate-500">JPG or PNG · up to 5 MB. Blurry or uncertain readings need a new photo. Expired licenses and identity mismatches cannot proceed.</p>
      <button type="button" disabled={!canContinue} onClick={() => { setStep(3); setMessage(''); }} className="w-full rounded-xl bg-blue-700 p-3 text-white disabled:opacity-40">Review & create account</button>
    </div>}
    {step === 3 && <form onSubmit={e => { e.preventDefault(); void submit(); }} className="space-y-4"><h2 className="font-semibold text-slate-900">Review your verified details</h2><dl className="rounded-xl bg-slate-50 p-4 space-y-2">{Object.entries(ID_LABELS).map(([key, label]) => <div key={key}><dt className="text-xs text-slate-500">{label} · from institutional ID</dt><dd className="text-sm font-semibold">{idCheck?.fields[key] || 'Not printed'}</dd></div>)}</dl><p className="text-sm text-slate-600">Email: <strong className="break-all">{draft.email}</strong> · verified</p><dl className="rounded-xl bg-slate-50 p-4 space-y-3">{Object.entries(LABELS).map(([k, label]) => <div key={k}><dt className="text-xs text-slate-500">{label}</dt><dd className="text-sm font-semibold break-words">{license?.fields[k] || 'Not confirmed'}</dd></div>)}</dl><p className="text-xs text-slate-500">These details came from the license photo and cannot be edited.</p><label className="block text-sm font-medium">Choose password<input className={`${input} mt-1`} type="password" minLength={8} autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} required disabled={busy} /></label><label className="block text-sm font-medium">Confirm password<input className={`${input} mt-1`} type="password" autoComplete="new-password" value={confirmation} onChange={e => setConfirmation(e.target.value)} required disabled={busy} /></label><label className="flex items-start gap-2 text-sm text-slate-700"><input type="checkbox" checked={agree} required onChange={e => setAgree(e.target.checked)} disabled={busy} className="mt-1" />I confirm these are my details and license, and agree to their use for PASS registration and parking access checks.</label><button disabled={!canContinue || busy || !agree || password.length < 8 || confirmation !== password} className="w-full rounded-xl bg-blue-700 p-3 text-white disabled:opacity-40">{busy ? 'Creating account…' : 'Create my account'}</button><button type="button" className="text-sm text-blue-700" onClick={() => setStep(2)} disabled={busy}>Retake license photo</button></form>}
    {session && <button type="button" onClick={restart} disabled={busy || !!status?.license_processing} className="flex items-center gap-2 text-xs text-slate-600 disabled:opacity-50"><RefreshCw size={14} />Change ID / restart verification</button>}
    </>}
    <div className="flex justify-between border-t pt-4 text-sm"><button type="button" onClick={onBackToLogin} disabled={busy} className="text-blue-700">Back to sign in</button>{onExit && <button type="button" onClick={onExit} disabled={busy} className="text-slate-500">Exit</button>}</div>
  </div>;
}
