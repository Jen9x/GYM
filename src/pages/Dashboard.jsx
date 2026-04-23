import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, TrendingUp, DollarSign, Clock, UserPlus, AlertCircle } from 'lucide-react';
import { getDashboardStats } from '../lib/stats';
import { getExpiringMembers, getRecentMembers } from '../lib/members';
import { createMemberWithInitialPayment } from '../lib/member-actions';
import StatCard from '../components/StatCard';
import AddMemberModal from '../components/AddMemberModal';
import { useToast } from '../components/Toast';
import { getMemberPackageLabel } from '../lib/member-package';
import { formatNepaliDate, startOfLocalDay } from '../lib/nepali-date';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [recentMembers, setRecentMembers] = useState([]);
  const [attentionMembers, setAttentionMembers] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const toast = useToast();

  const fetchData = async () => {
    setLoading(true);
    setError('');

    try {
      const [statsData, recent, expiring] = await Promise.all([
        getDashboardStats(),
        getRecentMembers(5),
        getExpiringMembers(30),
      ]);

      setStats(statsData);
      setRecentMembers(recent);
      setAttentionMembers(expiring);
    } catch (err) {
      console.error('Dashboard fetch error:', err);
      setError(err.message || 'Failed to load dashboard data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAddMember = async (memberData) => {
    try {
      const { member, paymentResult } = await createMemberWithInitialPayment(memberData);

      toast(`${member.name} added successfully!`, 'success');

      if (paymentResult?.memberSyncWarning) {
        toast(paymentResult.memberSyncWarning, 'info');
      }

      await fetchData();
    } catch (err) {
      toast(err.message || 'Failed to add member.', 'error');
      throw err;
    }
  };

  const formatDate = (dateStr) => formatNepaliDate(dateStr, 'short');

  const daysUntil = (dateStr) => {
    const endDate = startOfLocalDay(dateStr);
    const today = startOfLocalDay(new Date());
    if (!endDate || !today) return 0;

    const diff = endDate - today;
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '100px' }}>
        <div className="spinner spinner-dark" style={{ width: 32, height: 32 }} />
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-header-text">
          <h1>Dashboard</h1>
          <p>Overview of your gym&apos;s performance and operations.</p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => setShowAddModal(true)}
          id="dashboard-add-member-btn"
        >
          <UserPlus size={18} />
          Add Member
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="stats-grid">
        <StatCard
          title="Total Active Members"
          value={stats?.activeMembers || 0}
          subtitle={`${stats?.totalMembers || 0} total historically`}
          icon={Users}
          color="#2563eb"
        />
        <StatCard
          title="New This Month"
          value={stats?.newThisMonth || 0}
          icon={TrendingUp}
          color="#059669"
        />
        <StatCard
          title="Monthly Revenue"
          value={`Rs. ${(stats?.monthlyRevenue || 0).toLocaleString()}`}
          icon={DollarSign}
          color="#d97706"
        />
        <StatCard
          title="Expiring Soon (30d)"
          value={stats?.expiringSoon || 0}
          subtitle={`${stats?.expiringWeek || 0} expiring in 7 days`}
          icon={Clock}
          color="#DC2626"
        />
      </div>

      <div className="content-grid">
        <div className="content-card">
          <div className="content-card-header">
            <div>
              <div className="content-card-title">Recent Members</div>
              <div className="content-card-subtitle">Recently joined members</div>
            </div>
            <button className="view-all-link" onClick={() => navigate('/members')}>
              View All
            </button>
          </div>

          {recentMembers.length === 0 ? (
            <div className="empty-state">
              <Users />
              <p>No recent members found</p>
            </div>
          ) : (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Plan</th>
                    <th>Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {recentMembers.map((member) => (
                    <tr key={member.id}>
                      <td>
                        <div className="member-name-cell">
                          <span className="member-name">{member.name}</span>
                          <span className="member-email">{member.phone}</span>
                        </div>
                      </td>
                      <td>{getMemberPackageLabel(member)}</td>
                      <td>{formatDate(member.start_date || member.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="content-card">
          <div className="content-card-header">
            <div>
              <div className="content-card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertCircle size={18} color="var(--color-warning)" />
                Needs Attention
              </div>
              <div className="content-card-subtitle">Expiring soon memberships</div>
            </div>
          </div>

          {attentionMembers.length === 0 ? (
            <div className="empty-state">
              <Clock />
              <p>All clear! Nothing needs attention.</p>
            </div>
          ) : (
            <div>
              {attentionMembers.map((member) => {
                const days = daysUntil(member.end_date);

                return (
                  <div className="attention-item" key={member.id}>
                    <div className="attention-info">
                      <span className="attention-name">{member.name}</span>
                      <span className="attention-detail">
                        {days <= 0 ? 'Expired' : `Expires in ${days} days`} | {getMemberPackageLabel(member)}
                      </span>
                    </div>
                    <span className={`badge attention-badge ${days <= 7 ? 'badge-expired' : 'badge-expiring'}`}>
                      {days <= 0 ? 'Expired' : days <= 7 ? 'Urgent' : 'Soon'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {showAddModal && (
        <AddMemberModal
          onClose={() => setShowAddModal(false)}
          onSave={handleAddMember}
        />
      )}
    </div>
  );
}
