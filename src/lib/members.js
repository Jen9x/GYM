import { supabase } from './supabase';

export async function getMembers(filters = {}) {
  let query = supabase
    .from('members')
    .select('*, payments (amount, payment_date)')
    .order('created_at', { ascending: false });

  if (filters.search) {
    query = query.or(`name.ilike.%${filters.search}%,phone.ilike.%${filters.search}%,email.ilike.%${filters.search}%`);
  }

  if (filters.status && filters.status !== 'all') {
    query = query.eq('status', filters.status);
  }

  // We fetch all records first, compute balance, and then filter if payment status is provided.
  const { data, error } = await query;
  if (error) throw error;

  const processedData = data.map((member) => {
    let paidThisPeriod = 0;
    if (member.payments) {
      member.payments.forEach((p) => {
        if (new Date(p.payment_date) >= new Date(member.start_date)) {
          paidThisPeriod += p.amount;
        }
      });
    }
    
    const balance = Math.max(0, member.amount - paidThisPeriod);
    let computedPaymentStatus = 'unpaid';
    if (balance === 0) computedPaymentStatus = 'paid';
    else if (balance > 0 && balance < member.amount) computedPaymentStatus = 'partial';
    
    return {
      ...member,
      balance,
      paid_this_period: paidThisPeriod,
      computed_payment_status: computedPaymentStatus
    };
  });

  if (filters.payment && filters.payment !== 'all') {
    return processedData.filter(m => m.computed_payment_status === filters.payment);
  }

  return processedData;
}

export async function getMember(id) {
  const { data, error } = await supabase
    .from('members')
    .select('*, payments (amount, payment_date)')
    .eq('id', id)
    .single();
  if (error) throw error;
  
  if (data) {
    let paidThisPeriod = 0;
    if (data.payments) {
      data.payments.forEach((p) => {
        if (new Date(p.payment_date) >= new Date(data.start_date)) {
          paidThisPeriod += p.amount;
        }
      });
    }
    const balance = Math.max(0, data.amount - paidThisPeriod);
    let computedPaymentStatus = 'unpaid';
    if (balance === 0) computedPaymentStatus = 'paid';
    else if (balance > 0 && balance < data.amount) computedPaymentStatus = 'partial';
    
    data.balance = balance;
    data.paid_this_period = paidThisPeriod;
    data.computed_payment_status = computedPaymentStatus;
  }
  
  return data;
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
  if (error) throw error;
}

export async function getRecentMembers(limit = 5) {
  const { data, error } = await supabase
    .from('members')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

export async function getExpiringMembers(days = 30) {
  const today = new Date();
  const futureDate = new Date();
  futureDate.setDate(today.getDate() + days);

  const { data, error } = await supabase
    .from('members')
    .select('*')
    .eq('status', 'active')
    .gte('end_date', today.toISOString().split('T')[0])
    .lte('end_date', futureDate.toISOString().split('T')[0])
    .order('end_date', { ascending: true });
  if (error) throw error;
  return data;
}

export async function getMembersCount() {
  const { count, error } = await supabase
    .from('members')
    .select('*', { count: 'exact', head: true });
  if (error) throw error;
  return count;
}

export async function getActiveMembersCount() {
  const { count, error } = await supabase
    .from('members')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'active');
  if (error) throw error;
  return count;
}

// Helper to solve UTC timezone offsets randomly shifting dates by 1 day
const getLocalISODate = (date) => {
  const d = new Date(date);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().split('T')[0];
};

export async function getNewMembersThisMonth() {
  const now = new Date();
  const firstDay = getLocalISODate(new Date(now.getFullYear(), now.getMonth(), 1));

  const { count, error } = await supabase
    .from('members')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', firstDay);
  if (error) throw error;
  return count;
}
