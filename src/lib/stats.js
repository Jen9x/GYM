import { supabase } from './supabase';
import { getMembers } from './members';
import NepaliDate from 'nepali-date-converter';

// Helper to solve UTC timezone offsets randomly shifting dates by 1 day
const getLocalISODate = (date) => {
  const d = new Date(date);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().split('T')[0];
};

export async function getDashboardStats() {
  const now = new Date();
  const todayStr = getLocalISODate(now);
  
  const ndNow = new NepaliDate(now);
  const ndFirst = new NepaliDate(ndNow.getYear(), ndNow.getMonth(), 1);
  const firstDayOfMonth = getLocalISODate(ndFirst.toJsDate());
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(now.getDate() + 30);
  const sevenDaysFromNow = new Date();
  sevenDaysFromNow.setDate(now.getDate() + 7);
  
  const thirtyStr = getLocalISODate(thirtyDaysFromNow);
  const sevenStr = getLocalISODate(sevenDaysFromNow);

  // Total active members (status 'active' AND end_date has not passed)
  const { count: activeCount } = await supabase
    .from('members')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'active')
    .gte('end_date', todayStr);

  // Total members (all time)
  const { count: totalCount } = await supabase
    .from('members')
    .select('*', { count: 'exact', head: true });

  // New this month
  const { count: newThisMonth } = await supabase
    .from('members')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', firstDayOfMonth);

  // Monthly revenue
  const { data: monthlyPayments } = await supabase
    .from('payments')
    .select('amount')
    .gte('payment_date', firstDayOfMonth);
  const monthlyRevenue = (monthlyPayments || []).reduce((sum, p) => sum + p.amount, 0);

  // Expiring in 30 days
  const { count: expiring30 } = await supabase
    .from('members')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'active')
    .gte('end_date', todayStr)
    .lte('end_date', thirtyStr);

  // Expiring in 7 days
  const { count: expiring7 } = await supabase
    .from('members')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'active')
    .gte('end_date', todayStr)
    .lte('end_date', sevenStr);

  return {
    activeMembers: activeCount || 0,
    totalMembers: totalCount || 0,
    newThisMonth: newThisMonth || 0,
    monthlyRevenue: monthlyRevenue || 0,
    expiringSoon: expiring30 || 0,
    expiringWeek: expiring7 || 0,
  };
}

export async function getReportStats(range = 'month') {
  const now = new Date();
  const ndNow = new NepaliDate(now);
  let nYear = ndNow.getYear();
  let nMonth = ndNow.getMonth();

  switch (range) {
    case 'month':
      break;
    case '3months':
      nMonth -= 2;
      break;
    case '6months':
      nMonth -= 5;
      break;
    case 'year':
      nMonth = 0; // 0 = Baisakh (start of BS year)
      break;
    default:
      break;
  }

  // Normalize negative months bridging backward years
  while (nMonth < 0) {
    nMonth += 12;
    nYear -= 1;
  }

  const ndStart = new NepaliDate(nYear, nMonth, 1);
  const startStr = getLocalISODate(ndStart.toJsDate());

  // Total collected
  const { data: payments } = await supabase
    .from('payments')
    .select('amount')
    .gte('payment_date', startStr);
  const totalCollected = (payments || []).reduce((sum, p) => sum + p.amount, 0);

  // New members in range
  const { count: newMembers } = await supabase
    .from('members')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', startStr);

  // Unpaid balances (Using Dynamic Ledger)
  const allMembers = await getMembers();
  const todayStr = getLocalISODate(now);
  const activeMembers = allMembers.filter(m => m.status === 'active' && m.end_date >= todayStr);
  const unpaidBalances = activeMembers.reduce((sum, m) => sum + (m.balance || 0), 0);

  // Total Transactions (previously erroneously labeled renewals)
  const { count: totalPayments } = await supabase
    .from('payments')
    .select('*', { count: 'exact', head: true })
    .gte('payment_date', startStr);

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

  for (let i = months - 1; i >= 0; i--) {
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

    // Using the true BS timeline string natively as the key
    const key = ndStart.format('MMMM YYYY');

    const { count } = await supabase
      .from('members')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', getLocalISODate(ndStart.toJsDate()))
      .lt('created_at', getLocalISODate(ndNext.toJsDate()));

    data[key] = count || 0;
  }

  return data;
}

export async function getRevenueOverview(months = 12) {
  const data = {};
  const ndNow = new NepaliDate(new Date());

  for (let i = months - 1; i >= 0; i--) {
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

    const { data: payments } = await supabase
      .from('payments')
      .select('amount')
      .gte('payment_date', getLocalISODate(ndStart.toJsDate()))
      .lt('payment_date', getLocalISODate(ndNext.toJsDate()));

    data[key] = (payments || []).reduce((sum, p) => sum + p.amount, 0);
  }

  return data;
}
