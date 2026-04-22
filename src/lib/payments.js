import NepaliDate from 'nepali-date-converter';
import { supabase } from './supabase';
import { parseAppDate, toLocalISODate } from './nepali-date';
import { getComputedMembershipStatus, getMember, updateMember } from './members';

function normalizePaymentFilters(filtersOrMemberId) {
  if (!filtersOrMemberId) return {};

  if (typeof filtersOrMemberId === 'string') {
    return { memberId: filtersOrMemberId };
  }

  return filtersOrMemberId;
}

export async function getPayments(filtersOrMemberId) {
  const { memberId, startDate, endDate } = normalizePaymentFilters(filtersOrMemberId);

  let query = supabase
    .from('payments')
    .select('*, members(name)')
    .order('payment_date', { ascending: false });

  if (memberId) {
    query = query.eq('member_id', memberId);
  }

  if (startDate) {
    query = query.gte('payment_date', startDate);
  }

  if (endDate) {
    query = query.lte('payment_date', endDate);
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

  let memberSyncWarning = '';

  if (data?.member_id) {
    try {
      const member = await getMember(data.member_id);

      if (member) {
        await updateMember(member.id, {
          payment_status: member.computed_payment_status,
          status: getComputedMembershipStatus(member),
        });
      }
    } catch (syncError) {
      memberSyncWarning = syncError?.message || 'Payment saved, but the related member summary could not be refreshed automatically.';
    }
  }

  return {
    payment: data,
    memberSyncWarning,
  };
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
  const startStr = toLocalISODate(ndStart.toJsDate());

  const { data, error } = await supabase
    .from('payments')
    .select('amount, payment_date')
    .gte('payment_date', startStr)
    .order('payment_date', { ascending: true });

  if (error) throw error;

  const grouped = {};
  (data || []).forEach((payment) => {
    const paymentDate = parseAppDate(payment.payment_date);
    if (!paymentDate) return;

    const bsDate = new NepaliDate(paymentDate);
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

  return (data || []).reduce((sum, payment) => sum + payment.amount, 0);
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
  const firstStr = toLocalISODate(ndFirst.toJsDate());
  const lastStr = toLocalISODate(ndLast.toJsDate());

  return getTotalCollected(firstStr, lastStr);
}
