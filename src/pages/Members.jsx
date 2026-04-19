import { useState, useEffect } from 'react';
import {
  getMembers,
  addMember,
  updateMember,
  deleteMember,
} from '../lib/members';
import { addPayment } from '../lib/payments';
import { getPlanMonths } from '../lib/plans';
import { useToast } from '../components/Toast';
import { formatNepaliDate } from '../lib/nepali-date';
import AddMemberModal from '../components/AddMemberModal';
import {
  UserPlus,
  Search,
  Edit3,
  Trash2,
  RefreshCw,
  Users,
  X,
} from 'lucide-react';

export default function Members() {
  const toast = useToast();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editMember, setEditMember] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [renewConfirm, setRenewConfirm] = useState(null);

  const fetchMembers = async () => {
    setLoading(true);
    try {
      const data = await getMembers({
        search,
        status: statusFilter,
        payment: paymentFilter,
      });
      setMembers(data);
    } catch (err) {
      console.error('Fetch members error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, [statusFilter, paymentFilter]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchMembers();
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const handleAddMember = async (memberData) => {
    try {
      const member = await addMember(memberData);
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
      fetchMembers();
    } catch (err) {
      toast(err.message || 'Failed to add member.', 'error');
    }
  };

  const handleEditMember = async (memberData) => {
    try {
      await updateMember(editMember.id, memberData);
      toast(`${memberData.name} updated successfully!`, 'success');
      setEditMember(null);
      fetchMembers();
    } catch (err) {
      toast(err.message || 'Failed to update member.', 'error');
    }
  };

  const handleDeleteMember = async (id) => {
    try {
      await deleteMember(id);
      toast('Member deleted.', 'success');
      setDeleteConfirm(null);
      fetchMembers();
    } catch (err) {
      toast(err.message || 'Failed to delete member.', 'error');
    }
  };

  const handleRenewMember = async (member) => {
    try {
      const startDate = new Date().toISOString().split('T')[0];
      const months = getPlanMonths(member.plan);
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + months);

      await updateMember(member.id, {
        start_date: startDate,
        end_date: endDate.toISOString().split('T')[0],
        status: 'active',
        payment_status: 'paid',
      });

      await addPayment({
        member_id: member.id,
        amount: member.amount,
        payment_date: startDate,
        payment_method: 'cash',
        notes: `Renewal - ${member.plan} plan`,
      });

      toast(`${member.name}'s membership renewed!`, 'success');
      setRenewConfirm(null);
      fetchMembers();
    } catch (err) {
      toast(err.message || 'Failed to renew membership.', 'error');
    }
  };

  const formatDate = (dateStr) => {
    return formatNepaliDate(dateStr, 'short');
  };

  const getMemberStatus = (member) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const endDate = new Date(member.end_date);
    endDate.setHours(0, 0, 0, 0);

    if (member.status === 'expired' || endDate < today) {
      return { dotClass: 'status-dot-expired', label: 'Expired' };
    }

    const diffTime = endDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays <= 7) {
      return { dotClass: 'status-dot-expiring', label: `Expiring soon (${diffDays} days)` };
    }

    return { dotClass: 'status-dot-active', label: 'Active' };
  };

  const getPaymentBadge = (status) => {
    const badges = {
      paid: <span className="badge badge-paid">Paid</span>,
      unpaid: <span className="badge badge-unpaid">Unpaid</span>,
      partial: <span className="badge badge-partial">Partial</span>,
    };
    return badges[status] || badges.unpaid;
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-header-text">
          <h1>Members</h1>
          <p>Manage your gym members and their memberships.</p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => setShowAddModal(true)}
          id="members-add-btn"
        >
          <UserPlus size={18} />
          Add Member
        </button>
      </div>

      {/* Filters */}
      <div className="content-card" style={{ marginBottom: '24px' }}>
        <div className="filters-bar">
          <div className="search-input-wrapper">
            <Search />
            <input
              type="text"
              className="search-input"
              placeholder="Search members..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              id="member-search-input"
            />
          </div>

          <select
            className="filter-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            id="status-filter"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="expired">Expired</option>
          </select>

          <select
            className="filter-select"
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value)}
            id="payment-filter"
          >
            <option value="all">All Payments</option>
            <option value="paid">Paid</option>
            <option value="unpaid">Unpaid</option>
            <option value="partial">Partial</option>
          </select>
        </div>

        {/* Table */}
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Contact</th>
                <th>Plan</th>
                <th>Amount</th>
                <th>Expiry</th>
                <th>Payment</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '48px' }}>
                    <div className="spinner spinner-dark" style={{ margin: '0 auto', width: 24, height: 24 }} />
                  </td>
                </tr>
              ) : members.length === 0 ? (
                <tr>
                  <td colSpan="7">
                    <div className="empty-state">
                      <Users />
                      <p style={{ color: 'var(--color-primary)' }}>No members found.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                members.map((member) => (
                  <tr key={member.id}>
                    <td>
                      <div className="member-name-cell">
                        {(() => {
                          const status = getMemberStatus(member);
                          return (
                            <span 
                              className={`status-dot ${status.dotClass}`} 
                              title={status.label}
                            />
                          );
                        })()}
                        <div className="member-info-column">
                          <span className="member-name">{member.name}</span>
                          {member.email && (
                            <span className="member-email">{member.email}</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>{member.phone}</td>
                    <td>{member.plan}</td>
                    <td>
                      <span style={{ fontWeight: 600 }}>Rs. {member.amount?.toLocaleString()}</span>
                    </td>
                    <td>
                      {formatDate(member.end_date)}
                    </td>
                    <td>{getPaymentBadge(member.payment_status)}</td>
                    <td>
                      <div className="action-btns">
                        <button
                          className="action-btn"
                          title="Edit"
                          onClick={() => setEditMember(member)}
                        >
                          <Edit3 />
                        </button>
                        <button
                          className="action-btn"
                          title="Renew"
                          onClick={() => setRenewConfirm(member)}
                        >
                          <RefreshCw />
                        </button>
                        <button
                          className="action-btn danger"
                          title="Delete"
                          onClick={() => setDeleteConfirm(member)}
                        >
                          <Trash2 />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <AddMemberModal
          onClose={() => setShowAddModal(false)}
          onSave={handleAddMember}
        />
      )}

      {/* Edit Modal */}
      {editMember && (
        <AddMemberModal
          editData={editMember}
          onClose={() => setEditMember(null)}
          onSave={handleEditMember}
        />
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="modal confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Delete Member</h2>
              <button className="modal-close" onClick={() => setDeleteConfirm(null)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <p>
                Are you sure you want to delete <strong>{deleteConfirm.name}</strong>?
                This action cannot be undone.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDeleteConfirm(null)}>
                Cancel
              </button>
              <button
                className="btn btn-danger"
                onClick={() => handleDeleteMember(deleteConfirm.id)}
                id="confirm-delete-btn"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Renew Confirmation */}
      {renewConfirm && (
        <div className="modal-overlay" onClick={() => setRenewConfirm(null)}>
          <div className="modal confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Renew Membership</h2>
              <button className="modal-close" onClick={() => setRenewConfirm(null)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <p>
                Renew <strong>{renewConfirm.name}</strong>'s {renewConfirm.plan} membership
                for <strong>Rs. {renewConfirm.amount?.toLocaleString()}</strong>?
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setRenewConfirm(null)}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={() => handleRenewMember(renewConfirm)}
                id="confirm-renew-btn"
              >
                <RefreshCw size={16} />
                Renew
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
