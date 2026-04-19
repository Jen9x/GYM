import { supabase } from './supabase';

export async function getMembers(filters = {}) {
  let query = supabase
    .from('members')
    .select('*')
    .order('created_at', { ascending: false });

  if (filters.search) {
    query = query.or(`name.ilike.%${filters.search}%,phone.ilike.%${filters.search}%,email.ilike.%${filters.search}%`);
  }

  if (filters.status && filters.status !== 'all') {
    query = query.eq('status', filters.status);
  }

  if (filters.payment && filters.payment !== 'all') {
    query = query.eq('payment_status', filters.payment);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function getMember(id) {
  const { data, error } = await supabase
    .from('members')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
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

export async function getNewMembersThisMonth() {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];

  const { count, error } = await supabase
    .from('members')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', firstDay);
  if (error) throw error;
  return count;
}
