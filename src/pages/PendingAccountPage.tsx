import React from 'react';
import { useAuth } from '../context/AuthContext';

export default function PendingAccountPage() {
  const { user, logout } = useAuth();
  return <main className="min-h-screen bg-slate-50 p-6 flex items-center justify-center">
    <section className="bg-white border rounded-2xl p-8 w-full max-w-lg">
      <h1 className="text-2xl font-bold text-[#080677]">Your PASS application</h1>
      <p className="my-4 bg-amber-50 text-amber-800 rounded-xl p-4">Email verified. Your account is pending administrator approval.</p>
      <dl className="space-y-3 text-sm">
        <div><dt className="text-slate-500">Name</dt><dd>{user?.name}</dd></div>
        <div><dt className="text-slate-500">Email</dt><dd>{user?.email}</dd></div>
        <div><dt className="text-slate-500">ID number</dt><dd>{user?.idNum}</dd></div>
        <div><dt className="text-slate-500">Department</dt><dd>{user?.dept || '—'}</dd></div>
        <div><dt className="text-slate-500">School ID document</dt><dd>{user?.schoolIdSubmitted ? 'Submitted for review' : 'Not on file'}</dd></div>
      </dl>
      <p className="text-sm text-slate-600 my-5">PASS staff will review your school affiliation. Vehicle registration and parking features become available after account approval. Vehicle authorization and RFID assignment are reviewed separately.</p>
      <button onClick={() => window.location.reload()} className="bg-blue-700 text-white rounded-xl px-4 py-3 mr-3">Check approval status</button>
      <button onClick={() => logout()} className="text-blue-700 underline">Sign out</button>
    </section>
  </main>;
}
