import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';

// A real, scannable QR code. The encoded value is the Visitor QR pass code,
// which the gate validates through ParkingAccessService. Rendered locally:
// the code is never sent to a third-party service.

export default function QrCode({ value, size = 240, className = '', label = 'Visitor QR pass code' }: {
  value: string;
  size?: number;
  className?: string;
  label?: string;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    QRCode.toDataURL(value, { errorCorrectionLevel: 'M', margin: 2, width: size * 2, color: { dark: '#080677', light: '#FFFFFF' } })
      .then(url => { if (!cancelled) setSrc(url); })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [value, size]);

  if (failed) return <p className="text-sm text-red-600">The QR code could not be drawn. Use the pass code shown below.</p>;
  if (!src) return <div className={`bg-slate-100 animate-pulse rounded-xl ${className}`} style={{ width: size, height: size }} aria-label="Drawing QR code" />;

  return <img src={src} width={size} height={size} alt={label} className={`rounded-xl bg-white ${className}`} style={{ imageRendering: 'pixelated' }} />;
}
