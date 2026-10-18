import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Eye, EyeOff, Loader2, RefreshCw, ShieldCheck } from 'lucide-react';
import FileUpload from './FileUpload';
import EmailCodeVerification from './EmailCodeVerification';

export const REGISTRATION_STEPS = ['User Details', 'ID Verification', 'Account Info', 'Review'] as const;
type Category = 'college' | 'employee' | 'shs';
const CATEGORIES: { value: Category; label: string; hint: string }[] = [
  { value: 'college', label: 'College Student', hint: '9-digit student number' },
  { value: 'employee', label: 'Employee', hint: '7-digit employee number' },
  { value: 'shs', label: 'SHS Student', hint: 'ID reviewed by PASS staff' },
];
type FormState = { category: Category; department: string; contact: string; first_name: string; last_name: string; middle_initial: string; suffix: string; user_code: string; email: string; password: string; password_confirmation: string; agree: boolean; request_manual_review: boolean };
type IdCheck = { status: 'matched' | 'manual_review' | 'unavailable' | 'needs_correction'; receipt: string; fields: Partial<FormState>; field_confidence: Record<string, number>; checks: Record<string, { result: string; detail: string }>; reasons: string[]; current_year: number; note: string };
type Department = { department_id: number; department_code: string; department_name: string };
const INITIAL: FormState = { category: 'college', department: '', contact: '', first_name: '', last_name: '', middle_initial: '', suffix: '', user_code: '', email: '', password: '', password_confirmation: '', agree: false, request_manual_review: false };
const ID_LABELS: Record<string, string> = { matched: 'Details matched', manual_review: 'Staff review needed', unavailable: 'Automatic reader unavailable', needs_correction: 'Needs correction' };
const CHECK_LABELS: Record<string, string> = { id_format: 'ID format', image_quality: 'Image quality', school: 'DYCI school text', user_code: 'ID number', first_name: 'First name', last_name: 'Surname', middle_initial: 'Middle initial', suffix: 'Suffix' };
function IdCheckDetails({ check }: { check: IdCheck }) {
  const needsReview = Object.entries(check.checks).filter(([, c]) => c.result !== 'pass');
  const confidence = (key: string) => {
    const value = check.field_confidence[key === 'middle_initial' ? 'first_name' : key];
    return typeof value === 'number' && Number.isFinite(value) ? ` · OCR confidence ${value.toFixed(1)}%` : '';
  };
  return <div className="mt-3 space-y-3 text-xs leading-relaxed">
    {needsReview.length > 0 && <div className="rounded-lg border border-amber-200 bg-white/70 p-3 text-slate-700">
      <p className="font-semibold text-amber-900">Checks that need attention</p>
      <ul className="mt-2 space-y-2">{needsReview.map(([key, value]) => <li key={key}><span className="font-semibold">{CHECK_LABELS[key] || key}{confidence(key)}</span><span className="block">{value.detail}</span></li>)}</ul>
      <p className="mt-2 text-slate-500">Correct text can still need review when OCR confidence, image quality or school text cannot be confirmed. This is not an account rejection.</p>
    </div>}
    <details className="rounded-lg border border-current/15 p-3">
      <summary className="cursor-pointer font-semibold">View all ID checks</summary>
      <ul className="mt-2 space-y-2">{Object.entries(check.checks).map(([key, value]) => <li key={key}><span className="font-semibold">{value.result === 'pass' ? 'Passed' : value.result === 'fail' ? 'Correction needed' : 'Needs review'} · {CHECK_LABELS[key] || key}{confidence(key)}</span><span className="block">{value.detail}</span></li>)}</ul>
    </details>
  </div>;
}
const digits = (v: string) => v.replace(/[\s-]/g, '');
function idError(category: Category, value: string, year: number) {
  if (category === 'shs') return /^[A-Za-z0-9][A-Za-z0-9 -]{0,49}$/.test(value.trim()) ? '' : 'Enter the ID number printed on your SHS ID.';
  const n = digits(value), size = category === 'employee' ? 7 : 9;
  if (!new RegExp(`^\\d{${size}}$`).test(n)) return `Enter exactly ${size} digits. Keep the leading zero; a hyphen is allowed.`;
  const start = category === 'employee' ? 2000 + Number(n.slice(1, 3)) : Number(n.slice(0, 4));
  return start < 1000 || start > year ? `The year in this ID must not be later than ${year}.` : '';
}

export default function RegistrationForm({ variant = 'web', onBackToLogin, onExit }: { variant?: 'web' | 'mobile'; onBackToLogin: () => void; onExit?: () => void }) {
  const [form, setForm] = useState<FormState>(INITIAL);
  const [step, setStep] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [check, setCheck] = useState<IdCheck | null>(null);
  const [checkEdited, setCheckEdited] = useState(false);
  const [reading, setReading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loadError, setLoadError] = useState('');
  const [year, setYear] = useState(Number(new Intl.DateTimeFormat('en', { timeZone: 'Asia/Manila', year: 'numeric' }).format(new Date())));
  const [ready, setReady] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const sequence = useRef(0);
  const request = useRef<AbortController | null>(null);
  const formRef = useRef(form); formRef.current = form;
  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      fetch('/api/departments', { headers: { Accept: 'application/json' }, signal: controller.signal }).then(async r => { if (!r.ok) throw new Error('Departments could not be loaded.'); return r.json(); }),
      fetch('/api/registration/options', { headers: { Accept: 'application/json' }, signal: controller.signal }).then(async r => { if (!r.ok) throw new Error('Registration settings could not be loaded.'); return r.json(); }),
    ]).then(([d, options]) => { setDepartments(d.data ?? d); setYear(options.current_year); setReady(true); }).catch(e => { if (e.name !== 'AbortError') setLoadError(e.message); });
    return () => controller.abort();
  }, []);
  useEffect(() => () => { sequence.current++; request.current?.abort(); }, []);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm(f => ({ ...f, [key]: value })); setErrors(e => ({ ...e, [key]: '' })); setMessage('');
    if (['first_name', 'last_name', 'middle_initial', 'suffix', 'user_code'].includes(key)) setCheckEdited(true);
  };
  const changeCategory = (category: Category) => {
    if (form.category === category) return;
    sequence.current++; request.current?.abort(); setReading(false); setCheck(null); setFile(null); setCheckEdited(false);
    setForm(f => ({ ...f, category, department: category === 'shs' ? 'Senior High School' : '', user_code: '', first_name: '', last_name: '', middle_initial: '', suffix: '', request_manual_review: false })); setErrors({}); setMessage('');
  };
  const changeFile = (value: File | null) => {
    sequence.current++; request.current?.abort(); setReading(false); setForm(f => ({ ...f, request_manual_review: false })); setFile(value); setCheck(null); setCheckEdited(false); setMessage(''); setErrors(e => ({ ...e, school_id_file: '' }));
  };

  const readId = async (apply: boolean): Promise<IdCheck | null> => {
    if (!file) return null;
    const seq = ++sequence.current; request.current?.abort(); const controller = new AbortController(); request.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 100000);
    setReading(true); setMessage('');
    const current = formRef.current, body = new FormData();
    body.append('registration_category', current.category); body.append('school_id_file', file);
    if (!apply && check?.receipt) body.append('id_check_receipt', check.receipt);
    if (!apply) body.append('request_manual_review', current.request_manual_review ? '1' : '0');
    if (!apply) for (const key of ['first_name', 'last_name', 'middle_initial', 'suffix', 'user_code'] as const) body.append(key, current[key].trim());
    try {
      const response = await fetch('/api/registration/id-check', { method: 'POST', headers: { Accept: 'application/json' }, body, signal: controller.signal });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.errors?.id_check_receipt?.[0] || result.errors?.school_id_file?.[0] || result.message || 'The document could not be read.');
      if (seq !== sequence.current) return null;
      const data = result.data as IdCheck; setCheck(data); setYear(data.current_year); setCheckEdited(false);
      if (apply) {
        setForm(f => ({ ...f, ...Object.fromEntries(Object.entries(data.fields).filter(([key, value]) => ['first_name', 'last_name', 'middle_initial', 'suffix', 'user_code'].includes(key) && value)) }));
        setMessage('Suggested details were added below. Review every field against your ID; all details remain editable.');
      }
      return data;
    } catch (e) {
      if (seq === sequence.current) setMessage(e instanceof Error && e.name !== 'AbortError' ? e.message : 'The reader took too long. Try again or upload a clearer image.');
      return null;
    } finally { window.clearTimeout(timeout); if (seq === sequence.current) setReading(false); }
  };
  useEffect(() => {
    if (file && form.category !== 'shs') void readId(true);
    // File/category changes invalidate the previous request and receipt.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file, form.category]);

  const validate = (s: number) => {
    const e: Record<string, string> = {};
    if (s === 0) { if (!form.department.trim()) e.department = form.category === 'employee' ? 'Enter your department or office.' : 'Choose your department.'; if (!form.contact.trim()) e.contact = 'Enter your contact number.'; }
    if (s === 1) {
      if (!file) e.school_id_file = 'Upload the front of your institutional ID.';
      if (!form.first_name.trim()) e.first_name = 'Enter your first name.';
      if (!form.last_name.trim()) e.last_name = 'Enter your surname.';
      if (form.suffix && !/^(?:Jr\.?|Sr\.?|I|II|III|IV|V|VI|VII|VIII|IX|X)$/i.test(form.suffix)) e.suffix = 'Select your name suffix.';
      if (form.middle_initial && !/^\p{L}\.?$/u.test(form.middle_initial.trim())) e.middle_initial = 'Use one initial, with an optional period.';
      const problem = idError(form.category, form.user_code, year); if (problem) e.user_code = problem;
      if (form.category !== 'shs' && !check?.receipt) e.id_check_receipt = 'Read the current ID before continuing.';
    }
    if (s === 2) { if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) e.email = 'Enter a valid email.'; if (form.password.length < 8) e.password = 'Use at least 8 characters.'; if (form.password_confirmation !== form.password) e.password_confirmation = 'Passwords do not match.'; }
    return e;
  };
  const next = async () => {
    const e = validate(step); setErrors(e); setMessage(''); if (Object.keys(e).length) return;
    if (step === 1 && form.category !== 'shs') {
      const latest = await readId(false); if (!latest || latest.status === 'needs_correction') return;
    }
    setStep(s => Math.min(3, s + 1));
  };
  const submit = async () => {
    if (busy || reading || !form.agree) return;
    for (const s of [0, 1, 2]) { const e = validate(s); if (Object.keys(e).length) { setErrors(e); setStep(s); return; } }
    setBusy(true); setMessage('');
    try {
      const body = new FormData();
      for (const key of ['first_name', 'last_name', 'middle_initial', 'suffix', 'user_code', 'email', 'password', 'password_confirmation', 'department', 'contact'] as const) body.append(key === 'contact' ? 'contact_number' : key, ['password', 'password_confirmation'].includes(key) ? form[key] : form[key].trim());
      body.append('registration_category', form.category); body.append('agree', '1'); body.append('request_manual_review', form.request_manual_review ? '1' : '0'); body.append('school_id_file', file!);
      if (check?.receipt) body.append('id_check_receipt', check.receipt);
      const response = await fetch('/api/register', { method: 'POST', headers: { Accept: 'application/json' }, body });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        const e: Record<string, string> = {}; for (const [key, values] of Object.entries(result.errors ?? {})) e[key === 'contact_number' ? 'contact' : key] = Array.isArray(values) ? values[0] : String(values);
        setErrors(e);
        if (Object.keys(e).some(k => ['first_name', 'last_name', 'middle_initial', 'suffix', 'user_code', 'school_id_file', 'id_check_receipt'].includes(k))) setStep(1);
        else if (e.email || e.password) setStep(2);
        else if (e.department || e.contact) setStep(0);
        throw new Error(Object.values(e).join(' ') || result.message || 'Registration could not be completed.');
      }
      setEmailSent(result.email_verification_sent === true); setSubmitted(true);
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Cannot reach the server. Try again.'); }
    finally { setBusy(false); }
  };
  if (submitted) return <EmailCodeVerification initialEmail={form.email.trim()} notice={emailSent ? 'Registration saved. Verify your email next. A matching ID activates your account after email verification. Unclear or disputed IDs stay pending staff review.' : 'Registration saved, but the email could not be sent. Use Send / resend code to retry.'} />;
  const inputClass = 'w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]';
  const field = (label: string, key: keyof FormState, placeholder = '', type = 'text') => <div key={key}>
    <label htmlFor={`registration-${key}`} className="mb-1.5 block text-sm font-medium text-slate-700">{label}</label>
    <input id={`registration-${key}`} type={type} value={String(form[key])} placeholder={placeholder} onChange={e => set(key, e.target.value as never)} disabled={busy || reading} className={`${inputClass} ${errors[key] ? 'border-red-400' : ''}`} aria-invalid={!!errors[key]} aria-describedby={errors[key] ? `registration-${key}-error` : undefined} autoComplete={key === 'password' || key === 'password_confirmation' ? 'new-password' : key === 'email' ? 'email' : 'off'} />
    {errors[key] && <p id={`registration-${key}-error`} role="alert" className="mt-1 block text-xs text-red-600">{errors[key]}</p>}
  </div>;
  const categoryLabel = CATEGORIES.find(c => c.value === form.category)!.label;
  const currentError = Object.values(errors).filter(Boolean);
  return <div className={`min-w-0 ${variant === 'mobile' ? 'pb-4' : ''}`}>
    <nav aria-label="Registration progress" className="mb-6">
      <p className="text-sm text-slate-500 mb-3">Step {step + 1} of 4 <span className="text-[#080677] font-semibold">· {REGISTRATION_STEPS[step]}</span></p>
      <ol className="grid grid-cols-4 gap-2">{REGISTRATION_STEPS.map((label, i) => <li key={label} aria-current={step === i ? 'step' : undefined} className="min-w-0"><span className={`block h-1.5 rounded-full ${i <= step ? 'bg-[#2563EB]' : 'bg-slate-100'}`} /><span className={`mt-2 hidden sm:block text-xs leading-tight ${step === i ? 'text-[#080677] font-semibold' : 'text-slate-400'}`}>{label}</span></li>)}</ol>
    </nav>
    {loadError && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{loadError} Refresh this page to retry.</p>}
    <div className="space-y-5">
      <h2 className="text-lg font-bold text-[#080677]">{REGISTRATION_STEPS[step]}</h2>
      {step === 0 && <>
        <fieldset><legend className="mb-2 text-sm font-medium text-slate-700">User Type</legend><div className="grid gap-2">{CATEGORIES.map(c => <button type="button" key={c.value} onClick={() => changeCategory(c.value)} aria-pressed={c.value === form.category} disabled={busy || reading} className={`flex min-h-14 items-center justify-between gap-3 rounded-xl border-2 px-4 py-3 text-left ${c.value === form.category ? 'border-[#2563EB] bg-blue-50' : 'border-slate-200 bg-white'}`}><span className="min-w-0"><span className="block text-sm font-semibold text-[#080677]">{c.label}</span><span className="block text-xs text-slate-500 mt-0.5">{c.hint}</span></span>{c.value === form.category && <Check size={18} className="shrink-0 text-[#2563EB]" />}</button>)}</div></fieldset>
        {form.category === 'college' ? <label className="block text-sm font-medium text-slate-700">College Department<select className={`${inputClass} mt-1.5`} value={form.department} onChange={e => set('department', e.target.value)} disabled={!ready}><option value="">{ready ? 'Select college department' : 'Loading departments…'}</option>{departments.filter(d => !['SHS', 'JHS', 'BED'].includes(d.department_code.toUpperCase())).map(d => <option key={d.department_id}>{d.department_name}</option>)}</select>{errors.department && <span role="alert" className="text-xs text-red-600">{errors.department}</span>}</label> : form.category === 'employee' ? field('Department / Office', 'department', 'e.g. General Services') : <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">Senior High School · Your ID will be reviewed by PASS staff while the SHS format is being confirmed.</p>}
        {field('Contact Number', 'contact', '09XX XXX XXXX', 'tel')}
      </>}
      {step === 1 && <>
        <p className="text-sm text-slate-500">Upload the full front of your {form.category === 'employee' ? 'employee' : 'school'} ID, upright with readable text. Crop to the card edges and keep the ID upright. JPG/PNG is recommended for automatic reading.</p>
        <FileUpload label={`${categoryLabel} ID (front)`} file={file} onChange={changeFile} error={errors.school_id_file} onError={msg => setErrors(e => ({ ...e, school_id_file: msg }))} />
        {form.category !== 'shs' && file && <button type="button" disabled={reading || busy} onClick={() => void readId(true)} className="flex min-h-11 items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-[#2563EB] disabled:opacity-50">{reading ? <Loader2 size={17} className="animate-spin" /> : <RefreshCw size={17} />}{reading ? 'Reading your ID…' : 'Read ID again'}</button>}
        {reading && <p role="status" className="text-sm text-blue-700">Extracting suggested names and ID number. Please wait.</p>}
        {check && !reading && <div role="status" className={`rounded-xl border p-3 text-sm ${check.status === 'matched' && !checkEdited ? 'border-green-200 bg-green-50 text-green-800' : check.status === 'needs_correction' && !checkEdited ? 'border-red-200 bg-red-50 text-red-800' : 'border-amber-200 bg-amber-50 text-amber-900'}`}><p className="font-semibold">{checkEdited ? 'Edited details will be checked again' : ID_LABELS[check.status]}</p>{!checkEdited && check.reasons.filter(r => !Object.values(check.checks).some(c => c.result !== 'pass' && c.detail === r)).map(r => <p key={r} className="mt-1">{r}</p>)}{!checkEdited && <IdCheckDetails check={check} />}{check.status === 'matched' && !checkEdited && <p className="mt-1">Review the suggestions below. Your account activates only after submission and email verification.</p>}</div>}
        {check && (check.status === 'needs_correction' || form.request_manual_review) && <label className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><input type="checkbox" checked={form.request_manual_review} onChange={e => set('request_manual_review', e.target.checked)} className="mt-1 h-4 w-4 shrink-0" /><span>The OCR reading is wrong and my details are correct. Request staff review. My account will remain pending.</span></label>}
        {field('ID Number', 'user_code', form.category === 'college' ? '2026-00123' : form.category === 'employee' ? '022-0001' : 'ID number on your card')}
        <p className="-mt-3 text-xs text-slate-500">{form.category === 'college' ? `9 digits. First four digits identify the start year; no later than ${year}.` : form.category === 'employee' ? `7 digits. The second and third digits identify the year (e.g. 022 → 2022); no later than ${year}. Keep the first zero.` : 'Enter the printed SHS ID number. No college/employee number pattern is applied.'}</p>
        {field('First Name', 'first_name')}
        <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_100px] gap-3">{field('Surname', 'last_name')}{field('M.I. (optional)', 'middle_initial', 'S.')}</div>
        <div><label htmlFor="registration-suffix" className="block text-sm font-medium text-slate-700">Suffix (optional)</label><select id="registration-suffix" value={form.suffix} disabled={reading || busy} onChange={e => set('suffix', e.target.value)} className={`${inputClass} mt-1.5`}><option value="">None</option>{['Jr.', 'Sr.', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'].map(s => <option key={s}>{s}</option>)}</select></div>
        <p className="-mt-3 text-xs text-slate-500">Keep your complete surname (e.g. Dela Cruz). Put Jr., Sr. or a Roman numeral in Suffix, not in the surname or middle initial.</p>
        <p className="text-xs text-slate-500 flex items-start gap-2"><ShieldCheck size={15} className="shrink-0 mt-0.5" />All suggested details are editable. Unclear text or an unavailable reader requires staff review. Changing a field does not override the server check.</p>
        {errors.id_check_receipt && <p role="alert" className="text-sm text-red-600">{errors.id_check_receipt}</p>}
      </>}
      {step === 2 && <>
        {field('Email Address', 'email', 'you@example.com', 'email')}
        {field('Password', 'password', 'At least 8 characters', showPassword ? 'text' : 'password')}
        {field('Confirm Password', 'password_confirmation', 'Repeat password', showPassword ? 'text' : 'password')}
        <button type="button" onClick={() => setShowPassword(v => !v)} className="inline-flex min-h-11 items-center gap-2 text-sm text-[#2563EB]">{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}{showPassword ? 'Hide passwords' : 'Show passwords'}</button>
        <p className="text-sm text-slate-500">After submission, enter the six-digit code sent to this email. A matching ID activates your account after email verification. Unclear or disputed IDs stay pending staff review.</p>
      </>}
      {step === 3 && <>
        <dl className="divide-y divide-slate-100">{[
          ['User Type', categoryLabel], ['Department / Office', form.department], ['Contact', form.contact],
          ['Name', [form.first_name, form.middle_initial, form.last_name, form.suffix].filter(Boolean).join(' ')], ['ID Number', form.user_code], ['ID File', file?.name],
          ['Document Check', form.category === 'shs' ? 'Staff review needed' : check ? ID_LABELS[check.status] : 'Not checked'], ['Email', form.email],
        ].map(([label, value]) => <div key={label} className="grid grid-cols-[minmax(0,.8fr)_minmax(0,1.2fr)] gap-3 py-3 text-sm"><dt className="text-slate-500">{label}</dt><dd className="break-words text-right font-medium text-slate-800 [overflow-wrap:anywhere]">{value || '—'}</dd></div>)}</dl>
        <p className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-sm text-blue-900">Vehicle registration, vehicle photos and driver’s license submission are available after account approval, inside your dashboard.</p>
        <label className="flex items-start gap-3 text-sm text-slate-600"><input type="checkbox" checked={form.agree} onChange={e => set('agree', e.target.checked)} className="mt-1 h-4 w-4 shrink-0" /><span>I agree to the PASS Terms and Conditions and Privacy Notice. I confirm that these details and documents are mine and accurate.</span></label>
        <p className="text-xs text-slate-500">Automatic ID checks compare document text. Current enrollment/employment and ID authenticity require school records or staff confirmation.</p>
      </>}
      {message && <p role="status" className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-sm text-slate-700 [overflow-wrap:anywhere]">{message}</p>}
      {currentError.length > 0 && step === 3 && <p role="alert" className="text-sm text-red-700">{currentError.join(' ')}</p>}
    </div>
    <div className="mt-7 flex flex-wrap justify-between gap-3">
      <button type="button" disabled={busy || reading} onClick={() => { if (step > 0) setStep(s => s - 1); else if (onExit) onExit(); else onBackToLogin(); setErrors({}); setMessage(''); }} className="flex min-h-11 items-center gap-1 rounded-xl border border-slate-200 px-3 py-3 text-sm font-semibold text-slate-600 disabled:opacity-50"><ChevronLeft size={16} />{step === 0 ? 'Sign in' : 'Back'}</button>
      <button type="button" disabled={!ready || busy || reading || (step === 3 && !form.agree)} onClick={() => void (step === 3 ? submit() : next())} className="flex min-h-11 max-w-full items-center justify-center gap-2 rounded-xl bg-[#2563EB] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">{busy || reading ? <Loader2 size={16} className="shrink-0 animate-spin" /> : step === 3 ? <Check size={16} className="shrink-0" /> : null}{busy ? 'Submitting…' : reading ? 'Checking…' : step === 3 ? 'Submit Registration' : 'Continue'}{step !== 3 && !reading && <ChevronRight size={16} className="shrink-0" />}</button>
    </div>
  </div>;
}
