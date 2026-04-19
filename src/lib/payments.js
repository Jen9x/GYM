import { supabase } from './supabase';

export async function getPayments(memberId) {
  let query = supabase
    .from('payments')
    .select('*, members(name)')
    .order('payment_date', { ascending: false });

  if (memberId) {
    query = query.eq('member_id', memberId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function addPayment(paymentData) {
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('payments')
    .insert([{ ...paymentData, user_id: user.id }])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getRevenueByMonth(months = 12) {
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - months);

  const { data, error } = await supabase
    .from('payments')
    .select('amount, payment_date')
    .gte('payment_date', startDate.toISOString().split('T')[0])
    .order('payment_date', { ascending: true });

  if (error) throw error;

  // Group by month
  const grouped = {};
  data.forEach((payment) => {
    const date = new Date(payment.payment_date);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    grouped[key] = (grouped[key] || 0) + payment.amount;
  });

  return grouped;
}

export async function getTotalCollected(startDate, endDate) {
  let query = supabase
    .from('payments')
    .select('amount');

  if (startDate) {
    query = query.gte('payment_date', startDate);
  }
  if (endDate) {
    query = query.lte('payment_date', endDate);
  }

  const { data, error } = await query;
  if (error) throw error;

  return data.reduce((sum, p) => sum + p.amount, 0);
}

export async function getMonthlyRevenue() {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

  return getTotalCollected(firstDay, lastDay);
}
