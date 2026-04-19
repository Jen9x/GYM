// Bikram Sambat (BS) / Nepali Calendar Utility
// Covers BS years 2070–2090 (approx. AD 2013–2034)

const BS_CALENDAR_DATA = {
  2070: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2071: [31, 31, 32, 31, 32, 30, 30, 29, 30, 29, 30, 30],
  2072: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  2073: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2074: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  2075: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  2076: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2077: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2078: [31, 31, 32, 31, 32, 30, 30, 29, 30, 29, 30, 30],
  2079: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  2080: [31, 31, 32, 32, 31, 31, 30, 29, 30, 29, 30, 30],
  2081: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  2082: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  2083: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  2084: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  2085: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2086: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  2087: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  2088: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2089: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2090: [31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
};

// Reference point: BS 2070/01/01 = AD 2013/04/14
const BS_REF_YEAR = 2070;
const AD_REF = new Date(2013, 3, 14); // April 14, 2013

export const NEPALI_MONTHS = [
  'Baishakh',   // बैशाख
  'Jestha',     // जेष्ठ
  'Ashadh',     // आषाढ
  'Shrawan',    // श्रावण
  'Bhadra',     // भाद्र
  'Ashwin',     // आश्विन
  'Kartik',     // कार्तिक
  'Mangsir',    // मंसिर
  'Poush',      // पौष
  'Magh',       // माघ
  'Falgun',     // फाल्गुन
  'Chaitra',    // चैत्र
];

export const NEPALI_MONTHS_SHORT = [
  'Bai', 'Jes', 'Ash', 'Shr', 'Bha', 'Asw',
  'Kar', 'Man', 'Pou', 'Mag', 'Fal', 'Cha',
];

/**
 * Convert AD (Gregorian) date to BS (Bikram Sambat) date
 * @param {Date|string} adDate - Gregorian date
 * @returns {{ year: number, month: number, day: number }} BS date (month is 0-indexed)
 */
export function adToBS(adDate) {
  const date = typeof adDate === 'string' ? new Date(adDate) : adDate;
  if (isNaN(date.getTime())) return null;

  // Calculate total days from reference
  const diffTime = date.getTime() - AD_REF.getTime();
  let totalDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  let bsYear = BS_REF_YEAR;
  let bsMonth = 0;
  let bsDay = 1;

  // If date is before reference, return approximate
  if (totalDays < 0) {
    return { year: bsYear, month: 0, day: 1 };
  }

  // Walk through BS years and months
  while (totalDays > 0) {
    const yearData = BS_CALENDAR_DATA[bsYear];
    if (!yearData) {
      // Beyond our data range — use approximate
      break;
    }

    const daysInMonth = yearData[bsMonth];
    if (totalDays < daysInMonth) {
      bsDay = totalDays + 1;
      totalDays = 0;
    } else {
      totalDays -= daysInMonth;
      bsMonth++;
      if (bsMonth >= 12) {
        bsMonth = 0;
        bsYear++;
      }
    }
  }

  return { year: bsYear, month: bsMonth, day: bsDay };
}

/**
 * Format a Gregorian date as a Nepali BS date string
 * @param {Date|string} adDate - Gregorian date
 * @param {'short'|'long'|'numeric'} format - Output format
 * @returns {string} Formatted BS date
 */
export function formatNepaliDate(adDate, format = 'short') {
  if (!adDate) return '—';

  const bs = adToBS(adDate);
  if (!bs) return '—';

  switch (format) {
    case 'long':
      return `${bs.day} ${NEPALI_MONTHS[bs.month]} ${bs.year}`;
    case 'numeric':
      return `${bs.year}/${String(bs.month + 1).padStart(2, '0')}/${String(bs.day).padStart(2, '0')}`;
    case 'short':
    default:
      return `${NEPALI_MONTHS_SHORT[bs.month]} ${bs.day}, ${bs.year}`;
  }
}

/**
 * Get the Nepali month name for a given Gregorian date
 * @param {Date|string} adDate
 * @returns {string} Nepali month name
 */
export function getNepaliMonthName(adDate) {
  const bs = adToBS(adDate);
  if (!bs) return '';
  return NEPALI_MONTHS[bs.month];
}

/**
 * Get Nepali month + year label (e.g. "Baishakh 2081")
 * @param {Date|string} adDate
 * @returns {string}
 */
export function getNepaliMonthYear(adDate) {
  const bs = adToBS(adDate);
  if (!bs) return '';
  return `${NEPALI_MONTHS[bs.month]} ${bs.year}`;
}

/**
 * Get current BS date
 * @returns {{ year: number, month: number, day: number }}
 */
export function getCurrentBSDate() {
  return adToBS(new Date());
}
