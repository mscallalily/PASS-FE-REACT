import React, { useState } from 'react';
import { Card, Badge, Button, Table } from './ui';
import { LICENSE_STATUS_LABEL, LicenseStatus, useLicense } from '../context/LicenseContext';

interface Row { key: string; owner: string; licenseNo: string; expiry: string; file: string; submitted: string; status: LicenseStatus; live?: boolean }

const MOCK_ROWS: Row[] = [
  { key: 'm1', owner: 'Carlos Bautista', licenseNo: 'N03-22-118204', expiry: '2027-03-14', file: 'license_bautista.jpg', submitted: '2026-10-09', status: 'pending' },
  { key: 'm2', owner: 'Ana Reyes', licenseNo: 'N02-19-554310', expiry: '2026-12-01', file: 'DL_reyes.pdf', submitted: '2026-10-07', status: 'pending' },
  { key: 'm3', owner: 'Juan dela Cruz', licenseNo: 'N01-18-902277', expiry: '2028-06-30', file: 'jdc_license.png', submitted: '2026-09-28', status: 'verified' },
];

const badge = (s: LicenseStatus) => (s === 'verified' ? 'success' : s === 'pending' ? 'warning' : s === 'rejected' ? 'danger' : 'default');

/** Staff/admin queue for driver's license verification. Prototype: decisions are not persisted. */
export default function LicenseReviewQueue({ onToast }: { onToast: (m: string) => void }) {
  const { status, submission, review } = useLicense();
  const [mock, setMock] = useState(MOCK_ROWS);

  const live: Row[] = submission
    ? [{ key: 'live', owner: submission.owner, licenseNo: submission.licenseNo, expiry: submission.expiry, file: submission.fileName, submitted: submission.submittedAt, status, live: true }]
    : [];
  const rows = [...live, ...mock];

  const decide = (r: Row, s: 'verified' | 'rejected') => {
    if (r.live) review(s, s === 'rejected' ? 'The photo was unclear or the details did not match. Please resubmit.' : '');
    else setMock(prev => prev.map(x => (x.key === r.key ? { ...x, status: s } : x)));
    onToast(`${r.owner}: license ${s === 'verified' ? 'verified' : 'marked as needs correction'} (demo, not saved).`);
  };

  return (
    <Card>
      <div className="p-5 border-b border-slate-50">
        <p className="text-sm text-slate-500">Check each submitted license against the uploaded photo. Verifying a license does not authorize a vehicle or assign an RFID; those are separate steps.</p>
      </div>
      <Table
        columns={[
          { key: 'owner', label: 'Owner', render: (r: Row) => <span className="font-medium text-slate-700">{r.owner}{r.live && <span className="ml-2 text-[10px] text-[#2563EB] font-semibold">THIS SESSION</span>}</span> },
          { key: 'licenseNo', label: 'License No.', render: (r: Row) => <span className="font-mono text-xs">{r.licenseNo}</span> },
          { key: 'expiry', label: 'Expiry' },
          { key: 'file', label: 'Uploaded File' },
          { key: 'submitted', label: 'Submitted' },
          { key: 'status', label: 'Status', render: (r: Row) => <Badge variant={badge(r.status) as any}>{LICENSE_STATUS_LABEL[r.status]}</Badge> },
          { key: 'actions', label: 'Actions', render: (r: Row) => r.status === 'pending' ? (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => decide(r, 'verified')}>Verify</Button>
              <Button size="sm" variant="danger" onClick={() => decide(r, 'rejected')}>Needs correction</Button>
            </div>
          ) : <span className="text-xs text-slate-300">—</span> },
        ]}
        data={rows}
      />
    </Card>
  );
}
