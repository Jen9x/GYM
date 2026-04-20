import NepaliDate from 'nepali-date-converter';

export const NEPALI_MONTHS = [
  'Baisakh', 'Jestha', 'Ashadh', 'Shrawan', 'Bhadra', 'Ashwin',
  'Kartik', 'Mangsir', 'Poush', 'Magh', 'Falgun', 'Chaitra'
];

export const NEPALI_MONTHS_SHORT = [
  'Bai', 'Jes', 'Ash', 'Shr', 'Bha', 'Asw',
  'Kar', 'Man', 'Pou', 'Mag', 'Fal', 'Cha'
];

/**
 * Convert AD (Gregorian) date to BS (Bikram Sambat) date payload
 * @param {Date|string} adDate - Gregorian date
 * @returns {{ year: number, month: number, day: number }} BS date (month is 0-indexed)
 */
export function adToBS(adDate) {
  const date = typeof adDate === 'string' ? new Date(adDate) : adDate;
  if (isNaN(date.getTime())) return null;
  
  const nd = new NepaliDate(date);
  return { year: nd.getYear(), month: nd.getMonth(), day: nd.getDate() };
}

/**
 * Format a Gregorian date as a Nepali BS date string
 * @param {Date|string} adDate - Gregorian date
 * @param {'short'|'long'|'numeric'} formatStr - Output format
 * @returns {string} Formatted BS date
 */
export function formatNepaliDate(adDate, formatStr = 'short') {
  if (!adDate) return '—';
  const date = typeof adDate === 'string' ? new Date(adDate) : adDate;
  if (isNaN(date.getTime())) return '—';

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
}

/**
 * Get the Nepali month name for a given Gregorian date
 * @param {Date|string} adDate
 * @returns {string} Nepali month name
 */
export function getNepaliMonthName(adDate) {
  const date = typeof adDate === 'string' ? new Date(adDate) : adDate;
  if (isNaN(date.getTime())) return '';
  const nd = new NepaliDate(date);
  return NEPALI_MONTHS[nd.getMonth()];
}

/**
 * Get Nepali month + year label (e.g. "Baisakh 2081")
 * @param {Date|string} adDate
 * @returns {string}
 */
export function getNepaliMonthYear(adDate) {
  const date = typeof adDate === 'string' ? new Date(adDate) : adDate;
  if (isNaN(date.getTime())) return '';
  const nd = new NepaliDate(date);
  return `${NEPALI_MONTHS[nd.getMonth()]} ${nd.getYear()}`;
}

/**
 * Get current BS date breakdown
 * @returns {{ year: number, month: number, day: number }}
 */
export function getCurrentBSDate() {
  const nd = new NepaliDate();
  return { year: nd.getYear(), month: nd.getMonth(), day: nd.getDate() };
}
