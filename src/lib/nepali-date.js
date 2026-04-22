import NepaliDate from 'nepali-date-converter';

export const NEPALI_MONTHS = [
  'Baisakh', 'Jestha', 'Ashadh', 'Shrawan', 'Bhadra', 'Ashwin',
  'Kartik', 'Mangsir', 'Poush', 'Magh', 'Falgun', 'Chaitra'
];

export const NEPALI_MONTHS_SHORT = [
  'Bai', 'Jes', 'Ash', 'Shr', 'Bha', 'Asw',
  'Kar', 'Man', 'Pou', 'Mag', 'Fal', 'Cha'
];

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const EMPTY_DATE_LABEL = '-';
const BS_DATE_PATTERN = /^(\d{4})-(\d{1,2})-(\d{1,2})$/;
const DEVANAGARI_DIGIT_MAP = {
  '\u0966': '0',
  '\u0967': '1',
  '\u0968': '2',
  '\u0969': '3',
  '\u096A': '4',
  '\u096B': '5',
  '\u096C': '6',
  '\u096D': '7',
  '\u096E': '8',
  '\u096F': '9',
};

export function parseAppDate(value) {
  if (!value) return null;

  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : new Date(value);
  }

  if (typeof value === 'string' && DATE_ONLY_PATTERN.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return isNaN(date.getTime()) ? null : date;
  }

  const date = new Date(value);
  return isNaN(date.getTime()) ? null : date;
}

export function startOfLocalDay(value) {
  const date = parseAppDate(value);
  if (!date) return null;

  date.setHours(0, 0, 0, 0);
  return date;
}

export function toLocalISODate(value) {
  const date = parseAppDate(value);
  if (!date) return '';

  const localDate = new Date(date);
  localDate.setMinutes(localDate.getMinutes() - localDate.getTimezoneOffset());
  return localDate.toISOString().split('T')[0];
}

export function normalizeBsDateInput(value) {
  if (!value) return '';

  return String(value)
    .trim()
    .replace(/[\u0966-\u096F]/g, (digit) => DEVANAGARI_DIGIT_MAP[digit] || digit)
    .replace(/\//g, '-')
    .replace(/\s+/g, '');
}

export function parseBsDate(value) {
  const normalized = normalizeBsDateInput(value);
  const match = normalized.match(BS_DATE_PATTERN);

  if (!match) return null;

  const [, yearStr, monthStr, dayStr] = match;
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);

  if (!year || !month || !day) return null;

  try {
    return new NepaliDate(year, month - 1, day);
  } catch {
    return null;
  }
}

export function formatBsDate(value) {
  if (!value) return '';

  if (typeof value === 'string') {
    const bsDate = parseBsDate(value);
    if (bsDate) {
      return bsDate.format('YYYY-MM-DD', 'en');
    }
  }

  const date = parseAppDate(value);
  if (!date) return '';

  try {
    return new NepaliDate(date).format('YYYY-MM-DD', 'en');
  } catch {
    return '';
  }
}

export function addBsMonths(value, months) {
  const bsDate = parseBsDate(value);
  if (!bsDate) return '';

  try {
    const nextDate = new NepaliDate(bsDate.getYear(), bsDate.getMonth(), bsDate.getDate());
    nextDate.setMonth(nextDate.getMonth() + (Number(months) || 0));
    return nextDate.format('YYYY-MM-DD', 'en');
  } catch {
    return '';
  }
}

export function bsDateToAdIso(value) {
  const bsDate = parseBsDate(value);
  if (!bsDate) return '';

  return toLocalISODate(bsDate.toJsDate());
}

/**
 * Convert AD (Gregorian) date to BS (Bikram Sambat) date payload
 * @param {Date|string} adDate - Gregorian date
 * @returns {{ year: number, month: number, day: number }} BS date (month is 0-indexed)
 */
export function adToBS(adDate) {
  const date = parseAppDate(adDate);
  if (!date) return null;

  try {
    const nd = new NepaliDate(date);
    return { year: nd.getYear(), month: nd.getMonth(), day: nd.getDate() };
  } catch (error) {
    console.warn('Failed to convert AD date to BS:', adDate, error);
    return null;
  }
}

/**
 * Format a Gregorian date as a Nepali BS date string
 * @param {Date|string} adDate - Gregorian date
 * @param {'short'|'long'|'numeric'} formatStr - Output format
 * @returns {string} Formatted BS date
 */
export function formatNepaliDate(adDate, formatStr = 'short') {
  if (!adDate) return EMPTY_DATE_LABEL;

  const date = parseAppDate(adDate);
  if (!date) return EMPTY_DATE_LABEL;

  try {
    const nd = new NepaliDate(date);

    switch (formatStr) {
      case 'long':
        return nd.format('DD MMMM YYYY');
      case 'numeric':
        return nd.format('YYYY/MM/DD');
      case 'short':
      default:
        return `${NEPALI_MONTHS_SHORT[nd.getMonth()]} ${nd.getDate()}, ${nd.getYear()}`;
    }
  } catch (error) {
    console.warn('Failed to format Nepali date:', adDate, error);
    return toLocalISODate(date) || EMPTY_DATE_LABEL;
  }
}

/**
 * Get the Nepali month name for a given Gregorian date
 * @param {Date|string} adDate
 * @returns {string} Nepali month name
 */
export function getNepaliMonthName(adDate) {
  const date = parseAppDate(adDate);
  if (!date) return '';

  try {
    const nd = new NepaliDate(date);
    return NEPALI_MONTHS[nd.getMonth()];
  } catch (error) {
    console.warn('Failed to get Nepali month name:', adDate, error);
    return '';
  }
}

/**
 * Get Nepali month + year label (e.g. "Baisakh 2081")
 * @param {Date|string} adDate
 * @returns {string}
 */
export function getNepaliMonthYear(adDate) {
  const date = parseAppDate(adDate);
  if (!date) return '';

  try {
    const nd = new NepaliDate(date);
    return `${NEPALI_MONTHS[nd.getMonth()]} ${nd.getYear()}`;
  } catch (error) {
    console.warn('Failed to get Nepali month/year:', adDate, error);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      year: 'numeric',
    });
  }
}

/**
 * Get current BS date breakdown
 * @returns {{ year: number, month: number, day: number }}
 */
export function getCurrentBSDate() {
  const nd = new NepaliDate();
  return { year: nd.getYear(), month: nd.getMonth(), day: nd.getDate() };
}
