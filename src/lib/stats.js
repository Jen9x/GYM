import { supabase } from './supabase';
import { getMembers } from './members';

// Helper to solve UTC timezone offsets randomly shifting dates by 1 day
const getLocalISODate = (date) => {
  const d = new Date(date);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().split('T')[0];
};

export async function getDashboardStats() {
  const now = new Date();
  const todayStr = getLocalISODate(now);
  const firstDayOfMonth = getLocalISODate(new Date(now.getFullYear(), now.getMonth(), 1));
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
  let startDate;

  switch (range) {
    case 'month':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case '3months':
      startDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      break;
    case '6months':
      startDate = new Date(now.getFullYear(), now.getMonth() - 5, 1);
      break;
    case 'year':
      startDate = new Date(now.getFullYear(), 0, 1);
      break;
    default:
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
  }

  const startStr = getLocalISODate(startDate);

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
  const now = new Date();

  for (let i = months - 1; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const nextDate = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    const key = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

    const { count } = await supabase
      .from('members')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', getLocalISODate(date))
      .lt('created_at', getLocalISODate(nextDate));

    data[key] = count || 0;
  }

  return data;
}

export async function getRevenueOverview(months = 12) {
  const data = {};
  const now = new Date();

  for (let i = months - 1; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const nextDate = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    const key = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

    const { data: payments } = await supabase
      .from('payments')
      .select('amount')
      .gte('payment_date', getLocalISODate(date))
      .lt('payment_date', getLocalISODate(nextDate));

    data[key] = (payments || []).reduce((sum, p) => sum + p.amount, 0);
  }

  return data;
}
