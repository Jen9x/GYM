import { supabase } from './supabase';

export async function getDashboardStats() {
  const now = new Date();
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(now.getDate() + 30);
  const sevenDaysFromNow = new Date();
  sevenDaysFromNow.setDate(now.getDate() + 7);

  // Total active members
  const { count: activeCount } = await supabase
    .from('members')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'active');

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
    .gte('end_date', now.toISOString().split('T')[0])
    .lte('end_date', thirtyDaysFromNow.toISOString().split('T')[0]);

  // Expiring in 7 days
  const { count: expiring7 } = await supabase
    .from('members')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'active')
    .gte('end_date', now.toISOString().split('T')[0])
    .lte('end_date', sevenDaysFromNow.toISOString().split('T')[0]);

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
      startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1);
      break;
    case '6months':
      startDate = new Date(now.getFullYear(), now.getMonth() - 6, 1);
      break;
    case 'year':
      startDate = new Date(now.getFullYear(), 0, 1);
      break;
    default:
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
  }

  const startStr = startDate.toISOString().split('T')[0];

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

  // Unpaid balances
  const { data: unpaidMembers } = await supabase
    .from('members')
    .select('amount')
    .eq('payment_status', 'unpaid')
    .eq('status', 'active');
  const unpaidBalances = (unpaidMembers || []).reduce((sum, m) => sum + m.amount, 0);

  // Renewals (members whose start_date is after their original created_at, in range)
  const { count: renewals } = await supabase
    .from('payments')
    .select('*', { count: 'exact', head: true })
    .gte('payment_date', startStr);

  return {
    totalCollected,
    newMembers: newMembers || 0,
    renewals: renewals || 0,
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
      .gte('created_at', date.toISOString().split('T')[0])
      .lt('created_at', nextDate.toISOString().split('T')[0]);

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
      .gte('payment_date', date.toISOString().split('T')[0])
      .lt('payment_date', nextDate.toISOString().split('T')[0]);

    data[key] = (payments || []).reduce((sum, p) => sum + p.amount, 0);
  }

  return data;
}
