import { useLocation } from 'react-router-dom';
import { PAGE_SECTIONS, selectedSection } from '../../lib/pageSections';
import React, { useState } from 'react';
import { PageHeader, Card, Button,  Toggle, Toast, Input, Select } from '../../components/ui';
import { Settings, Save } from 'lucide-react';

export default function SystemSettings() {
  const { pathname } = useLocation();
  const tab = selectedSection(PAGE_SECTIONS.settings, pathname);
  const [toast, setToast] = useState('');
  const [notifEmail, setNotifEmail] = useState(true);
  const [notifMobile, setNotifMobile] = useState(true);
  const [notifSecurity, setNotifSecurity] = useState(true);
  const [twoFactor, setTwoFactor] = useState(false);

  const save = () => { setToast('Demo only: settings were not persisted.'); setTimeout(() => setToast(''), 3000); };

  return (
    <div className="animate-fadein">
      {toast && <Toast message={toast} onClose={() => setToast('')} />}
      <PageHeader title={tab === 'General' ? 'System Settings' : `System Settings · ${tab}`} subtitle="Configure PASS system preferences and parameters"
        action={<Button onClick={save}><Save size={16} /> Save Changes</Button>}
      />



      {tab === 'General' && (
        <Card className="p-8 space-y-6 max-w-2xl">
          <h3 className="font-semibold text-[#080677] flex items-center gap-2"><Settings size={18} /> General Settings</h3>
          <Input label="System Name" defaultValue="PASS — Parking Access and Security System" />
          <Input label="Institution Name" defaultValue="Dr. Yanga's Colleges, Inc." />
          <Input label="Contact Email" defaultValue="parking@dyci.edu.ph" type="email" />
          <Input label="Contact Phone" defaultValue="(02) 8123-4567" />
          <Select label="Time Zone">
            <option>Asia/Manila (UTC+8)</option>
            <option>UTC</option>
          </Select>
          <Select label="Date Format">
            <option>MM/DD/YYYY</option>
            <option>DD/MM/YYYY</option>
            <option>YYYY-MM-DD</option>
          </Select>
          <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center">
            <p className="text-sm text-slate-400">Click to upload system logo</p>
          </div>
          <div className="flex gap-3">
            <Button onClick={save}>Save General Settings</Button>
            <Button variant="outline">Cancel</Button>
          </div>
        </Card>
      )}

      {tab === 'Parking' && (
        <Card className="p-8 space-y-6 max-w-2xl">
          <h3 className="font-semibold text-[#080677]">Parking Settings</h3>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Max Capacity (Zone A)" defaultValue="50" type="number" />
            <Input label="Max Capacity (Zone B)" defaultValue="40" type="number" />
            <Input label="Max Capacity (Zone C)" defaultValue="60" type="number" />
            <Input label="Max Capacity (Zone D)" defaultValue="30" type="number" />
          </div>
          <Input label="Occupancy Warning Threshold (%)" defaultValue="80" type="number" />
          <Input label="Maximum Parking Duration (hours)" defaultValue="12" type="number" />
          <Select label="Default Slot Type"><option>Regular</option><option>Reserved</option><option>Disabled</option><option>Motorcycle</option></Select>
          <div>
            <label className="text-sm font-medium text-slate-700 mb-2 block">Vehicle Categories Allowed</label>
            <div className="grid grid-cols-3 gap-2">
              {['Sedan', 'SUV', 'Hatchback', 'Motorcycle', 'Van', 'Pickup'].map(v => (
                <label key={v} className="flex items-center gap-2 text-sm text-slate-600">
                  <input type="checkbox" defaultChecked className="rounded" /> {v}
                </label>
              ))}
            </div>
          </div>
          <Button onClick={save}>Save Parking Settings</Button>
        </Card>
      )}

      {tab === 'Access Control' && (
        <Card className="p-8 space-y-6 max-w-2xl">
          <h3 className="font-semibold text-[#080677]">Access Control Settings</h3>
          <Input label="RFID Card Validity (months)" defaultValue="12" type="number" />
          <Input label="QR Pass Validity (hours)" defaultValue="4" type="number" />
          <Select label="Visitor Pass Review">
            <option>Parking Staff Review Required</option>
          </Select>
          <p className="text-sm text-slate-500">RFID remains the regular-user access credential. QR passes are limited to temporary visitors.</p>
          <Button onClick={save}>Save Access Settings</Button>
        </Card>
      )}

      {tab === 'Notifications' && (
        <Card className="p-8 space-y-6 max-w-2xl">
          <h3 className="font-semibold text-[#080677]">Notification Settings</h3>
          <div className="space-y-4">
            {[
              { label: 'Email Notifications', val: notifEmail, set: setNotifEmail },
              { label: 'Mobile Push Notifications', val: notifMobile, set: setNotifMobile },
              { label: 'Security Alert Notifications', val: notifSecurity, set: setNotifSecurity },
            ].map(item => (
              <div key={item.label} className="flex items-center justify-between p-4 rounded-xl bg-slate-50">
                <span className="text-sm font-medium text-slate-700">{item.label}</span>
                <Toggle checked={item.val} onChange={item.set} />
              </div>
            ))}
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 mb-3 block">Notify for Events</label>
            <div className="space-y-2">
              {['Parking area full', 'Unauthorized access attempt', 'New registration request', 'Expiring vehicle documents', 'New violation recorded'].map(e => (
                <label key={e} className="flex items-center gap-2 text-sm text-slate-600">
                  <input type="checkbox" defaultChecked className="rounded" /> {e}
                </label>
              ))}
            </div>
          </div>
          <Button onClick={save}>Save Notification Settings</Button>
        </Card>
      )}

      {tab === 'Security' && (
        <Card className="p-8 space-y-6 max-w-2xl">
          <h3 className="font-semibold text-[#080677]">User & Security Settings</h3>
          <Input label="Minimum Password Length" defaultValue="8" type="number" />
          <Input label="Session Timeout (minutes)" defaultValue="30" type="number" />
          <Input label="Max Login Attempts" defaultValue="5" type="number" />
          <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50">
            <div>
              <p className="text-sm font-medium text-slate-700">Two-Factor Authentication</p>
              <p className="text-xs text-slate-400">Require 2FA for all admin accounts</p>
            </div>
            <Toggle checked={twoFactor} onChange={setTwoFactor} />
          </div>
          <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50">
            <div>
              <p className="text-sm font-medium text-slate-700">Force Password Reset on First Login</p>
            </div>
            <Toggle checked={false} onChange={() => {}} />
          </div>
          <Button onClick={save}>Save Security Settings</Button>
        </Card>
      )}
    </div>
  );
}
