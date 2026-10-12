import React, { useState, ReactNode } from 'react';
import { ParkingSquare } from 'lucide-react';
import { BRAND } from '../config/branding';

/** <img> that walks through a list of sources and calls onFail when all fail. */
function FallbackImg({ srcs, alt, className, onFail }: { srcs: readonly string[]; alt: string; className?: string; onFail: () => void }) {
  const [i, setI] = useState(0);
  return (
    <img
      src={srcs[i]}
      alt={alt}
      className={className}
      referrerPolicy="no-referrer"
      onError={() => (i + 1 < srcs.length ? setI(i + 1) : onFail())}
    />
  );
}

/** Official DYCI logo. Proportions are preserved (height-driven, width auto). */
export function DyciLogo({ onDark = false, className = 'h-9' }: { onDark?: boolean; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <span className={`inline-flex items-center font-bold tracking-wide ${onDark ? 'text-white' : 'text-[#080677]'}`}>
        {BRAND.institutionShort}
      </span>
    );
  }
  return (
    <FallbackImg
      srcs={onDark ? BRAND.logoWhite : BRAND.logoColor}
      alt={BRAND.institution}
      className={`${className} w-auto object-contain`}
      onFail={() => setFailed(true)}
    />
  );
}

/** PASS product mark, deliberately distinct from the institutional logo. */
export function PassMark({ onDark = false, size = 'md', subtitle = true }: { onDark?: boolean; size?: 'sm' | 'md' | 'lg' | 'xl'; subtitle?: boolean }) {
  // Official PASS logo supplied by the project owner. Keep its original proportions.
  // In compact sidebar mode, use a smaller mark; elsewhere show the full logo.
  const dimensions = size === 'xl' ? 'w-36' : size === 'lg' ? 'w-28' : size === 'sm' && !subtitle ? 'w-12' : 'w-24';
  return (
    <img
      src="/branding/pass-logo.png"
      alt="PASS — Parking Access and Space Management System"
      className={`${dimensions} h-auto object-contain shrink-0 rounded-md ${onDark ? 'bg-white' : ''}`}
    />
  );
}

/** DYCI logo + divider + PASS mark. Use in headers. */
export function BrandLockup({ onDark = false, compact = false }: { onDark?: boolean; compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <DyciLogo onDark={onDark} className={compact ? 'h-7' : 'h-9'} />
      <span className={`h-7 w-px ${onDark ? 'bg-white/25' : 'bg-slate-200'}`} />
      <PassMark onDark={onDark} size="sm" subtitle={false} />
    </div>
  );
}

/** Campus photo with a navy overlay; falls back to solid navy if the image is unavailable. */
export function CampusPhoto({ className = '', children }: { className?: string; children?: ReactNode }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className={`relative overflow-hidden bg-[#080677] ${className}`}>
      {!failed && (
        <FallbackImg srcs={BRAND.banner} alt="" className="absolute inset-0 w-full h-full object-cover" onFail={() => setFailed(true)} />
      )}
      <div className="absolute inset-0 bg-[#080677]/75" />
      <div className="relative h-full">{children}</div>
    </div>
  );
}

/** Thin gold rule, used sparingly as the only gold accent. */
export function GoldRule({ className = '' }: { className?: string }) {
  return <div className={`h-0.5 w-10 bg-[#D4A72C] ${className}`} />;
}
