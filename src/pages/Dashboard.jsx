import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDashboardStats } from '../lib/stats';
import { getRecentMembers, getExpiringMembers } from '../lib/members';
import StatCard from '../components/StatCard';
import AddMemberModal from '../components/AddMemberModal';
import { useToast } from '../components/Toast';
import { addMember } from '../lib/members';
import { addPayment } from '../lib/payments';
import { formatNepaliDate } from '../lib/nepali-date';
import {
  Users,
  TrendingUp,
  DollarSign,
  Clock,
  UserPlus,
  AlertCircle,
} from 'lucide-react';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [recentMembers, setRecentMembers] = useState([]);
  const [attentionMembers, setAttentionMembers] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const toast = useToast();

  const fetchData = async () => {
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
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAddMember = async (memberData) => {
    try {
      const member = await addMember(memberData);
      
      // Also create a payment record if paid
      if (memberData.payment_status === 'paid' && memberData.amount > 0) {
        await addPayment({
          member_id: member.id,
          amount: memberData.amount,
          payment_date: memberData.start_date,
          payment_method: 'cash',
          notes: `Initial payment for ${memberData.plan} plan`,
        });
      }
      
      toast(`${memberData.name} added successfully!`, 'success');
      fetchData();
    } catch (err) {
      toast(err.message || 'Failed to add member.', 'error');
    }
  };

  const formatDate = (dateStr) => {
    return formatNepaliDate(dateStr, 'short');
  };

  const daysUntil = (dateStr) => {
    const diff = new Date(dateStr) - new Date();
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
          <p>Overview of your gym's performance and operations.</p>
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

      {/* Stats */}
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

      {/* Content Cards */}
      <div className="content-grid">
        {/* Recent Members */}
        <div className="content-card">
          <div className="content-card-header">
            <div>
              <div className="content-card-title">Recent Members</div>
              <div className="content-card-subtitle">Recently joined members</div>
            </div>
            <button
              className="view-all-link"
              onClick={() => navigate('/members')}
            >
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
                      <td>{member.plan}</td>
                      <td>{formatDate(member.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Needs Attention */}
        <div className="content-card">
          <div className="content-card-header">
            <div>
              <div className="content-card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertCircle size={18} color="var(--color-warning)" />
                Needs Attention
              </div>
              <div className="content-card-subtitle">Expiring soon or unpaid</div>
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
                        {days <= 0 ? 'Expired' : `Expires in ${days} days`} • {member.plan}
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

      {/* Add Member Modal */}
      {showAddModal && (
        <AddMemberModal
          onClose={() => setShowAddModal(false)}
          onSave={handleAddMember}
        />
      )}
    </div>
  );
}
