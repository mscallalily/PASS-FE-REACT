import React, { ReactNode, useState } from 'react';
import { Link } from 'react-router-dom';
import { X, CheckCircle, AlertTriangle, Info, XCircle, Search, ArrowLeft } from 'lucide-react';

// Badge
type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'default' | 'purple';
export function Badge({ children, variant = 'default' }: { children: ReactNode; variant?: BadgeVariant }) {
  const cls: Record<BadgeVariant, string> = {
    success: 'bg-green-100 text-green-700 border border-green-200',
    warning: 'bg-amber-100 text-amber-700 border border-amber-200',
    danger: 'bg-red-100 text-red-700 border border-red-200',
    info: 'bg-blue-100 text-blue-700 border border-blue-200',
    default: 'bg-slate-100 text-slate-600 border border-slate-200',
    purple: 'bg-purple-100 text-purple-700 border border-purple-200',
  };
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cls[variant]}`}>{children}</span>;
}

export function statusBadge(status: string): BadgeVariant {
  const map: Record<string, BadgeVariant> = {
    active: 'success', approved: 'success', granted: 'success', 'checked-out': 'default', completed: 'success', resolved: 'success', authorized: 'success', valid: 'success',
    pending: 'warning', 'pending-review': 'warning', 'under-review': 'warning', ongoing: 'warning',
    suspended: 'danger', denied: 'danger', rejected: 'danger', expired: 'danger', open: 'danger', 'access-denied': 'danger', invalid: 'danger', dismissed: 'default',
    'checked-in': 'info', unassigned: 'default', maintenance: 'purple', reserved: 'purple', warning: 'warning', success: 'success',
  };
  return map[status] ?? 'default';
}

// Button
type BtnVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline' | 'success';
export function Button({
  children, variant = 'primary', className = '', onClick, type = 'button', disabled, size = 'md',
}: {
  children: ReactNode; variant?: BtnVariant; className?: string; onClick?: () => void;
  type?: 'button' | 'submit'; disabled?: boolean; size?: 'sm' | 'md' | 'lg';
}) {
  const base = 'inline-flex items-center gap-2 font-medium rounded-lg transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed';
  const sz = { sm: 'px-3 py-1.5 text-xs', md: 'px-4 py-2 text-sm', lg: 'px-6 py-3 text-base' };
  const vars: Record<BtnVariant, string> = {
    primary: 'bg-[#080677] hover:bg-[#0a0a99] text-white focus:ring-[#080677]',
    secondary: 'bg-[#96D1F2] hover:bg-[#7fc3ea] text-[#080677] focus:ring-[#080677]',
    danger: 'bg-red-600 hover:bg-red-700 text-white focus:ring-red-500',
    ghost: 'bg-transparent hover:bg-blue-50 text-[#080677] focus:ring-[#080677]',
    outline: 'border border-[#080677] text-[#080677] hover:bg-blue-50 focus:ring-[#080677] bg-white',
    success: 'bg-green-600 hover:bg-green-700 text-white focus:ring-green-500',
  };
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`${base} ${sz[size]} ${vars[variant]} ${className}`}>
      {children}
    </button>
  );
}

// Card
export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`bg-white rounded-xl shadow-sm border border-blue-100 ${className}`}>{children}</div>;
}

// Input
export function Input({ label, error, className = '', ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string }) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-sm font-medium text-slate-700">{label}</label>}
      <input
        {...props}
        className={`border ${error ? 'border-red-400' : 'border-slate-200'} rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent bg-white ${className}`}
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

// Select
export function Select({ label, children, className = '', ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string }) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-sm font-medium text-slate-700">{label}</label>}
      <select
        {...props}
        className={`border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent bg-white ${className}`}
      >
        {children}
      </select>
    </div>
  );
}

// Modal
export function Modal({ open, onClose, title, children, size = 'md' }: {
  open: boolean; onClose: () => void; title: string; children: ReactNode; size?: 'sm' | 'md' | 'lg' | 'xl';
}) {
  if (!open) return null;
  const widths = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fadein">
      <div className={`bg-white rounded-2xl shadow-2xl w-full ${widths[size]} max-h-[90vh] overflow-y-auto`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800 text-lg">{title}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"><X size={18} /></button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

// Toast
export function Toast({ message, type = 'success', onClose }: { message: string; type?: 'success' | 'error' | 'warning' | 'info'; onClose: () => void }) {
  const cfg = {
    success: { icon: <CheckCircle size={18} />, cls: 'bg-green-600' },
    error: { icon: <XCircle size={18} />, cls: 'bg-red-600' },
    warning: { icon: <AlertTriangle size={18} />, cls: 'bg-amber-500' },
    info: { icon: <Info size={18} />, cls: 'bg-blue-600' },
  };
  const c = cfg[type];
  return (
    <div className={`fixed top-5 right-5 z-[100] flex items-center gap-3 px-4 py-3 rounded-xl text-white shadow-lg ${c.cls} animate-fadein max-w-sm`}>
      {c.icon}
      <span className="text-sm font-medium">{message}</span>
      <button onClick={onClose} className="ml-2 opacity-80 hover:opacity-100"><X size={16} /></button>
    </div>
  );
}

// Stat Card
export function StatCard({ label, value, icon, color = 'blue', sub }: {
  label: string; value: string | number; icon: ReactNode; color?: string; sub?: string;
}) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    red: 'bg-red-50 text-red-600',
    amber: 'bg-amber-50 text-amber-600',
    purple: 'bg-purple-50 text-purple-600',
    sky: 'bg-sky-50 text-sky-600',
    navy: 'bg-[#F4F7FB] text-[#080677]',
  };
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">{label}</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">{value}</p>
          {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
        </div>
        <div className={`p-3 rounded-xl ${colors[color] ?? colors.blue}`}>{icon}</div>
      </div>
    </Card>
  );
}

// Table
export function Table({ columns, data, onRowClick }: {
  columns: { key: string; label: string; render?: (row: any) => ReactNode }[];
  data: any[];
  onRowClick?: (row: any) => void;
}) {
  if (data.length === 0) {
    return (
      <div className="py-16 text-center text-slate-400">
        <Info size={32} className="mx-auto mb-2 opacity-40" />
        <p className="text-sm">No records found.</p>
      </div>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100">
            {columns.map(c => (
              <th key={c.key} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr
              key={i}
              onClick={() => onRowClick?.(row)}
              className={`border-b border-slate-50 hover:bg-blue-50/50 transition-colors ${onRowClick ? 'cursor-pointer' : ''}`}
            >
              {columns.map(c => (
                <td key={c.key} className="px-4 py-3 text-slate-700 whitespace-nowrap">
                  {c.render ? c.render(row) : row[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Back to Dashboard
export function BackToDashboard() {
  return (
    <Link
      to="/app/dashboard"
      className="inline-flex items-center gap-1.5 mb-2 -ml-2 px-2 py-1 rounded-lg text-sm font-medium text-[#2563EB] hover:text-[#080677] hover:bg-blue-50 transition-colors focus:outline-none focus:ring-2 focus:ring-[#080677] focus:ring-offset-1"
    >
      <ArrowLeft size={16} className="shrink-0" />
      Back to Dashboard
    </Link>
  );
}

// Page Header
export function PageHeader({ title, subtitle, action, backToDashboard = false }: {
  title: string; subtitle?: string; action?: ReactNode; backToDashboard?: boolean;
}) {
  return (
    <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
      <div>
        {backToDashboard && <BackToDashboard />}
        <h1 className="text-xl font-bold text-[#080677]">{title}</h1>
        {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

// Confirm Dialog
export function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel = 'Confirm', confirmVariant = 'danger' }: {
  open: boolean; onClose: () => void; onConfirm: () => void; title: string; message: string;
  confirmLabel?: string; confirmVariant?: BtnVariant;
}) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <p className="text-sm text-slate-600 mb-6">{message}</p>
      <div className="flex gap-3 justify-end">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button variant={confirmVariant} onClick={() => { onConfirm(); onClose(); }}>{confirmLabel}</Button>
      </div>
    </Modal>
  );
}

// Tabs
export function Tabs({ tabs, active, onChange }: { tabs: string[]; active: string; onChange: (t: string) => void }) {
  // A single tab is just a duplicate of the page title, so don't render it.
  if (tabs.length < 2) return null;
  return (
    <div className="flex gap-1 border-b border-slate-200 mb-6 flex-wrap">
      {tabs.map(t => (
        <button
          key={t}
          onClick={() => onChange(t)}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${
            active === t ? 'border-[#2563EB] text-[#2563EB]' : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          {t}
        </button>
      ))}
    </div>
  );
}

// Search + Filter bar
export function SearchBar({ value, onChange, placeholder = 'Search...', children }: {
  value: string; onChange: (v: string) => void; placeholder?: string; children?: ReactNode;
}) {
  return (
    <div className="flex gap-3 flex-wrap mb-5">
      <div className="relative flex-1 min-w-[200px]">
        <input
          type="search"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB] bg-white"
        />
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
      </div>
      {children}
    </div>
  );
}

// Toggle Switch
export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative w-10 h-5 rounded-full transition-colors ${checked ? 'bg-[#080677]' : 'bg-slate-300'}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-5' : ''}`} />
      </button>
      {label && <span className="text-sm text-slate-600">{label}</span>}
    </label>
  );
}

// Empty state
export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center mb-4">
        <Info size={28} className="text-blue-300" />
      </div>
      <h3 className="font-semibold text-slate-600 mb-1">{title}</h3>
      {description && <p className="text-sm text-slate-400 max-w-sm">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// Loading spinner
export function Spinner({ size = 24 }: { size?: number }) {
  return (
    <svg className="animate-spin text-[#2563EB]" width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

// Pagination
export function Pagination({ page, total, perPage, onChange }: { page: number; total: number; perPage: number; onChange: (p: number) => void }) {
  const pages = Math.ceil(total / perPage);
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-between mt-4 px-4 py-3 border-t border-slate-100">
      <p className="text-xs text-slate-500">Showing {Math.min((page - 1) * perPage + 1, total)}–{Math.min(page * perPage, total)} of {total}</p>
      <div className="flex gap-1">
        {Array.from({ length: pages }, (_, i) => i + 1).map(p => (
          <button key={p} onClick={() => onChange(p)}
            className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${p === page ? 'bg-[#080677] text-white' : 'text-slate-500 hover:bg-blue-50'}`}>
            {p}
          </button>
        ))}
      </div>
    </div>
  );
}
