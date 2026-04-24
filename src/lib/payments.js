import NepaliDate from 'nepali-date-converter';
import { supabase } from './supabase';
import { parseAppDate, toLocalISODate } from './nepali-date';
import { getComputedMembershipStatus, getMember, getMemberLedgerStartDate, updateMember } from './members';

export const PAYMENT_DELETE_WINDOW_HOURS = 1;
const PAYMENT_DELETE_WINDOW_MS = PAYMENT_DELETE_WINDOW_HOURS * 60 * 60 * 1000;

function normalizePaymentFilters(filtersOrMemberId) {
  if (!filtersOrMemberId) return {};

  if (typeof filtersOrMemberId === 'string') {
    return { memberId: filtersOrMemberId };
  }

  return filtersOrMemberId;
}

export function isPaymentDeleteAllowed(payment, now = new Date()) {
  const createdAt = parseAppDate(payment?.created_at);
  const currentTime = parseAppDate(now);

  if (!createdAt || !currentTime) return false;

  const ageMs = currentTime.getTime() - createdAt.getTime();
  return ageMs >= 0 && ageMs <= PAYMENT_DELETE_WINDOW_MS;
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
  const amount = Number(paymentData?.amount);
  const paymentDate = parseAppDate(paymentData?.payment_date);

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Payment amount must be greater than zero.');
  }

  if (!paymentDate) {
    throw new Error('Please choose a valid payment date.');
  }

  if (paymentData?.member_id) {
    const member = await getMember(paymentData.member_id);

    if (!member) {
      throw new Error('Selected member could not be found.');
    }

    const remainingBalance = Number(member.balance) || 0;

    if (remainingBalance <= 0) {
      throw new Error('This member does not have any outstanding balance.');
    }

    if (amount > remainingBalance) {
      throw new Error(`Payment cannot be more than the remaining due amount of Rs. ${remainingBalance.toLocaleString()}.`);
    }

    const ledgerStartDate = getMemberLedgerStartDate(member);

    if (ledgerStartDate && paymentDate < ledgerStartDate) {
      throw new Error(`Payment date cannot be earlier than the current membership start date (${toLocalISODate(ledgerStartDate)}).`);
    }
  }

  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('payments')
    .insert([{
      ...paymentData,
      amount,
      notes: paymentData?.notes?.trim() || null,
      user_id: user.id,
    }])
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

export async function deleteRecentPayment(paymentId) {
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError) throw userError;
  if (!user?.id) {
    throw new Error('Could not verify the signed-in user before deleting the payment.');
  }

  const { data: payment, error: loadError } = await supabase
    .from('payments')
    .select('id, member_id, amount, created_at')
    .eq('id', paymentId)
    .eq('user_id', user.id)
    .single();

  if (loadError) throw loadError;

  if (!isPaymentDeleteAllowed(payment)) {
    throw new Error(`Payments can only be deleted within ${PAYMENT_DELETE_WINDOW_HOURS} hours of being recorded.`);
  }

  const { error: deleteError } = await supabase
    .from('payments')
    .delete()
    .eq('id', payment.id)
    .eq('user_id', user.id);

  if (deleteError) throw deleteError;

  let memberSyncWarning = '';

  if (payment.member_id) {
    try {
      const member = await getMember(payment.member_id);

      if (member) {
        await updateMember(member.id, {
          payment_status: member.computed_payment_status,
          status: getComputedMembershipStatus(member),
        });
      }
    } catch (syncError) {
      memberSyncWarning = syncError?.message || 'Payment deleted, but the related member summary could not be refreshed automatically.';
    }
  }

  return {
    payment,
    memberSyncWarning,
  };
}

export async function getRevenueByMonth(months = 12) {
  const now = new Date();
  const ndNow = new NepaliDate(now);

  let startYear = ndNow.getYear();
  let startMonth = ndNow.getMonth() - Math.max(0, months - 1);

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
    .lte('payment_date', toLocalISODate(now))
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

  const { data, error } = await supabase
    .from('payments')
    .select('amount')
    .gte('payment_date', firstStr)
    .lt('payment_date', lastStr);

  if (error) throw error;

  return (data || []).reduce((sum, payment) => sum + payment.amount, 0);
}
