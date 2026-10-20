import { DeliveryTrackingStatus } from '../types';

export interface FormattedEventDateTime {
  date: string;
  time: string;
  full: string;
}

const FALLBACK_RESULT: FormattedEventDateTime = {
  date: 'Date/time unavailable',
  time: '—',
  full: 'Date/time unavailable',
};

function isValidDateObject(d: any): d is Date {
  return d instanceof Date && !isNaN(d.getTime());
}

function sanitizeDateInput(val: any): string | null {
  if (val === null || val === undefined) return null;
  const s = String(val).trim();
  if (
    s === '' ||
    s.toLowerCase() === 'null' ||
    s.toLowerCase() === 'undefined' ||
    s.toLowerCase() === 'none' ||
    s.toLowerCase() === 'nan' ||
    s.toLowerCase().includes('invalid date') ||
    s.toLowerCase().includes('unavailable') ||
    s === '—' ||
    s === '-'
  ) {
    return null;
  }
  return s;
}

export const PORTIDE_TIMEZONE = 'Asia/Kolkata';

/**
 * Robust date/time formatting utility for tracking events.
 * Handles ISO-8601 strings, timezone offsets, and backend formatted dates safely.
 * Eliminates 'Invalid Date', 'undefined', and 'NaN' bugs completely.
 * Format standard: "07 Oct 2026, 12:17 AM" in Asia/Kolkata (IST).
 */
export function formatTrackingDateTime(
  rawTimestamp?: string | number | Date | null,
  formattedFallback?: string | null
): FormattedEventDateTime {
  const cleanedRaw = sanitizeDateInput(rawTimestamp);
  const cleanedFallback = sanitizeDateInput(formattedFallback);

  if (!cleanedRaw && !cleanedFallback) {
    return { ...FALLBACK_RESULT };
  }

  // 1. Attempt parsing rawTimestamp in Asia/Kolkata timezone
  if (cleanedRaw) {
    let parsed: Date | null = null;
    if (rawTimestamp instanceof Date && isValidDateObject(rawTimestamp)) {
      parsed = rawTimestamp;
    } else {
      const d = new Date(cleanedRaw);
      if (isValidDateObject(d)) {
        parsed = d;
      }
    }

    if (parsed) {
      try {
        const day = parsed.toLocaleDateString('en-GB', { day: '2-digit', timeZone: PORTIDE_TIMEZONE });
        const month = parsed.toLocaleDateString('en-GB', { month: 'short', timeZone: PORTIDE_TIMEZONE });
        const year = parsed.toLocaleDateString('en-GB', { year: 'numeric', timeZone: PORTIDE_TIMEZONE });
        const rawTime = parsed.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
          timeZone: PORTIDE_TIMEZONE,
        });
        const time = rawTime.toUpperCase();

        const dateStr = `${day} ${month} ${year}`;
        if (
          !dateStr.toLowerCase().includes('invalid') &&
          !time.toLowerCase().includes('invalid') &&
          !dateStr.toLowerCase().includes('nan') &&
          !time.toLowerCase().includes('nan')
        ) {
          return {
            date: dateStr,
            time: time,
            full: `${dateStr}, ${time}`,
          };
        }
      } catch {
        // Fall through to fallback handler
      }
    }
  }

  // 2. Attempt using pre-formatted string (e.g. "07 Oct 2026, 12:17 AM" or "5 Oct 2026, 7:13 PM")
  if (cleanedFallback) {
    const regexMatch = cleanedFallback.match(
      /^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})(?:,\s*|\s*[•·-]\s*|\s+)(\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM|am|pm)?)$/i
    );
    if (regexMatch) {
      const day = regexMatch[1].padStart(2, '0');
      const month = regexMatch[2].slice(0, 3);
      const year = regexMatch[3];
      const time = regexMatch[4].trim().toUpperCase();
      const dateStr = `${day} ${month} ${year}`;
      return {
        date: dateStr,
        time: time,
        full: `${dateStr}, ${time}`,
      };
    }

    const dFromFallback = new Date(cleanedFallback);
    if (isValidDateObject(dFromFallback)) {
      try {
        const day = dFromFallback.toLocaleDateString('en-GB', { day: '2-digit', timeZone: PORTIDE_TIMEZONE });
        const month = dFromFallback.toLocaleDateString('en-GB', { month: 'short', timeZone: PORTIDE_TIMEZONE });
        const year = dFromFallback.toLocaleDateString('en-GB', { year: 'numeric', timeZone: PORTIDE_TIMEZONE });
        const time = dFromFallback.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
          timeZone: PORTIDE_TIMEZONE,
        }).toUpperCase();

        const dateStr = `${day} ${month} ${year}`;
        if (!dateStr.toLowerCase().includes('invalid') && !time.toLowerCase().includes('invalid')) {
          return {
            date: dateStr,
            time: time,
            full: `${dateStr}, ${time}`,
          };
        }
      } catch {
        // Continue
      }
    }

    const parts = cleanedFallback.split(', ');
    if (parts.length >= 2) {
      const pDate = parts[0].trim();
      const pTime = parts.slice(1).join(', ').trim();
      if (!pDate.toLowerCase().includes('invalid') && !pTime.toLowerCase().includes('invalid')) {
        return {
          date: pDate,
          time: pTime,
          full: `${pDate}, ${pTime}`,
        };
      }
    }

    if (!cleanedFallback.toLowerCase().includes('invalid')) {
      return {
        date: cleanedFallback,
        time: '—',
        full: cleanedFallback,
      };
    }
  }

  return { ...FALLBACK_RESULT };
}

export interface StatusMeta {
  title: string;
  defaultDescription: string;
  badgeClass: string;
  iconBg: string;
  textColor: string;
}

/**
 * Centralized human-readable status configuration for PORTIDE tracking events.
 */
export function getTrackingStatusMeta(statusKey?: string): StatusMeta {
  const norm = (statusKey || '').trim().toUpperCase();

  switch (norm) {
    case 'RELEASED':
      return {
        title: 'Gate Exit Completed / Released',
        defaultDescription: 'Container completed gate release and officially released for inland delivery tracking.',
        badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
        iconBg: 'bg-emerald-100 text-emerald-700 border-emerald-200',
        textColor: 'text-emerald-700',
      };
    case 'GATE_PASS_GENERATED':
      return {
        title: 'Gate Pass Generated',
        defaultDescription: 'Digital Gate Pass generated and assigned for authorized truck pickup.',
        badgeClass: 'bg-teal-100 text-teal-800 border-teal-300',
        iconBg: 'bg-teal-100 text-teal-700 border-teal-200',
        textColor: 'text-teal-700',
      };
    case 'PICKED_UP':
      return {
        title: 'Picked Up',
        defaultDescription: 'Container verified and picked up by assigned transport vehicle.',
        badgeClass: 'bg-sky-100 text-sky-800 border-sky-300',
        iconBg: 'bg-sky-100 text-sky-700 border-sky-200',
        textColor: 'text-sky-700',
      };
    case 'DEPARTED_PORT':
    case 'DEPARTED':
      return {
        title: 'Departed Port',
        defaultDescription: 'Transport vehicle departed port terminal boundary for inland destination.',
        badgeClass: 'bg-indigo-100 text-indigo-800 border-indigo-300',
        iconBg: 'bg-indigo-100 text-indigo-700 border-indigo-200',
        textColor: 'text-indigo-700',
      };
    case 'IN_TRANSIT':
      return {
        title: 'In Transit',
        defaultDescription: 'Container in active transit along inland highway / rail distribution corridor.',
        badgeClass: 'bg-blue-100 text-blue-800 border-blue-300',
        iconBg: 'bg-blue-100 text-blue-700 border-blue-200',
        textColor: 'text-blue-700',
      };
    case 'OUT_FOR_DELIVERY':
      return {
        title: 'Out for Delivery',
        defaultDescription: 'Container dispatched from regional hub on final delivery approach to destination.',
        badgeClass: 'bg-amber-100 text-amber-900 border-amber-300 font-extrabold',
        iconBg: 'bg-amber-100 text-amber-900 border-amber-200',
        textColor: 'text-amber-800',
      };
    case 'DELIVERED':
      return {
        title: 'Delivered',
        defaultDescription: 'Container safely delivered to recipient consignee and delivery receipt recorded.',
        badgeClass: 'bg-emerald-100 text-emerald-900 border-emerald-400 font-bold',
        iconBg: 'bg-emerald-100 text-emerald-800 border-emerald-300',
        textColor: 'text-emerald-800',
      };
    case 'DELIVERY_EXCEPTION':
    case 'EXCEPTION':
      return {
        title: 'Delivery Exception',
        defaultDescription: 'Operational delivery incident recorded. Remediation in progress.',
        badgeClass: 'bg-rose-100 text-rose-900 border-rose-300 font-bold',
        iconBg: 'bg-rose-100 text-rose-700 border-rose-200',
        textColor: 'text-rose-700',
      };
    default:
      return {
        title: norm ? norm.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : 'Status Updated',
        defaultDescription: 'Operational milestone recorded in platform registry.',
        badgeClass: 'bg-slate-100 text-slate-800 border-slate-300',
        iconBg: 'bg-slate-100 text-slate-700 border-slate-200',
        textColor: 'text-slate-700',
      };
  }
}

/**
 * Format expected or final delivery date and time in the PORTIDE tracking style:
 * Example: "05 Oct 2026 • 08:00 PM"
 * Returns null if no valid date/time is available.
 */
export function formatDeliveryScheduleDateTime(
  rawTimestamp?: string | number | Date | null,
  formattedFallback?: string | null
): string | null {
  if (!rawTimestamp && !formattedFallback) return null;
  const res = formatTrackingDateTime(rawTimestamp, formattedFallback);
  if (
    !res.date ||
    res.date === 'Date/time unavailable' ||
    res.date.toLowerCase().includes('unavailable') ||
    res.date.toLowerCase().includes('invalid')
  ) {
    return null;
  }
  if (res.time && res.time !== '—') {
    return `${res.date}, ${res.time}`;
  }
  return res.date;
}

