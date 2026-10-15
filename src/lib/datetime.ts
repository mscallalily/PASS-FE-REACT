// The API stores and sends UTC times (ISO strings with an offset). PASS shows
// them in campus time, whatever timezone the viewer's device is set to.

export const CAMPUS_TIMEZONE = 'Asia/Manila';

const DATE_TIME: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' };
const DATE_ONLY: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };

/** Date and time in campus time, e.g. "Oct 15, 2026, 7:30 AM". */
export function formatCampusDateTime(iso: string | null | undefined, options: Intl.DateTimeFormatOptions = DATE_TIME) {
  if (!iso) return '—';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('en-PH', { ...options, timeZone: CAMPUS_TIMEZONE });
}

/** Calendar date of a moment in campus time, e.g. "Oct 15, 2026". */
export function formatCampusDate(iso: string | null | undefined, options: Intl.DateTimeFormatOptions = DATE_ONLY) {
  return formatCampusDateTime(iso, options);
}
