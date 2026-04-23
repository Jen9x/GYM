import NepaliDate from 'nepali-date-converter';
import { toLocalISODate } from './nepali-date';

export function getReportRangeConfig(range = 'year') {
  const ndNow = new NepaliDate(new Date());
  let year = ndNow.getYear();
  let month = ndNow.getMonth();
  let months = 12;
  let startDate = null;

  switch (range) {
    case 'alltime':
      return {
        months: null,
        startDate: null,
      };
    case 'month':
      months = 1;
      break;
    case '3months':
      month -= 2;
      months = 3;
      break;
    case '6months':
      month -= 5;
      months = 6;
      break;
    case 'year':
    default:
      month = 0;
      months = 12;
      break;
  }

  while (month < 0) {
    month += 12;
    year -= 1;
  }

  const start = new NepaliDate(year, month, 1);
  startDate = toLocalISODate(start.toJsDate());

  return {
    months,
    startDate,
  };
}
