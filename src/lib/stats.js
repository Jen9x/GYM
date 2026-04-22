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

  const { data: payments, error: paymentsError } = await supabase
    .from('payments')
    .select('amount')
    .gte('payment_date', startDate)
    .lte('payment_date', toLocalISODate(now));

  if (paymentsError) throw paymentsError;

  const totalCollected = (payments || []).reduce((sum, payment) => sum + payment.amount, 0);

  const { count: newMembers, error: newMembersError } = await supabase
    .from('members')
    .select('*', { count: 'exact', head: true })
    .gte('start_date', startDate)
    .lte('start_date', toLocalISODate(now));

  if (newMembersError) throw newMembersError;

  const allMembers = await getMembers();
  const unpaidBalances = allMembers
    .filter((member) => member.computed_membership_status === 'active')
    .reduce((sum, member) => sum + (member.balance || 0), 0);

  const { count: totalPayments, error: totalPaymentsError } = await supabase
    .from('payments')
    .select('*', { count: 'exact', head: true })
    .gte('payment_date', startDate)
    .lte('payment_date', toLocalISODate(now));

  if (totalPaymentsError) throw totalPaymentsError;

  return {
    totalCollected,
    newMembers: newMembers || 0,
    totalPayments: totalPayments || 0,
    unpaidBalances,
  };
}

export async function getMemberGrowth(months = 12) {
  const data = {};
  const ndNow = new NepaliDate(new Date());

  for (let i = months - 1; i >= 0; i -= 1) {
    let year = ndNow.getYear();
    let month = ndNow.getMonth() - i;

    while (month < 0) {
      month += 12;
      year -= 1;
    }

    const ndStart = new NepaliDate(year, month, 1);
    let nextYear = year;
    let nextMonth = month + 1;

    if (nextMonth > 11) {
      nextMonth = 0;
      nextYear += 1;
    }

    const ndNext = new NepaliDate(nextYear, nextMonth, 1);
    const key = ndStart.format('MMMM YYYY');

    const { count, error } = await supabase
      .from('members')
      .select('*', { count: 'exact', head: true })
      .gte('start_date', toLocalISODate(ndStart.toJsDate()))
      .lt('start_date', toLocalISODate(ndNext.toJsDate()));

    if (error) throw error;
    data[key] = count || 0;
  }

  return data;
}

export async function getRevenueOverview(months = 12) {
  const data = {};
  const ndNow = new NepaliDate(new Date());

  for (let i = months - 1; i >= 0; i -= 1) {
    let year = ndNow.getYear();
    let month = ndNow.getMonth() - i;

    while (month < 0) {
      month += 12;
      year -= 1;
    }

    const ndStart = new NepaliDate(year, month, 1);
    let nextYear = year;
    let nextMonth = month + 1;

    if (nextMonth > 11) {
      nextMonth = 0;
      nextYear += 1;
    }

    const ndNext = new NepaliDate(nextYear, nextMonth, 1);
    const key = ndStart.format('MMMM YYYY');

    const { data: payments, error } = await supabase
      .from('payments')
      .select('amount')
      .gte('payment_date', toLocalISODate(ndStart.toJsDate()))
      .lt('payment_date', toLocalISODate(ndNext.toJsDate()));

    if (error) throw error;
    data[key] = (payments || []).reduce((sum, payment) => sum + payment.amount, 0);
  }

  return data;
}
