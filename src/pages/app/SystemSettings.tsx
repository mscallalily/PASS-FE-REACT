import { jsonFetch } from '../../lib/http';
import { useLocation } from 'react-router-dom';
import { PAGE_SECTIONS, selectedSection } from '../../lib/pageSections';
import React, { useEffect, useRef, useState } from 'react';
import { PageHeader, Card, Button,  Toggle, Toast, Input, Select } from '../../components/ui';
import { Settings, Save } from 'lucide-react';

type TabName = 'General' | 'Parking' | 'Access Control' | 'Notifications' | 'Security';
type SettingsData = {
  system_name: string;
  institution_name: string;
  contact_email: string;
  contact_phone: string;
  timezone: string;
  date_format: string;
  zone_a_capacity: string;
  zone_b_capacity: string;
  zone_c_capacity: string;
  zone_d_capacity: string;
  occupancy_warning_threshold: string;
  max_parking_duration_hours: string;
  default_slot_type: string;
  allowed_vehicle_categories: string[];
  rfid_card_validity_months: string;
  qr_pass_validity_hours: string;
  visitor_pass_review: string;
  notify_email: boolean;
  notify_mobile: boolean;
  notify_security: boolean;
  notification_events: string[];
  min_password_length: string;
  session_timeout_minutes: string;
  max_login_attempts: string;
  two_factor_required: boolean;
  force_password_reset_first_login: boolean;
};

const VEHICLE_CATEGORIES = ['Sedan', 'SUV', 'Hatchback', 'Motorcycle', 'Van', 'Pickup'];
const NOTIFICATION_EVENTS = [
  'Parking area full',
  'Unauthorized access attempt',
  'New registration request',
  'Expiring vehicle documents',
  'New violation recorded',
];

const DEFAULT_SETTINGS: SettingsData = {
  system_name: 'PASS — Parking Access and Space Management System',
  institution_name: "Dr. Yanga's Colleges, Inc.",
  contact_email: 'parking@dyci.edu.ph',
  contact_phone: '(02) 8123-4567',
  timezone: 'Asia/Manila',
  date_format: 'MM/DD/YYYY',
  zone_a_capacity: '50',
  zone_b_capacity: '40',
  zone_c_capacity: '60',
  zone_d_capacity: '30',
  occupancy_warning_threshold: '80',
  max_parking_duration_hours: '12',
  default_slot_type: 'Regular',
  allowed_vehicle_categories: [...VEHICLE_CATEGORIES],
  rfid_card_validity_months: '12',
  qr_pass_validity_hours: '4',
  visitor_pass_review: 'Parking Staff Review Required',
  notify_email: true,
  notify_mobile: true,
  notify_security: true,
  notification_events: [...NOTIFICATION_EVENTS],
  min_password_length: '8',
  session_timeout_minutes: '30',
  max_login_attempts: '5',
  two_factor_required: false,
  force_password_reset_first_login: false,
};

const KEYS: Record<TabName, (keyof SettingsData)[]> = {
  General: ['system_name', 'institution_name', 'contact_email', 'contact_phone', 'timezone', 'date_format'],
  Parking: [
    'zone_a_capacity', 'zone_b_capacity', 'zone_c_capacity', 'zone_d_capacity',
    'occupancy_warning_threshold', 'max_parking_duration_hours', 'default_slot_type',
    'allowed_vehicle_categories',
  ],
  'Access Control': ['rfid_card_validity_months', 'qr_pass_validity_hours', 'visitor_pass_review'],
  Notifications: ['notify_email', 'notify_mobile', 'notify_security', 'notification_events'],
  Security: [
    'min_password_length', 'session_timeout_minutes', 'max_login_attempts',
    'two_factor_required', 'force_password_reset_first_login',
  ],
};

const NUMBER_KEYS: (keyof SettingsData)[] = [
  'zone_a_capacity', 'zone_b_capacity', 'zone_c_capacity', 'zone_d_capacity',
  'occupancy_warning_threshold', 'max_parking_duration_hours',
  'rfid_card_validity_months', 'qr_pass_validity_hours',
  'min_password_length', 'session_timeout_minutes', 'max_login_attempts',
];

function normalizeSettings(input: Record<string, unknown>): SettingsData {
  const next: SettingsData = { ...DEFAULT_SETTINGS };
  for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof SettingsData)[]) {
    const value = input[key];
    if (value === undefined || value === null) continue;
    if (Array.isArray(DEFAULT_SETTINGS[key])) {
      if (Array.isArray(value)) (next as any)[key] = value.filter(v => typeof v === 'string');
    } else if (typeof DEFAULT_SETTINGS[key] === 'boolean') {
      (next as any)[key] = value === true || value === 'true' || value === 1 || value === '1';
    } else {
      (next as any)[key] = String(value);
    }
  }
  return next;
}

function getAuthToken(): string | null {
  return localStorage.getItem('pass_auth_token') || sessionStorage.getItem('pass_auth_token');
}

export default function SystemSettings() {
  const { pathname } = useLocation();
  const tab = selectedSection(PAGE_SECTIONS.settings, pathname);
  const [toast, setToast] = useState('');
  const [settings, setSettings] = useState<SettingsData>(DEFAULT_SETTINGS);
  const savedSettings = useRef<SettingsData>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [loadedSettings, setLoadedSettings] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [logoUploading, setLogoUploading] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const token = getAuthToken();
        if (!token) throw new Error('No login token found. Please log in again.');
        const response = await jsonFetch('/api/admin/system-settings', {
          headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
        });
        if (!response.ok) throw new Error(`Unable to load system settings (${response.status}).`);
        const result = await response.json();
        const normalized = normalizeSettings(result.data ?? result.settings ?? result);
        if (!cancelled) {
          setSettings(normalized);
          setLoadedSettings(true);
          savedSettings.current = normalized;
          setError('');
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Unable to load settings.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  function notify(message: string) {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 3000);
  }

  function setField<K extends keyof SettingsData>(key: K, value: SettingsData[K]) {
    setSettings(prev => ({ ...prev, [key]: value }));
  }

  // Accepts either native input/select events or custom UI component values.
  const field = (key: keyof SettingsData) => ({
    value: String(settings[key]),
    disabled: isBusy,
    onChange: (eventOrValue: any) => {
      const next = eventOrValue?.target ? eventOrValue.target.value : eventOrValue;
      setSettings(prev => ({ ...prev, [key]: String(next) }));
    },
  });

  function toggleArray(key: 'allowed_vehicle_categories' | 'notification_events', value: string, checked: boolean) {
    setSettings(prev => ({
      ...prev,
      [key]: checked ? Array.from(new Set([...prev[key], value])) : prev[key].filter(item => item !== value),
    }));
  }

  async function save(scope: TabName | 'all' = 'all') {
    if (loading || saving || !loadedSettings) return;
    setSaving(true);
    setError('');
    try {
      const token = getAuthToken();
      if (!token) throw new Error('No login token found. Please log in again.');
      if (tab !== 'General') throw new Error('This settings section is not available yet.');
      const names = KEYS.General;
      const body: Record<string, unknown> = {};
      for (const key of names) {
        const value = settings[key];
        // Keep all numeric values numeric for Laravel validation.
        body[key] = NUMBER_KEYS.includes(key) ? Number(value) : value;
      }
      const response = await jsonFetch('/api/admin/system-settings', {
        method: 'PUT',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        const firstError = Object.values(result.errors ?? {}).flat()[0];
        throw new Error(String(firstError ?? result.message ?? `Saving failed (${response.status}).`));
      }
      savedSettings.current = {
        ...savedSettings.current,
        ...Object.fromEntries(names.map(key => [key, settings[key]])),
      } as SettingsData;
      notify('General settings saved successfully.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save system settings.');
    } finally {
      setSaving(false);
    }
  }

  async function uploadLogo(file?: File) {
    if (!file || logoUploading) return;
    setLogoUploading(true);
    setError('');
    try {
      const token = getAuthToken();
      if (!token) throw new Error('No login token found. Please log in again.');
      const body = new FormData();
      body.append('logo', file);
      const response = await jsonFetch('/api/admin/system-settings/logo', {
        method: 'POST',
        headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
        body,
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || `Logo upload failed (${response.status}).`);
      notify('System logo uploaded successfully.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to upload logo.');
    } finally {
      setLogoUploading(false);
      if (logoInputRef.current) logoInputRef.current.value = '';
    }
  }

  const isBusy = loading || saving || !loadedSettings;

  return (
    <div className="animate-fadein">
      {toast && <Toast message={toast} onClose={() => setToast('')} />}
      <PageHeader title={tab === 'General' ? 'System Settings' : `System Settings · ${tab}`} subtitle="Configure PASS system preferences and parameters"
        action={<Button disabled={isBusy || tab !== 'General'} onClick={() => void save('General')}><Save size={16} /> Save Changes</Button>}
      />



      {loading && <p role="status" className="mb-4 text-sm text-slate-500">Loading settings…</p>}
      {error && <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"><p>{error}</p><Button className="mt-3" variant="outline" onClick={() => window.location.reload()}>Reload settings</Button></div>}

      {tab === 'General' && (
        <Card className="p-4 sm:p-6 space-y-6 max-w-2xl">
          <h3 className="font-semibold text-[#080677] flex items-center gap-2"><Settings size={18} /> General Settings</h3>
          <p className="text-xs text-slate-500">General preferences are saved here. Gate and visitor schedules use Manila time.</p>
          <Input label="System Name" {...field('system_name')} />
          <Input label="Institution Name" {...field('institution_name')} />
          <Input label="Contact Email" type="email" {...field('contact_email')} />
          <Input label="Contact Phone" {...field('contact_phone')} />
          <Select label="Time Zone" {...field('timezone')}>
            <option value="Asia/Manila">Asia/Manila (UTC+8)</option>
            <option>UTC</option>
          </Select>
          <Select label="Date Format" {...field('date_format')}>
            <option>MM/DD/YYYY</option>
            <option>DD/MM/YYYY</option>
            <option>YYYY-MM-DD</option>
          </Select>
          <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">Logo upload is not available yet. The existing PASS logo remains in use.</p>
          <div className="flex gap-3">
            <Button onClick={() => void save('General')} disabled={isBusy}>Save General Settings</Button>
            <Button variant="outline" onClick={() => setSettings(prev => ({ ...prev, ...Object.fromEntries(KEYS.General.map(key => [key, savedSettings.current[key]])) }))}>Cancel</Button>
          </div>
        </Card>
      )}

      {tab !== 'General' && <p role="status" className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">This section is a preview. These controls do not change parking, gate, notification or security rules yet.</p>}
      <fieldset disabled={tab !== 'General'} className="min-w-0">
      {tab === 'Parking' && (
        <Card className="p-4 sm:p-6 space-y-6 max-w-2xl">
          <h3 className="font-semibold text-[#080677]">Parking Settings</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Max Capacity (Zone A)" type="number" {...field('zone_a_capacity')} />
            <Input label="Max Capacity (Zone B)" type="number" {...field('zone_b_capacity')} />
            <Input label="Max Capacity (Zone C)" type="number" {...field('zone_c_capacity')} />
            <Input label="Max Capacity (Zone D)" type="number" {...field('zone_d_capacity')} />
          </div>
          <Input label="Occupancy Warning Threshold (%)" type="number" {...field('occupancy_warning_threshold')} />
          <Input label="Maximum Parking Duration (hours)" type="number" {...field('max_parking_duration_hours')} />
          <Select label="Default Slot Type" {...field('default_slot_type')}><option>Regular</option><option>Reserved</option><option>Disabled</option><option>Motorcycle</option></Select>
          <div>
            <label className="text-sm font-medium text-slate-700 mb-2 block">Vehicle Categories Allowed</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {VEHICLE_CATEGORIES.map(v => (
                <label key={v} className="flex items-center gap-2 text-sm text-slate-600">
                  <input type="checkbox" checked={settings.allowed_vehicle_categories.includes(v)}
                    onChange={event => toggleArray('allowed_vehicle_categories', v, event.target.checked)} className="rounded" /> {v}
                </label>
              ))}
            </div>
          </div>
          <Button onClick={() => void save('Parking')} disabled={isBusy}>Save Parking Settings</Button>
        </Card>
      )}

      {tab === 'Access Control' && (
        <Card className="p-4 sm:p-6 space-y-6 max-w-2xl">
          <h3 className="font-semibold text-[#080677]">Access Control Settings</h3>
          <Input label="RFID Card Validity (months)" type="number" {...field('rfid_card_validity_months')} />
          <Input label="QR Pass Validity (hours)" type="number" {...field('qr_pass_validity_hours')} />
          <Select label="Visitor Pass Review" {...field('visitor_pass_review')}>
            <option>Parking Staff Review Required</option>
          </Select>
          <p className="text-sm text-slate-500">RFID remains the regular-user access credential. QR passes are limited to temporary visitors.</p>
          <Button onClick={() => void save('Access Control')} disabled={isBusy}>Save Access Settings</Button>
        </Card>
      )}

      {tab === 'Notifications' && (
        <Card className="p-4 sm:p-6 space-y-6 max-w-2xl">
          <h3 className="font-semibold text-[#080677]">Notification Settings</h3>
          <div className="space-y-4">
            {([
              { label: 'Email Notifications', key: 'notify_email' },
              { label: 'Mobile Push Notifications', key: 'notify_mobile' },
              { label: 'Security Alert Notifications', key: 'notify_security' },
            ] as const).map(item => (
              <div key={item.label} className="flex items-center justify-between p-4 rounded-xl bg-slate-50">
                <span className="text-sm font-medium text-slate-700">{item.label}</span>
                <Toggle checked={settings[item.key]} onChange={val => setField(item.key, val)} />
              </div>
            ))}
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 mb-3 block">Notify for Events</label>
            <div className="space-y-2">
              {NOTIFICATION_EVENTS.map(e => (
                <label key={e} className="flex items-center gap-2 text-sm text-slate-600">
                  <input type="checkbox" checked={settings.notification_events.includes(e)}
                    onChange={event => toggleArray('notification_events', e, event.target.checked)} className="rounded" /> {e}
                </label>
              ))}
            </div>
          </div>
          <Button onClick={() => void save('Notifications')} disabled={isBusy}>Save Notification Settings</Button>
        </Card>
      )}

      {tab === 'Security' && (
        <Card className="p-4 sm:p-6 space-y-6 max-w-2xl">
          <h3 className="font-semibold text-[#080677]">User & Security Settings</h3>
          <Input label="Minimum Password Length" type="number" {...field('min_password_length')} />
          <Input label="Session Timeout (minutes)" type="number" {...field('session_timeout_minutes')} />
          <Input label="Max Login Attempts" type="number" {...field('max_login_attempts')} />
          <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50">
            <div>
              <p className="text-sm font-medium text-slate-700">Two-Factor Authentication</p>
              <p className="text-xs text-slate-400">Require 2FA for all admin accounts</p>
            </div>
            <Toggle checked={settings.two_factor_required} onChange={val => setField('two_factor_required', val)} />
          </div>
          <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50">
            <div><p className="text-sm font-medium text-slate-700">Force Password Reset on First Login</p></div>
            <Toggle checked={settings.force_password_reset_first_login} onChange={val => setField('force_password_reset_first_login', val)} />
          </div>
          <Button onClick={() => void save('Security')} disabled={isBusy}>Save Security Settings</Button>
        </Card>
      )}
      </fieldset>
    </div>
  );
}
