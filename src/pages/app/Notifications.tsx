import React, { useState } from 'react';
import { PageHeader, Card, Button, Badge } from '../../components/ui';
import { MOCK_NOTIFS } from '../../data/mock';
import { Bell, CheckCircle, AlertTriangle, Info, XCircle, MailCheck } from 'lucide-react';

const TYPE_CFG = {
  success: { icon: <CheckCircle size={18} />, cls: 'bg-green-100 text-green-600' },
  info: { icon: <Info size={18} />, cls: 'bg-blue-100 text-blue-600' },
  warning: { icon: <AlertTriangle size={18} />, cls: 'bg-amber-100 text-amber-600' },
  danger: { icon: <XCircle size={18} />, cls: 'bg-red-100 text-red-600' },
};

export default function Notifications() {
  const [notifs, setNotifs] = useState(MOCK_NOTIFS);

  const markAllRead = () => setNotifs(n => n.map(i => ({ ...i, read: true })));
  const markRead = (id: number) => setNotifs(n => n.map(i => i.id === id ? { ...i, read: true } : i));
  const unread = notifs.filter(n => !n.read).length;

  return (
    <div className="animate-fadein max-w-2xl">
      <PageHeader title="Notifications" subtitle={`${unread} unread notification${unread !== 1 ? 's' : ''}`}
        action={<Button variant="outline" onClick={markAllRead}><MailCheck size={16} /> Mark All as Read</Button>}
      />

      <Card>
        <div className="divide-y divide-slate-50">
          {notifs.map(n => {
            const cfg = TYPE_CFG[n.type as keyof typeof TYPE_CFG] ?? TYPE_CFG.info;
            return (
              <div
                key={n.id}
                onClick={() => markRead(n.id)}
                className={`flex gap-4 p-5 hover:bg-blue-50/50 transition-colors cursor-pointer ${!n.read ? 'bg-blue-50/30' : ''}`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${cfg.cls}`}>
                  {cfg.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <p className={`text-sm font-semibold ${n.read ? 'text-slate-500' : 'text-slate-800'}`}>{n.title}</p>
                    {!n.read && <span className="w-2 h-2 bg-[#2563EB] rounded-full mt-1.5 shrink-0" />}
                  </div>
                  <p className="text-sm text-slate-500 mt-0.5 leading-relaxed">{n.body}</p>
                  <p className="text-xs text-slate-400 mt-1">{n.time}</p>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
