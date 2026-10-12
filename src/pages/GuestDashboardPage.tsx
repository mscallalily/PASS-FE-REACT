import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { DyciLogo } from '../components/Brand';
import { Shield, CarFront, ClipboardList, LogOut, Info, CheckCircle2, Clock3, AlertCircle, Smartphone } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Modal, Button } from '../components/ui';

type RequestStatus = 'not_submitted' | 'pending' | 'approved' | 'rejected';

export default function GuestDashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [logoutModal, setLogoutModal] = useState(false);
  const [status, setStatus] = useState<RequestStatus>('not_submitted');
  const [form, setForm] = useState({ reason: '', contactPerson: '', visitDate: '', arrivalTime: '', vehicleType: 'Motorcycle', plate: '', makeModel: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submittedSummary, setSubmittedSummary] = useState<typeof form | null>(null);
  const set = (key: keyof typeof form, value: string) => setForm(current => ({ ...current, [key]: value }));

  const handleLogout = () => { logout(); navigate('/login'); };
  const submitRequest = (e: React.FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!form.reason.trim()) next.reason = 'Please provide the reason for your visit.';
    if (!form.contactPerson.trim()) next.contactPerson = 'Please identify the person or office you will visit.';
    if (!form.visitDate) next.visitDate = 'Please select your visit date.';
    if (!form.arrivalTime) next.arrivalTime = 'Please select your expected arrival time.';
    if (!form.vehicleType) next.vehicleType = 'Please select a vehicle type.';
    if (!form.plate.trim()) next.plate = 'Vehicle plate number is required.';
    if (!form.makeModel.trim()) next.makeModel = 'Vehicle make/model is required.';
    setErrors(next);
    if (Object.keys(next).length) return;
    setSubmittedSummary({ ...form });
    // UI prototype only: no backend submission or actual approval is performed.
    setStatus('pending');
  };

  const inputClass = (key: keyof typeof form) => `w-full rounded-xl border ${errors[key] ? 'border-red-400' : 'border-slate-200'} px-3.5 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500`;

  return (
    <div className="min-h-screen bg-[#F4F7FB] font-['Inter']">
      <header className="bg-[#080677] text-white shadow-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3"><DyciLogo onDark className="h-9" /><span className="h-7 w-px bg-white/25" /><div><p className="font-bold text-sm">PASS</p><p className="text-[#96D1F2] text-xs">Guest Visitor Portal</p></div></div>
          <div className="flex items-center gap-3"><span className="hidden sm:inline text-xs bg-white/10 rounded-full px-3 py-1.5">Guest account</span><button onClick={() => setLogoutModal(true)} className="inline-flex items-center gap-2 text-sm text-blue-100 hover:text-white"><LogOut size={16}/> Logout</button></div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-7"><p className="text-xs uppercase tracking-wider font-semibold text-blue-700 mb-2">Visitor parking access</p><h1 className="text-2xl sm:text-3xl font-bold text-[#080677]">Welcome, {user?.name || 'Guest'}</h1><p className="text-slate-600 mt-2 max-w-2xl">Create a guest account first, then submit a visitor parking request. A temporary QR pass is available only after the request has been approved.</p></div>

        <div className="rounded-2xl border border-blue-200 bg-white p-4 sm:p-5 flex gap-3 mb-6"><Info size={21} className="text-blue-700 shrink-0 mt-0.5"/><div><h2 className="font-semibold text-[#080677]">Approval is required</h2><p className="text-sm text-slate-600 mt-1">Your account alone does not authorize parking access. Provide your visit purpose and required vehicle details below. Parking access is not confirmed while your request is pending.</p></div></div>

        {status === 'not_submitted' ? (
          <form onSubmit={submitRequest} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-7">
            <div className="flex items-center gap-3 mb-6"><div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center"><ClipboardList size={22}/></div><div><h2 className="text-lg font-bold text-[#080677]">Visitor Parking Request</h2><p className="text-sm text-slate-500">All fields are required unless marked optional.</p></div></div>
            <div className="grid sm:grid-cols-2 gap-5">
              <div className="sm:col-span-2"><label className="block text-sm font-medium text-slate-700 mb-1.5">Reason for visiting campus *</label><textarea value={form.reason} onChange={e => set('reason', e.target.value)} rows={3} placeholder="Explain the purpose of your visit" className={inputClass('reason')}/>{errors.reason && <p className="text-xs text-red-600 mt-1">{errors.reason}</p>}</div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1.5">Person / office to visit *</label><input value={form.contactPerson} onChange={e => set('contactPerson', e.target.value)} placeholder="Name or office" className={inputClass('contactPerson')}/>{errors.contactPerson && <p className="text-xs text-red-600 mt-1">{errors.contactPerson}</p>}</div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1.5">Visit date *</label><input type="date" min={new Date().toISOString().slice(0,10)} value={form.visitDate} onChange={e => set('visitDate', e.target.value)} className={inputClass('visitDate')}/>{errors.visitDate && <p className="text-xs text-red-600 mt-1">{errors.visitDate}</p>}</div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1.5">Expected arrival time *</label><input type="time" value={form.arrivalTime} onChange={e => set('arrivalTime', e.target.value)} className={inputClass('arrivalTime')}/>{errors.arrivalTime && <p className="text-xs text-red-600 mt-1">{errors.arrivalTime}</p>}</div>
            </div>
            <div className="border-t border-slate-100 my-7"/>
            <div className="flex items-center gap-3 mb-5"><div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center"><CarFront size={22}/></div><div><h3 className="text-lg font-bold text-[#080677]">Vehicle Details</h3><p className="text-sm text-slate-500">Required because this request is for campus parking.</p></div></div>
            <div className="grid sm:grid-cols-2 gap-5">
              <div><label className="block text-sm font-medium text-slate-700 mb-1.5">Vehicle type *</label><select value={form.vehicleType} onChange={e => set('vehicleType', e.target.value)} className={inputClass('vehicleType')}><option>Motorcycle</option><option>Car</option><option>Other</option></select>{errors.vehicleType && <p className="text-xs text-red-600 mt-1">{errors.vehicleType}</p>}</div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1.5">Plate number *</label><input value={form.plate} onChange={e => set('plate', e.target.value)} placeholder="e.g. ABC-1234" className={inputClass('plate')}/>{errors.plate && <p className="text-xs text-red-600 mt-1">{errors.plate}</p>}</div>
              <div className="sm:col-span-2"><label className="block text-sm font-medium text-slate-700 mb-1.5">Vehicle make and model *</label><input value={form.makeModel} onChange={e => set('makeModel', e.target.value)} placeholder="e.g. Honda Click 125 / Toyota Vios" className={inputClass('makeModel')}/>{errors.makeModel && <p className="text-xs text-red-600 mt-1">{errors.makeModel}</p>}</div>
            </div>
            <div className="mt-6 rounded-xl bg-slate-50 border border-slate-200 p-4 text-sm text-slate-600 flex gap-2"><AlertCircle size={18} className="text-slate-500 shrink-0 mt-0.5"/><p>Submitting this form sends a request for review in the prototype flow. It does not generate a QR pass or guarantee entry.</p></div>
            <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-3"><button type="reset" onClick={() => { setForm({ reason: '', contactPerson: '', visitDate: '', arrivalTime: '', vehicleType: 'Motorcycle', plate: '', makeModel: '' }); setErrors({}); }} className="px-5 py-3 border border-slate-300 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50">Clear form</button><button type="submit" className="px-5 py-3 rounded-xl bg-[#080677] hover:bg-blue-900 text-white text-sm font-semibold">Submit for Approval</button></div>
          </form>
        ) : (
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
            <div className="flex items-start gap-3 mb-6"><div className={`w-12 h-12 rounded-full flex items-center justify-center ${status === 'approved' ? 'bg-green-100 text-green-700' : status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>{status === 'approved' ? <CheckCircle2 size={24}/> : status === 'rejected' ? <AlertCircle size={24}/> : <Clock3 size={24}/>}</div><div><h2 className="text-xl font-bold text-[#080677]">{status === 'approved' ? 'Visitor request approved' : status === 'rejected' ? 'Visitor request not approved' : 'Request submitted for review'}</h2><p className="text-sm text-slate-600 mt-1">Status: <span className={`font-semibold ${status === 'approved' ? 'text-green-700' : status === 'rejected' ? 'text-red-700' : 'text-amber-700'}`}>{status === 'approved' ? 'Approved' : status === 'rejected' ? 'Rejected' : 'Pending approval'}</span></p></div></div>
            {status === 'approved' ? <div className="mb-5 rounded-2xl border border-green-200 bg-green-50 p-5"><div className="flex items-center gap-2 text-green-800 font-semibold"><CheckCircle2 size={19}/> Temporary Visitor QR Pass Preview</div><p className="text-sm text-green-800/80 mt-1">This is a visual preview of the approved state only. A scannable QR pass requires the real approval and backend integration.</p><div className="mt-4 bg-white rounded-xl p-5 flex flex-col items-center"><div className="grid grid-cols-7 gap-1 p-2">{Array.from({length:49}).map((_,i)=><span key={i} className={`w-3 h-3 sm:w-4 sm:h-4 rounded-[2px] ${[0,1,2,3,4,5,6,7,13,14,15,20,21,22,27,28,29,35,36,37,38,39,40,41,42,43,44,45,46,47,48,10,16,24,30,32].includes(i) ? 'bg-[#080677]' : 'bg-white border border-slate-100'}`}/>)}</div><p className="mt-3 text-xs font-semibold text-[#080677]">DEMO PREVIEW — NOT VALID FOR ENTRY</p></div></div> : <p className="text-sm text-slate-600 mb-5">No QR pass is available yet. The authorized approver must review this visitor parking request first.</p>}
            {submittedSummary && <div className="grid sm:grid-cols-2 gap-3 text-sm"><div className="rounded-xl bg-slate-50 p-4"><p className="text-slate-500">Reason for visit</p><p className="font-medium text-slate-800 mt-1">{submittedSummary.reason}</p></div><div className="rounded-xl bg-slate-50 p-4"><p className="text-slate-500">Person / office</p><p className="font-medium text-slate-800 mt-1">{submittedSummary.contactPerson}</p></div><div className="rounded-xl bg-slate-50 p-4"><p className="text-slate-500">Visit schedule</p><p className="font-medium text-slate-800 mt-1">{submittedSummary.visitDate} · {submittedSummary.arrivalTime}</p></div><div className="rounded-xl bg-slate-50 p-4"><p className="text-slate-500">Vehicle</p><p className="font-medium text-slate-800 mt-1">{submittedSummary.vehicleType} · {submittedSummary.makeModel} · {submittedSummary.plate}</p></div></div>}
            {status !== 'approved' && <div className="mt-6 border border-amber-200 bg-amber-50 rounded-xl p-4 text-sm text-amber-800 flex gap-2"><Info size={18} className="shrink-0 mt-0.5"/><p>This is a front-end prototype. The request is displayed locally and has not been sent to a backend or actual administrator.</p></div>}
            {status === 'pending' && <button onClick={() => setStatus('approved')} className="mt-5 mr-4 text-sm font-semibold text-green-700 hover:underline">Preview approved state (demo only)</button>}
            <button onClick={() => { setStatus('not_submitted'); setSubmittedSummary(null); }} className="mt-5 text-sm font-semibold text-blue-700 hover:underline">{status === 'approved' ? 'Reset demo preview' : 'Edit request (prototype only)'}</button>
          </section>
        )}

        <div className="mt-6 flex items-center gap-3 rounded-2xl bg-white border border-slate-200 p-4"><Smartphone size={21} className="text-blue-700 shrink-0"/><p className="text-sm text-slate-600">Need the mobile layout? <Link to="/mobile" className="font-semibold text-blue-700 hover:underline">Open PASS Mobile</Link></p></div>
      </main>
      <Modal open={logoutModal} onClose={() => setLogoutModal(false)} title="Confirm Logout" size="sm"><p className="text-sm text-slate-600 mb-6">Are you sure you want to log out of PASS?</p><div className="flex gap-3 justify-end"><Button variant="outline" onClick={() => setLogoutModal(false)}>Cancel</Button><Button variant="danger" onClick={handleLogout}>Yes, Logout</Button></div></Modal>
    </div>
  );
}
