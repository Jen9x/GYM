import NepaliDate from 'nepali-date-converter';
import { supabase } from './supabase';
import { parseAppDate, startOfLocalDay, toLocalISODate } from './nepali-date';

export function getMemberLedgerStartDate(member) {
  return parseAppDate(member?.start_date) || parseAppDate(member?.created_at);
}

export function calculateMemberPaidAmount(member) {
  const ledgerStartDate = getMemberLedgerStartDate(member);

  return (member?.payments || []).reduce((sum, payment) => {
    const paymentDate = parseAppDate(payment.payment_date);

    if (!paymentDate) return sum;
    if (!ledgerStartDate || paymentDate >= ledgerStartDate) {
      return sum + (Number(payment.amount) || 0);
    }

    return sum;
  }, 0);
}

export function getComputedPaymentStatus(balance, amount) {
  if (balance <= 0) return 'paid';
  if (balance > 0 && balance < amount) return 'partial';
  return 'unpaid';
}

export function getComputedMembershipStatus(member, today = startOfLocalDay(new Date())) {
  const endDate = startOfLocalDay(member?.end_date);

  if (!today || !endDate) return 'expired';
  return endDate < today ? 'expired' : 'active';
}

function buildComputedMember(member, today = startOfLocalDay(new Date())) {
  const paidThisPeriod = calculateMemberPaidAmount(member);
  const amount = Number(member?.amount) || 0;
  const balance = Math.max(0, amount - paidThisPeriod);

  return {
    ...member,
    balance,
    paid_this_period: paidThisPeriod,
    computed_payment_status: getComputedPaymentStatus(balance, amount),
    computed_membership_status: getComputedMembershipStatus(member, today),
  };
}

export async function getMembers(filters = {}) {
  let query = supabase
    .from('members')
    .select('*, payments (amount, payment_date)')
    .order('created_at', { ascending: false });

  if (filters.search) {
    query = query.or(`name.ilike.%${filters.search}%,phone.ilike.%${filters.search}%,email.ilike.%${filters.search}%`);
  }

  const { data, error } = await query;
  if (error) throw error;

  const today = startOfLocalDay(new Date());
  let filteredData = (data || []).map((member) => buildComputedMember(member, today));

  if (filters.status && filters.status !== 'all') {
    filteredData = filteredData.filter((member) => member.computed_membership_status === filters.status);
  }

  if (filters.payment && filters.payment !== 'all') {
    filteredData = filteredData.filter((member) => member.computed_payment_status === filters.payment);
  }

  return filteredData;
}

export async function getMember(id) {
  const { data, error } = await supabase
    .from('members')
    .select('*, payments (amount, payment_date)')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data ? buildComputedMember(data) : data;
}

export async function addMember(memberData) {
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('members')
    .insert([{ ...memberData, user_id: user.id }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateMember(id, memberData) {
  const { data, error } = await supabase
    .from('members')
    .update(memberData)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteMember(id) {
  const { error } = await supabase
    .from('members')
    .delete()
    .eq('id', id);

  if (!error) return;

  const isForeignKeyBlock = /foreign key|constraint/i.test(error.message || '');
  if (!isForeignKeyBlock) throw error;

  const { error: paymentDeleteError } = await supabase
    .from('payments')
    .delete()
    .eq('member_id', id);

  if (paymentDeleteError) throw paymentDeleteError;

  const { error: retryError } = await supabase
    .from('members')
    .delete()
    .eq('id', id);

  if (retryError) throw retryError;
}

export async function getRecentMembers(limit = 5) {
  const { data, error } = await supabase
    .from('members')
    .select('*')
    .order('start_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data;
}

export async function getExpiringMembers(days = 30) {
  const futureDate = startOfLocalDay(new Date());
  futureDate?.setDate(futureDate.getDate() + days);

  const activeMembers = await getMembers({ status: 'active' });

  return activeMembers
    .filter((member) => {
      const endDate = startOfLocalDay(member.end_date);
      return endDate && futureDate && endDate <= futureDate;
    })
    .sort((left, right) => {
      const leftDate = parseAppDate(left.end_date)?.getTime() || 0;
      const rightDate = parseAppDate(right.end_date)?.getTime() || 0;
      return leftDate - rightDate;
    });
}

export async function getMembersCount() {
  const { count, error } = await supabase
    .from('members')
    .select('*', { count: 'exact', head: true });

  if (error) throw error;
  return count;
}

export async function getActiveMembersCount() {
  const members = await getMembers({ status: 'active' });
  return members.length;
}

export async function getNewMembersThisMonth() {
  const now = new Date();
  const ndNow = new NepaliDate(now);
  const ndFirst = new NepaliDate(ndNow.getYear(), ndNow.getMonth(), 1);
  const firstDay = toLocalISODate(ndFirst.toJsDate());

  const { count, error } = await supabase
    .from('members')
    .select('*', { count: 'exact', head: true })
    .gte('start_date', firstDay);

  if (error) throw error;
  return count;
}
