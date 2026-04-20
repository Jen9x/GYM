import { supabase } from './supabase';
import NepaliDate from 'nepali-date-converter';

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
  const now = new Date();
  const ndNow = new NepaliDate(now);
  
  let startYear = ndNow.getYear();
  let startMonth = ndNow.getMonth() - months;
  
  while (startMonth < 0) {
    startMonth += 12;
    startYear -= 1;
  }
  
  const ndStart = new NepaliDate(startYear, startMonth, 1);
  const startDate = new Date(ndStart.toJsDate());
  startDate.setMinutes(startDate.getMinutes() - startDate.getTimezoneOffset());
  const startStr = startDate.toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('payments')
    .select('amount, payment_date')
    .gte('payment_date', startStr)
    .order('payment_date', { ascending: true });

  if (error) throw error;

  // Group by actual BS Month string arrays natively
  const grouped = {};
  data.forEach((payment) => {
    // Math guard against exact timestamp shifting
    const pDate = new Date(payment.payment_date);
    pDate.setMinutes(pDate.getMinutes() + pDate.getTimezoneOffset());
    const bsDate = new NepaliDate(pDate);
    const key = bsDate.format('MMMM YYYY');
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
  const ndNow = new NepaliDate(now);
  
  const ndFirst = new NepaliDate(ndNow.getYear(), ndNow.getMonth(), 1);
  let nextYear = ndNow.getYear();
  let nextMonth = ndNow.getMonth() + 1;
  if (nextMonth > 11) {
    nextMonth = 0;
    nextYear += 1;
  }
  const ndLast = new NepaliDate(nextYear, nextMonth, 1);

  const firstDay = new Date(ndFirst.toJsDate());
  firstDay.setMinutes(firstDay.getMinutes() - firstDay.getTimezoneOffset());
  const firstStr = firstDay.toISOString().split('T')[0];

  const lastDay = new Date(ndLast.toJsDate());
  lastDay.setMinutes(lastDay.getMinutes() - lastDay.getTimezoneOffset());
  const lastStr = lastDay.toISOString().split('T')[0];

  return getTotalCollected(firstStr, lastStr);
}
