import { useEffect, useState } from 'react';
import { Edit3, RefreshCw, Search, Trash2, UserPlus, Users, X } from 'lucide-react';
import { getMembers, deleteMember } from '../lib/members';
import {
  createMemberWithInitialPayment,
  renewMemberMembership,
  updateMemberWithPaymentAdjustment,
} from '../lib/member-actions';
import { useToast } from '../components/Toast';
import { formatNepaliDate, startOfLocalDay } from '../lib/nepali-date';
import AddMemberModal from '../components/AddMemberModal';

export default function Members() {
  const toast = useToast();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editMember, setEditMember] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [renewConfirm, setRenewConfirm] = useState(null);

  const fetchMembers = async () => {
    setLoading(true);
    setError('');

    try {
      const data = await getMembers({
        search,
        status: statusFilter,
        payment: paymentFilter,
      });

      setMembers(data);
    } catch (err) {
      console.error('Fetch members error:', err);
      setError(err.message || 'Failed to load members.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, [statusFilter, paymentFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchMembers();
    }, 300);

    return () => clearTimeout(timer);
  }, [search]);

  const handleAddMember = async (memberData) => {
    try {
      const { member, paymentResult } = await createMemberWithInitialPayment(memberData);
      toast(`${member.name} added successfully!`, 'success');

      if (paymentResult?.memberSyncWarning) {
        toast(paymentResult.memberSyncWarning, 'info');
      }

      await fetchMembers();
    } catch (err) {
      toast(err.message || 'Failed to add member.', 'error');
      throw err;
    }
  };

  const handleEditMember = async (memberData) => {
    try {
      const { paymentResult } = await updateMemberWithPaymentAdjustment(editMember, memberData);

      toast(`${memberData.name} updated successfully!`, 'success');

      if (paymentResult?.memberSyncWarning) {
        toast(paymentResult.memberSyncWarning, 'info');
      }

      setEditMember(null);
      await fetchMembers();
    } catch (err) {
      toast(err.message || 'Failed to update member.', 'error');
      throw err;
    }
  };

  const handleDeleteMember = async (id) => {
    try {
      await deleteMember(id);
      toast('Member deleted.', 'success');
      setDeleteConfirm(null);
      await fetchMembers();
    } catch (err) {
      toast(err.message || 'Failed to delete member.', 'error');
    }
  };

  const handleRenewMember = async (member) => {
    try {
      const { paymentResult } = await renewMemberMembership(member);

      toast(`${member.name}'s membership renewed!`, 'success');

      if (paymentResult?.memberSyncWarning) {
        toast(paymentResult.memberSyncWarning, 'info');
      }

      setRenewConfirm(null);
      await fetchMembers();
    } catch (err) {
      toast(err.message || 'Failed to renew membership.', 'error');
    }
  };

  const formatDate = (dateStr) => formatNepaliDate(dateStr, 'short');

  const getMemberStatus = (member) => {
    const today = startOfLocalDay(new Date());
    const endDate = startOfLocalDay(member.end_date);

    if (!today || !endDate) {
      return { dotClass: 'status-dot-expired', label: 'Date unavailable' };
    }

    if (member.computed_membership_status === 'expired' || endDate < today) {
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

      {error && <div className="alert alert-error">{error}</div>}

      <div className="content-card" style={{ marginBottom: '24px' }}>
        <div className="filters-bar">
          <div className="search-input-wrapper">
            <Search />
            <input
              type="text"
              className="search-input"
              placeholder="Search members..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              id="member-search-input"
            />
          </div>

          <select
            className="filter-select"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            id="status-filter"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="expired">Expired</option>
          </select>

          <select
            className="filter-select"
            value={paymentFilter}
            onChange={(event) => setPaymentFilter(event.target.value)}
            id="payment-filter"
          >
            <option value="all">All Payments</option>
            <option value="paid">Paid</option>
            <option value="unpaid">Unpaid</option>
            <option value="partial">Partial</option>
          </select>
        </div>

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
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {(() => {
                          const status = getMemberStatus(member);

                          return (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '12px' }}>
                              <span
                                className={`status-dot ${status.dotClass}`}
                                title={status.label}
                                style={{ margin: 0 }}
                              />
                            </div>
                          );
                        })()}
                        <div className="member-info-column">
                          <span className="member-name">{member.name}</span>
                          {member.email && <span className="member-email">{member.email}</span>}
                        </div>
                      </div>
                    </td>
                    <td>{member.phone}</td>
                    <td>{member.plan}</td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span style={{ fontWeight: 600 }}>
                          Rs. {member.amount?.toLocaleString()}
                        </span>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            alignSelf: 'flex-start',
                            padding: '3px 8px',
                            borderRadius: '999px',
                            color: member.balance === 0 ? 'var(--color-success)' : 'var(--color-danger)',
                            background: member.balance === 0
                              ? 'var(--color-success-bg)'
                              : 'var(--color-danger-bg)',
                          }}
                        >
                          {member.balance === 0
                            ? 'Fully paid'
                            : `Due: Rs. ${member.balance?.toLocaleString()}`}
                        </span>
                      </div>
                    </td>
                    <td>{formatDate(member.end_date)}</td>
                    <td>{getPaymentBadge(member.computed_payment_status)}</td>
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

      {showAddModal && (
        <AddMemberModal
          onClose={() => setShowAddModal(false)}
          onSave={handleAddMember}
        />
      )}

      {editMember && (
        <AddMemberModal
          editData={editMember}
          onClose={() => setEditMember(null)}
          onSave={handleEditMember}
        />
      )}

      {deleteConfirm && (
        <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="modal confirm-dialog" onClick={(event) => event.stopPropagation()}>
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

      {renewConfirm && (
        <div className="modal-overlay" onClick={() => setRenewConfirm(null)}>
          <div className="modal confirm-dialog" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h2>Renew Membership</h2>
              <button className="modal-close" onClick={() => setRenewConfirm(null)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <p>
                Renew <strong>{renewConfirm.name}</strong>&apos;s {renewConfirm.plan} membership
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
