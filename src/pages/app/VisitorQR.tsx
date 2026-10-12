import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { PageHeader, Card, Badge, statusBadge, Button, Table, SearchBar, Modal, Tabs, Toast, Input, Select } from '../../components/ui';
import { MOCK_VISITORS } from '../../data/mock';
import { QrCode, UserCheck, Check, X, Clock, CheckCircle, XCircle } from 'lucide-react';

function QRPassCard({ name, passId, valid, area }: { name: string; passId: string; valid: string; area: string }) {
  return (
    <div className="bg-gradient-to-br from-[#080677] via-[#1E4F8A] to-[#2563EB] rounded-2xl p-6 text-white max-w-sm mx-auto">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center">
          <QrCode size={18} className="text-[#38BDF8]" />
        </div>
        <div>
          <p className="text-xs text-blue-200 font-medium">PASS — Visitor QR Access Pass</p>
          <p className="text-[10px] text-blue-300">Parking Access & Security System</p>
        </div>
      </div>
      <h2 className="text-xl font-bold">{name}</h2>
      <p className="text-blue-300 text-xs mt-1">Pass ID: {passId}</p>
      <div className="my-5 bg-white rounded-xl p-3 flex items-center justify-center">
        <div className="grid grid-cols-7 gap-0.5">
          {Array.from({ length: 49 }).map((_, i) => (
            <div key={i} className={`w-4 h-4 rounded-[2px] ${[0,1,2,3,4,5,6,7,14,21,28,35,42,43,44,45,46,47,48,8,15,22,29,36,16,17,18,19,20,24,25,26].includes(i) ? 'bg-[#080677]' : 'bg-white'}`} />
          ))}
        </div>
      </div>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-blue-300">Valid Until</span>
          <span className="font-semibold">{valid}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-blue-300">Access Area</span>
          <span className="font-semibold">{area}</span>
        </div>
      </div>
      <p className="text-[10px] text-blue-400 text-center mt-4 border-t border-white/10 pt-3">
        Present this QR code at the campus entrance gate. One-time use only.
      </p>
    </div>
  );
}

export default function VisitorQR() {
  const { pathname } = useLocation();
  const [tab, setTab] = useState('Visitor Records');
  const [toast, setToast] = useState('');
  const [showGenerate, setShowGenerate] = useState(false);
  const [showQR, setShowQR] = useState<any>(null);
  const [verifyState, setVerifyState] = useState<'idle' | 'scanning' | 'valid' | 'expired' | 'invalid' | 'revoked'>('idle');
  const [scanResult, setScanResult] = useState<any>(null);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  useEffect(() => {
    setTab(pathname.endsWith('/qr-verify') ? 'QR Verification' : 'Visitor Records');
  }, [pathname]);

  const simulateVerify = () => {
    setVerifyState('scanning');
    setTimeout(() => {
      const states = ['valid', 'expired', 'invalid', 'revoked'] as const;
      const state = states[Math.floor(Math.random() * states.length)];
      setVerifyState(state);
      setScanResult({ name: 'Alice Brown', passId: 'QR-2024-0021', host: 'Admissions Office', valid: 'Sep 2, 2024 — 11:00 PM', area: 'Visitor Zone A' });
    }, 1500);
  };

  return (
    <div className="animate-fadein">
      {toast && <Toast message={toast} type="success" onClose={() => setToast('')} />}
      <PageHeader title="Visitor QR Access" subtitle="Keep temporary visitor access separate from regular-user RFID access"
        action={tab === 'Visitor Records' ? <Button onClick={() => setShowGenerate(true)}><QrCode size={16} /> Create Visitor Pass</Button> : undefined}
      />
      <Tabs tabs={['Visitor Records', 'QR Verification']} active={tab} onChange={setTab} />

      {tab === 'Visitor Records' && (
        <Card>
          <div className="p-5 border-b border-slate-50">
            <SearchBar value="" onChange={() => {}} placeholder="Search visitors..." />
          </div>
          <Table
            columns={[
              { key: 'id', label: 'ID', render: v => <span className="font-mono text-xs">{v.id}</span> },
              { key: 'name', label: 'Visitor Name' },
              { key: 'purpose', label: 'Purpose' },
              { key: 'host', label: 'Host' },
              { key: 'date', label: 'Visit Date' },
              { key: 'arrival', label: 'Arrival' },
              { key: 'status', label: 'Status', render: v => <Badge variant={statusBadge(v.status)}>{v.status}</Badge> },
              { key: 'actions', label: 'Actions', render: v => (
                <div className="flex gap-2">
                  {v.status === 'approved' && (
                    <>
                      <Button size="sm" variant="success" onClick={() => showToast(`Checked in: ${v.name}`)}>Check In</Button>
                      <Button size="sm" variant="outline" onClick={() => setShowQR(v)}><QrCode size={12} /> QR</Button>
                    </>
                  )}
                  {v.status === 'pending' && (
                    <>
                      <Button size="sm" variant="success" onClick={() => showToast(`Demo only: ${v.name} was not actually approved. Backend integration is required.`)}><Check size={12} /> Approve</Button>
                      <Button size="sm" variant="danger" onClick={() => showToast(`Rejected: ${v.name}`)}><X size={12} /> Reject</Button>
                    </>
                  )}
                </div>
              )},
            ]}
            data={MOCK_VISITORS}
          />
        </Card>
      )}

      {tab === 'QR Access Passes' && (
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <Card className="p-5">
              <h3 className="font-semibold text-slate-700 mb-4">Active QR Passes</h3>
              {['Alice Brown — QR-2024-0021', 'Bob Johnson — QR-2024-0022'].map((p, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-blue-50 mb-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-700">{p.split(' — ')[0]}</p>
                    <p className="text-xs font-mono text-slate-400 mt-0.5">{p.split(' — ')[1]}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setShowQR({ name: p.split(' — ')[0], id: p.split(' — ')[1] })}>View</Button>
                    <Button size="sm" variant="danger" onClick={() => showToast('QR pass revoked')}>Revoke</Button>
                  </div>
                </div>
              ))}
            </Card>
            <Card className="p-5">
              <h3 className="font-semibold text-slate-700 mb-3">Expired Passes</h3>
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50">
                <div>
                  <p className="text-sm text-slate-600">John Smith</p>
                  <p className="text-xs text-slate-400 font-mono">QR-2024-0019</p>
                </div>
                <Badge variant="default">Expired</Badge>
              </div>
            </Card>
          </div>
          <div>
            <QRPassCard name="Alice Brown" passId="QR-2024-0021" valid="Sep 2, 2024 — 11:59 PM" area="Visitor Zone A" />
          </div>
        </div>
      )}

      {tab === 'QR Verification' && (
        <div className="max-w-lg mx-auto space-y-5">
          <Card className="p-8 text-center">
            <h3 className="font-bold text-[#080677] text-lg mb-2">Visitor Pass Verification</h3>
            <p className="text-sm text-slate-500 mb-5">Validate a temporary visitor pass before recording access.</p>
            <div className={`relative w-52 h-52 mx-auto border-4 rounded-2xl mb-6 ${
              verifyState === 'valid' ? 'border-green-400 bg-green-50' :
              ['expired', 'invalid', 'revoked'].includes(verifyState) ? 'border-red-400 bg-red-50' :
              verifyState === 'scanning' ? 'border-[#2563EB] bg-blue-50' : 'border-slate-200 bg-slate-50'
            }`}>
              {verifyState === 'idle' && (
                <>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <QrCode size={80} className="text-slate-200" />
                  </div>
                  <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-[#2563EB] rounded-tl-xl" />
                  <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-[#2563EB] rounded-tr-xl" />
                  <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-[#2563EB] rounded-bl-xl" />
                  <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-[#2563EB] rounded-br-xl" />
                </>
              )}
              {verifyState === 'scanning' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <div className="scan-line" />
                  <p className="text-[#2563EB] font-semibold animate-pulse mt-4 text-sm">Scanning...</p>
                </div>
              )}
              {verifyState === 'valid' && <div className="absolute inset-0 flex items-center justify-center"><CheckCircle size={64} className="text-green-500" /></div>}
              {['expired', 'invalid', 'revoked'].includes(verifyState) && <div className="absolute inset-0 flex items-center justify-center"><XCircle size={64} className="text-red-500" /></div>}
            </div>

            {verifyState === 'idle' && <p className="text-slate-400 text-sm mb-5">Use the sample pass to preview verification results.</p>}
            {verifyState === 'valid' && scanResult && (
              <div className="text-left bg-green-50 rounded-xl p-4 mb-4 space-y-2 text-sm">
                <p className="font-bold text-green-700">Valid visitor pass</p>
                <p className="flex justify-between"><span className="text-slate-400">Visitor</span><span className="font-medium">{scanResult.name}</span></p>
                <p className="flex justify-between"><span className="text-slate-400">Pass ID</span><span className="font-mono text-xs">{scanResult.passId}</span></p>
                <p className="flex justify-between"><span className="text-slate-400">Host</span><span>{scanResult.host}</span></p>
                <p className="flex justify-between"><span className="text-slate-400">Valid Until</span><span>{scanResult.valid}</span></p>
                <div className="pt-2 flex gap-2">
                  <Button size="sm" variant="success" onClick={() => showToast('Entry recorded')}>Record Entry</Button>
                </div>
              </div>
            )}
            {verifyState === 'expired' && <p className="text-red-600 font-bold mb-4">Visitor pass expired</p>}
            {verifyState === 'invalid' && <p className="text-red-600 font-bold mb-4">Invalid visitor pass — not recognized in system</p>}
            {verifyState === 'revoked' && <p className="text-red-600 font-bold mb-4">Visitor pass revoked — access denied</p>}

            <div className="flex gap-3 justify-center">
              {verifyState === 'idle' ? (
                <Button onClick={simulateVerify}><QrCode size={16} /> Check Sample Pass</Button>
              ) : (
                <Button variant="outline" onClick={() => { setVerifyState('idle'); setScanResult(null); }}>Reset</Button>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* Generate QR Pass Modal */}
      <Modal open={showGenerate} onClose={() => setShowGenerate(false)} title="Generate Visitor QR Pass" size="md">
        <div className="space-y-4">
          <Input label="Visitor Name" placeholder="Full name" />
          <Input label="Host / Person to Visit" placeholder="Dr. Santos / Admissions Office" />
          <Select label="Access Area"><option>Visitor Zone A</option><option>All Visitor Zones</option><option>Administrative Block</option></Select>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Valid Date" type="date" />
            <Input label="Valid Until" type="time" />
          </div>
          <div className="flex gap-3 pt-2">
            <Button onClick={() => { showToast('QR Pass generated'); setShowGenerate(false); }}>Generate QR Pass</Button>
            <Button variant="outline" onClick={() => setShowGenerate(false)}>Cancel</Button>
          </div>
        </div>
      </Modal>

      {/* QR View Modal */}
      <Modal open={!!showQR} onClose={() => setShowQR(null)} title="QR Access Pass" size="sm">
        {showQR && (
          <div className="space-y-4">
            <QRPassCard name={showQR.name || 'Visitor'} passId={showQR.id || 'QR-2024-0021'} valid="Today — 11:59 PM" area="Visitor Zone A" />
            <div className="flex gap-3">
              <Button className="flex-1 justify-center" variant="outline" onClick={() => showToast('QR pass revoked')}>Revoke Pass</Button>
              <Button className="flex-1 justify-center" onClick={() => showToast('Validity extended')}>Extend Validity</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
