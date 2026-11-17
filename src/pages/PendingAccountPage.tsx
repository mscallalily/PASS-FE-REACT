import React, { useEffect, useState } from 'react';
import DriverLicenseVerification from '../components/DriverLicenseVerification';
import { LicenseProvider } from '../context/LicenseContext';
import { useAuth } from '../context/AuthContext';

export default function PendingAccountPage() {
  const { user, logout, refreshUser } = useAuth();
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState('');
  const step = user?.approvalStep;
  const needsLicenseAction = step === 'license_correction' || step === 'license_retry';
  const schoolIdStatus = user?.schoolIdCheckStatus;
  const approvedSchoolId = schoolIdStatus === 'matched' || schoolIdStatus === 'staff_verified';
  const message = {
    email: 'Verify your institutional email address to continue.',
    license_processing: 'PASS is reading your driver’s license photo.',
    license_review: 'Your driver’s license is waiting for staff review.',
    license_correction: 'Your driver’s license needs a new submission.',
    license_retry: 'The license check could not finish. You can retry it below.',
    institutional_id: 'Your driver’s license is approved. Staff still need to review your institutional ID.',
    account_review: 'Your account is waiting for administrator approval.',
  }[step ?? 'account_review'];

  useEffect(() => {
    const checkWhenVisible = () => {
      if (document.visibilityState === 'visible') void refreshUser().catch(() => {});
    };
    const timer = window.setInterval(checkWhenVisible, 15000);
    document.addEventListener('visibilitychange', checkWhenVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', checkWhenVisible);
    };
  }, [refreshUser]);

  async function checkApproval() {
    setChecking(true);
    setCheckError('');
    try {
      await refreshUser();
    } catch {
      setCheckError('Could not check your approval status. Try again.');
    } finally {
      setChecking(false);
    }
  }
  return <main className="min-h-screen bg-slate-50 p-6 flex items-center justify-center">
    <section className="bg-white border rounded-2xl p-8 w-full max-w-lg">
      <h1 className="text-2xl font-bold text-[#080677]">Your PASS application</h1>
      <p className="my-4 bg-amber-50 text-amber-800 rounded-xl p-4">{message}</p>
      <dl className="space-y-3 text-sm">
        <div><dt className="text-slate-500">Name</dt><dd className="break-words">{user?.name}</dd></div>
        <div><dt className="text-slate-500">Email</dt><dd className="break-words">{user?.email}</dd></div>
        <div><dt className="text-slate-500">ID number</dt><dd className="break-words">{user?.idNum}</dd></div>
        <div><dt className="text-slate-500">Department</dt><dd className="break-words">{user?.dept || '—'}</dd></div>
        {user?.registrationCategory === 'shs' && <><div><dt className="text-slate-500">Grade / Year Level</dt><dd>{user.yearLevel ? `GRADE ${user.yearLevel}` : '—'}</dd></div><div><dt className="text-slate-500">Section</dt><dd className="break-words">{user.section || '—'}</dd></div></>}
        <div><dt className="text-slate-500">School ID document</dt><dd className="break-words">{approvedSchoolId ? 'Verified' : user?.schoolIdSubmitted ? 'Submitted' : 'Not on file'}</dd></div>
      </dl>
      {needsLicenseAction && <div className="my-5"><LicenseProvider><DriverLicenseVerification signup /></LicenseProvider></div>}
      <p className="text-sm text-slate-600 my-5">Vehicle registration becomes available after your account is activated.</p>
      {checkError && <p role="alert" className="mb-3 text-sm text-red-700">{checkError}</p>}
      <button disabled={checking} onClick={() => { void checkApproval(); }} className="bg-blue-700 text-white rounded-xl px-4 py-3 mr-3 disabled:opacity-60">{checking ? 'Checking approval status…' : 'Check approval status'}</button>
      <button onClick={() => logout()} className="text-blue-700 underline">Sign out</button>
    </section>
  </main>;
}
