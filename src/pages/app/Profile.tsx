import React, { useState } from 'react';
import { PageHeader, Card, Badge, Button, Input, Toast } from '../../components/ui';
import { REGULAR_USER_ROLES, useAuth } from '../../context/AuthContext';
import { User, Car, CreditCard, Activity, Edit, Eye, EyeOff } from 'lucide-react';

export default function Profile() {
  const { user } = useAuth();
  const isRegularUser = REGULAR_USER_ROLES.includes(user?.role ?? null);
  const [editing, setEditing] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [toast, setToast] = useState('');

  const save = () => { setEditing(false); setToast('Demo only: profile changes were not saved to a database.'); setTimeout(() => setToast(''), 3000); };

  return (
    <div className="animate-fadein max-w-3xl">
      {toast && <Toast message={toast} onClose={() => setToast('')} />}
      <PageHeader title="My Profile" subtitle="Manage your account information"
        action={<Button onClick={() => setEditing(e => !e)}><Edit size={16} /> {editing ? 'Cancel' : 'Edit Profile'}</Button>}
      />

      <div className="space-y-6">
        {/* Profile Card */}
        <Card className="p-6">
          <div className="flex items-start gap-5">
            <div className="w-20 h-20 rounded-2xl bg-[#2563EB] text-white text-3xl font-bold flex items-center justify-center shrink-0">
              {user?.name?.[0] ?? 'U'}
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-slate-800">{user?.name}</h2>
              <p className="text-slate-500">{user?.email}</p>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="success">Active</Badge>
                <span className="text-xs text-slate-400 capitalize bg-blue-50 px-2 py-0.5 rounded-full">{user?.role?.replace('_', ' ')}</span>
              </div>
            </div>
          </div>
        </Card>

        {/* Account Info */}
        <Card className="p-6">
          <h3 className="font-semibold text-[#080677] flex items-center gap-2 mb-5"><User size={18} /> Account Information</h3>
          <div className="space-y-4">
            {editing ? (
              <>
                <Input label="Full Name" defaultValue={user?.name} />
                <Input label="Email Address" type="email" defaultValue={user?.email} />
                {isRegularUser && <Input label="Institutional ID" defaultValue={user?.idNum} />}
                <Input label="Contact Number" placeholder="09XX XXX XXXX" defaultValue="09171234567" />
                {isRegularUser && <Input label="Department" defaultValue={user?.dept} />}
                <div className="flex gap-3 pt-2">
                  <Button onClick={save}>Save Changes</Button>
                  <Button variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
                </div>
              </>
            ) : (
              <div className="space-y-3">
                {[
                  ['Full Name', user?.name],
                  ['Email', user?.email],
                  ...(isRegularUser ? [['Institutional ID', user?.idNum], ['Department', user?.dept]] : []),
                  ['Contact Number', '09171234567'],
                  ['User Type', user?.role?.replace('_', ' ')],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between py-2 border-b border-slate-50 text-sm">
                    <span className="text-slate-400">{k}</span>
                    <span className="font-medium text-slate-700 capitalize">{v}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* Change Password */}
        <Card className="p-6">
          <h3 className="font-semibold text-[#080677] mb-5">Change Password</h3>
          <div className="space-y-4 max-w-sm">
            <Input label="Current Password" type="password" placeholder="••••••••" />
            <div className="relative">
              <Input label="New Password" type={showPwd ? 'text' : 'password'} placeholder="••••••••" />
              <button type="button" onClick={() => setShowPwd(v => !v)} className="absolute right-3 top-8 text-slate-400">
                {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <Input label="Confirm New Password" type="password" placeholder="••••••••" />
            <Button onClick={() => { setToast('Demo only: password was not changed. Backend authentication is required.'); }}>Update Password</Button>
          </div>
        </Card>

        {/* Parking credentials are managed in their dedicated workflow, not fabricated on the profile page. */}
        {isRegularUser && <Card className="p-5">
          <h3 className="font-semibold text-[#080677] mb-2">Vehicle and RFID Services</h3>
          <p className="text-sm text-slate-500">Manage registered vehicles and submit RFID assignment requests from My Vehicle. Account approval does not automatically approve a vehicle or assign an RFID.</p>
        </Card>}
      </div>
    </div>
  );
}
