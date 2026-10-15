import React, { useCallback, useEffect, useState } from 'react';
import { PageHeader, Card, Button } from '../../components/ui';
import { apiRequest } from '../../lib/apiClient';
import { CheckCircle, AlertTriangle, Info, XCircle, MailCheck, Bell } from 'lucide-react';

interface NotificationRow {
  notification_id: number;
  notification_type: string;
  title: string;
  body: string;
  is_read: boolean;
  created_at: string | null;
}

const TYPE_CFG = {
  success: { icon: <CheckCircle size={18} />, cls: 'bg-green-100 text-green-600' },
  info: { icon: <Info size={18} />, cls: 'bg-blue-100 text-blue-600' },
  warning: { icon: <AlertTriangle size={18} />, cls: 'bg-amber-100 text-amber-600' },
  danger: { icon: <XCircle size={18} />, cls: 'bg-red-100 text-red-600' },
};

/** Visual tone for each notification_type stored by the backend. */
function toneOf(type: string): keyof typeof TYPE_CFG {
  if (['license_verified'].includes(type)) return 'success';
  if (['license_needs_correction', 'parking_access_denied', 'parking_area_full', 'wrong_area'].includes(type)) return 'danger';
  if (['wrong_slot', 'parking_area_nearly_full'].includes(type)) return 'warning';
  return 'info';
}

function timeAgo(iso: string | null) {
  if (!iso) return '';
  const seconds = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hr ago`;
  return new Date(iso).toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default function Notifications() {
  const [notifs, setNotifs] = useState<NotificationRow[] | null>(null);
  const [unread, setUnread] = useState(0);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const r = await apiRequest<{ data: NotificationRow[]; unread_count: number }>('/api/notifications');
      setNotifs(r.data);
      setUnread(r.unread_count);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load notifications.');
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, 30000);
    return () => clearInterval(timer);
  }, [load]);

  const markRead = async (n: NotificationRow) => {
    if (n.is_read) return;
    setNotifs(list => list?.map(i => (i.notification_id === n.notification_id ? { ...i, is_read: true } : i)) ?? null);
    setUnread(u => Math.max(0, u - 1));
    try {
      await apiRequest(`/api/notifications/${n.notification_id}/read`, { method: 'PATCH' });
    } catch {
      load();
    }
  };

  const markAllRead = async () => {
    try {
      await apiRequest('/api/notifications/read-all', { method: 'POST' });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update notifications.');
    }
  };

  return (
    <div className="animate-fadein max-w-2xl">
      <PageHeader title="Notifications" subtitle={`${unread} unread notification${unread !== 1 ? 's' : ''}`}
        action={<Button variant="outline" onClick={markAllRead} disabled={!unread}><MailCheck size={16} /> Mark All as Read</Button>}
      />

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      <Card>
        {notifs === null ? (
          <p className="py-16 text-center text-sm text-slate-400">{error ? 'Notifications could not be loaded.' : 'Loading notifications...'}</p>
        ) : notifs.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <Bell size={32} className="mx-auto mb-2 opacity-40" />
            <p className="text-sm">You have no notifications.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {notifs.map(n => {
              const cfg = TYPE_CFG[toneOf(n.notification_type)];
              return (
                <div
                  key={n.notification_id}
                  onClick={() => markRead(n)}
                  className={`flex gap-4 p-5 hover:bg-blue-50/50 transition-colors cursor-pointer ${!n.is_read ? 'bg-blue-50/30' : ''}`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${cfg.cls}`}>
                    {cfg.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <p className={`text-sm font-semibold ${n.is_read ? 'text-slate-500' : 'text-slate-800'}`}>{n.title}</p>
                      {!n.is_read && <span className="w-2 h-2 bg-[#2563EB] rounded-full mt-1.5 shrink-0" />}
                    </div>
                    <p className="text-sm text-slate-500 mt-0.5 leading-relaxed">{n.body}</p>
                    <p className="text-xs text-slate-400 mt-1">{timeAgo(n.created_at)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
