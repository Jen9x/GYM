import NepaliDate from 'nepali-date-converter';
import { supabase } from './supabase';
import { getMembers } from './members';
import { parseAppDate, startOfLocalDay, toLocalISODate } from './nepali-date';
import { getReportRangeConfig } from './report-range';

function isDateWithinRange(value, startDate, endDate) {
  const current = startOfLocalDay(value);
  const start = startOfLocalDay(startDate);
  const end = startOfLocalDay(endDate);

  if (!current || !start) return false;
  if (current < start) return false;
  if (end && current > end) return false;

  return true;
}

function buildMonthlyPeriodsFromStart(startValue) {
  const startDate = parseAppDate(startValue);
  if (!startDate) return [];

  const ndStart = new NepaliDate(startDate);
  const ndNow = new NepaliDate(new Date());
  const periods = [];
  let year = ndStart.getYear();
  let month = ndStart.getMonth();

  while (year < ndNow.getYear() || (year === ndNow.getYear() && month <= ndNow.getMonth())) {
    const ndPeriodStart = new NepaliDate(year, month, 1);
    let nextYear = year;
    let nextMonth = month + 1;

    if (nextMonth > 11) {
      nextMonth = 0;
      nextYear += 1;
    }

    periods.push({
      key: ndPeriodStart.format('MMMM YYYY'),
      startDate: toLocalISODate(ndPeriodStart.toJsDate()),
      endDate: toLocalISODate(new NepaliDate(nextYear, nextMonth, 1).toJsDate()),
    });

    year = nextYear;
    month = nextMonth;
  }

  return periods;
}

function buildMonthlyPeriods(rangeOrMonths = 'year') {
  const ndNow = new NepaliDate(new Date());
  let startYear = ndNow.getYear();
  let startMonth = ndNow.getMonth();
  let periodCount = 12;

  if (typeof rangeOrMonths === 'string') {
    switch (rangeOrMonths) {
      case 'month':
        periodCount = 1;
        break;
      case '3months':
        startMonth -= 2;
        periodCount = 3;
        break;
      case '6months':
        startMonth -= 5;
        periodCount = 6;
        break;
      case 'year':
      default:
        startMonth = 0;
        periodCount = ndNow.getMonth() + 1;
        break;
    }
  } else {
    periodCount = Math.max(1, Number(rangeOrMonths) || 1);
    startMonth -= periodCount - 1;
  }

  while (startMonth < 0) {
    startMonth += 12;
    startYear -= 1;
  }

  return Array.from({ length: periodCount }, (_, index) => {
    let year = startYear;
    let month = startMonth + index;

    while (month > 11) {
      month -= 12;
      year += 1;
    }

    const ndStart = new NepaliDate(year, month, 1);
    let nextYear = year;
    let nextMonth = month + 1;

    if (nextMonth > 11) {
      nextMonth = 0;
      nextYear += 1;
    }

    return {
      key: ndStart.format('MMMM YYYY'),
      startDate: toLocalISODate(ndStart.toJsDate()),
      endDate: toLocalISODate(new NepaliDate(nextYear, nextMonth, 1).toJsDate()),
    };
  });
}

async function getEarliestDatedRecord(table, column) {
  const { data, error } = await supabase
    .from(table)
    .select(column)
    .not(column, 'is', null)
    .order(column, { ascending: true })
    .limit(1);

  if (error) throw error;
  return data?.[0]?.[column] || null;
}

async function resolveMonthlyPeriods(rangeOrMonths, source) {
  if (rangeOrMonths !== 'alltime') {
    return buildMonthlyPeriods(rangeOrMonths);
  }

  const earliestDate = source === 'members'
    ? await getEarliestDatedRecord('members', 'start_date')
    : await getEarliestDatedRecord('payments', 'payment_date');

  return buildMonthlyPeriodsFromStart(earliestDate);
}

export async function getDashboardStats() {
  const now = new Date();
  const today = startOfLocalDay(now);
  const todayStr = toLocalISODate(now);

  const ndNow = new NepaliDate(now);
  const ndFirst = new NepaliDate(ndNow.getYear(), ndNow.getMonth(), 1);
  const firstDayOfMonth = ndFirst.toJsDate();

  const thirtyDaysFromNow = startOfLocalDay(now);
  thirtyDaysFromNow?.setDate(thirtyDaysFromNow.getDate() + 30);

  const sevenDaysFromNow = startOfLocalDay(now);
  sevenDaysFromNow?.setDate(sevenDaysFromNow.getDate() + 7);

  const allMembers = await getMembers();
  const activeMembers = allMembers.filter((member) => member.computed_membership_status === 'active');
  const newThisMonth = allMembers.filter((member) =>
    isDateWithinRange(member.start_date || member.created_at, firstDayOfMonth, today)
  ).length;
  const expiringSoon = activeMembers.filter((member) =>
    isDateWithinRange(member.end_date, today, thirtyDaysFromNow)
  ).length;
  const expiringWeek = activeMembers.filter((member) =>
    isDateWithinRange(member.end_date, today, sevenDaysFromNow)
  ).length;

  const { data: monthlyPayments, error: monthlyPaymentsError } = await supabase
    .from('payments')
    .select('amount')
    .gte('payment_date', toLocalISODate(firstDayOfMonth))
    .lte('payment_date', todayStr);

  if (monthlyPaymentsError) throw monthlyPaymentsError;

  const monthlyRevenue = (monthlyPayments || []).reduce((sum, payment) => sum + payment.amount, 0);

  return {
    activeMembers: activeMembers.length,
    totalMembers: allMembers.length,
    newThisMonth,
    monthlyRevenue,
    expiringSoon,
    expiringWeek,
  };
}

export async function getReportStats(range = 'month') {
  const now = new Date();
  const { startDate } = getReportRangeConfig(range);
  const endDate = toLocalISODate(now);

  let paymentsQuery = supabase
    .from('payments')
    .select('amount')
    .lte('payment_date', endDate);

  if (startDate) {
    paymentsQuery = paymentsQuery.gte('payment_date', startDate);
  }

  const { data: payments, error: paymentsError } = await paymentsQuery;

  if (paymentsError) throw paymentsError;

  const totalCollected = (payments || []).reduce((sum, payment) => sum + payment.amount, 0);

  let membersQuery = supabase
    .from('members')
    .select('*', { count: 'exact', head: true })
    .lte('start_date', endDate);

  if (startDate) {
    membersQuery = membersQuery.gte('start_date', startDate);
  }

  const { count: newMembers, error: newMembersError } = await membersQuery;

  if (newMembersError) throw newMembersError;

  const allMembers = await getMembers();
  const unpaidBalances = allMembers.reduce((sum, member) => sum + (Number(member.balance) || 0), 0);

  let paymentsCountQuery = supabase
    .from('payments')
    .select('*', { count: 'exact', head: true })
    .lte('payment_date', endDate);

  if (startDate) {
    paymentsCountQuery = paymentsCountQuery.gte('payment_date', startDate);
  }

  const { count: totalPayments, error: totalPaymentsError } = await paymentsCountQuery;

  if (totalPaymentsError) throw totalPaymentsError;

  return {
    totalCollected,
    newMembers: newMembers || 0,
    totalPayments: totalPayments || 0,
    unpaidBalances,
  };
}

export async function getMemberGrowth(rangeOrMonths = 'year') {
  const periods = await resolveMonthlyPeriods(rangeOrMonths, 'members');

  if (periods.length === 0) {
    return {};
  }

  const results = await Promise.all(periods.map(async (period) => {
    const { count, error } = await supabase
      .from('members')
      .select('*', { count: 'exact', head: true })
      .gte('start_date', period.startDate)
      .lt('start_date', period.endDate);

    if (error) throw error;
    return [period.key, count || 0];
  }));

  return Object.fromEntries(results);
}

export async function getRevenueOverview(rangeOrMonths = 'year') {
  const periods = await resolveMonthlyPeriods(rangeOrMonths, 'payments');

  if (periods.length === 0) {
    return {};
  }

  const results = await Promise.all(periods.map(async (period) => {
    const { data: payments, error } = await supabase
      .from('payments')
      .select('amount')
      .gte('payment_date', period.startDate)
      .lt('payment_date', period.endDate);

    if (error) throw error;
    const total = (payments || []).reduce((sum, payment) => sum + payment.amount, 0);
    return [period.key, total];
  }));

  return Object.fromEntries(results);
}
