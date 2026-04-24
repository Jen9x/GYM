import { useEffect, useRef, useState } from 'react';
import { Edit3, MoreHorizontal, RefreshCw, Search, Trash2, UserPlus, Users, X } from 'lucide-react';
import { getMembers, deleteMember } from '../lib/members';
import {
  createMemberWithInitialPayment,
  renewMemberMembership,
  updateMemberWithPaymentAdjustment,
} from '../lib/member-actions';
import { useToast } from '../components/Toast';
import {
  getMemberPackageLabel,
  getPersonalTrainingAmount,
  getSubscriptionAmount,
  hasPersonalTraining,
} from '../lib/member-package';
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
  const [openActionMenuId, setOpenActionMenuId] = useState(null);
  const activeActionMenuRef = useRef(null);

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
    const timer = setTimeout(() => {
      fetchMembers();
    }, 300);

    return () => clearTimeout(timer);
  }, [search, statusFilter, paymentFilter]);

  useEffect(() => {
    if (!openActionMenuId) return undefined;

    const handlePointerDown = (event) => {
      if (activeActionMenuRef.current?.contains(event.target)) return;
      setOpenActionMenuId(null);
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setOpenActionMenuId(null);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [openActionMenuId]);

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

    if (diffDays === 0) {
      return { dotClass: 'status-dot-expiring', label: 'Ends today' };
    }

    if (diffDays <= 7) {
      return {
        dotClass: 'status-dot-expiring',
        label: diffDays === 1 ? '1 day left' : `${diffDays} days left`,
      };
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

  const toggleActionMenu = (memberId) => {
    setOpenActionMenuId((currentId) => (currentId === memberId ? null : memberId));
  };

  const hasActiveFilters = search || statusFilter !== 'all' || paymentFilter !== 'all';
  const shouldShowDueSummary = paymentFilter === 'unpaid' || paymentFilter === 'partial';
  const shouldShowPaidSummary = paymentFilter === 'paid' || paymentFilter === 'partial';
  const filteredDueTotal = shouldShowDueSummary
    ? members.reduce((sum, member) => sum + (Number(member.balance) || 0), 0)
    : 0;
  const filteredPaidTotal = shouldShowPaidSummary
    ? members.reduce((sum, member) => {
      const paidThisPeriod = Number(member.paid_this_period) || 0;
      return sum + (paidThisPeriod || (paymentFilter === 'paid' ? Number(member.amount) || 0 : 0));
    }, 0)
    : 0;

  return (
    <div>
      <div className="page-header">
        <div className="page-header-text">
          <div className="members-header-title">
            <h1>Members</h1>
            <span className="members-count-pill" aria-live="polite">
              <span className="members-count-dot" />
              {loading ? 'Loading...' : `${members.length} member${members.length !== 1 ? 's' : ''}`}
            </span>
          </div>
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

        {(hasActiveFilters || shouldShowDueSummary || shouldShowPaidSummary) && (
          <div className="member-list-summary">
            {shouldShowDueSummary && (
              <span className="member-list-summary-due">
                Total Due: Rs. {filteredDueTotal.toLocaleString()}
              </span>
            )}
            {shouldShowPaidSummary && (
              <span className="member-list-summary-paid">
                Total Collected: Rs. {filteredPaidTotal.toLocaleString()}
              </span>
            )}
            {hasActiveFilters && <span>Showing filtered results</span>}
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: '48px' }}>
            <div className="spinner spinner-dark" style={{ margin: '0 auto', width: 24, height: 24 }} />
          </div>
        ) : members.length === 0 ? (
          <div className="empty-state">
            <Users />
            <p style={{ color: 'var(--color-primary)' }}>No members found.</p>
          </div>
        ) : (
          <div className="table-container members-table-container">
            <table className="data-table members-table">
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Package</th>
                  <th>Amount</th>
                  <th>Expiry</th>
                  <th>Payment</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {members.map((member) => {
                  const personalTrainingEnabled = hasPersonalTraining(member);
                  const subscriptionAmount = getSubscriptionAmount(member);
                  const personalTrainingAmount = getPersonalTrainingAmount(member);
                  const status = getMemberStatus(member);
                  const canRenewMember = member.computed_membership_status === 'expired';

                  return (
                    <tr key={member.id}>
                      <td>
                        <div className="members-row-primary">
                          <span
                            className={`status-dot ${status.dotClass}`}
                            title={status.label}
                            style={{ margin: 0 }}
                          />
                          <div className="member-info-column">
                            <span className="member-name">{member.name}</span>
                            <span className="member-email">{member.phone || member.email || 'No contact'}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="members-cell-stack">
                          <span className="members-plan-pill">{member.plan}</span>
                          {personalTrainingEnabled && (
                            <span className="members-cell-secondary">PT: {member.personal_training_plan}</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="members-cell-stack">
                          <span className="members-money">Rs. {member.amount?.toLocaleString()}</span>
                          <span className="members-cell-secondary">
                            Sub: Rs. {subscriptionAmount.toLocaleString()}
                            {personalTrainingEnabled ? ` | PT: Rs. ${personalTrainingAmount.toLocaleString()}` : ''}
                          </span>
                          {member.balance > 0 && (
                            <div className="members-badges-row">
                              <span className="member-balance-pill is-due">
                                Due: Rs. {member.balance?.toLocaleString()}
                              </span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="members-cell-stack">
                          <span className="members-cell-primary">{formatDate(member.end_date)}</span>
                          <span className="members-cell-secondary">{status.label}</span>
                        </div>
                      </td>
                      <td>
                        <div className="members-payment-cell">
                          {getPaymentBadge(member.computed_payment_status)}
                        </div>
                      </td>
                      <td className="members-actions-cell">
                        <div
                          className="action-menu"
                          ref={openActionMenuId === member.id ? activeActionMenuRef : null}
                        >
                          <button
                            className={`action-btn action-menu-trigger${openActionMenuId === member.id ? ' active' : ''}`}
                            title="Open actions"
                            aria-label={`Open actions for ${member.name}`}
                            aria-haspopup="menu"
                            aria-expanded={openActionMenuId === member.id}
                            onClick={() => toggleActionMenu(member.id)}
                          >
                            <MoreHorizontal />
                          </button>

                          {openActionMenuId === member.id && (
                            <div className="action-menu-popover" role="menu" aria-label={`${member.name} actions`}>
                              <button
                                className="action-menu-item"
                                type="button"
                                onClick={() => {
                                  setOpenActionMenuId(null);
                                  setEditMember(member);
                                }}
                              >
                                <Edit3 />
                                Edit Member
                              </button>
                              <button
                                className="action-menu-item"
                                type="button"
                                disabled={!canRenewMember}
                                title={canRenewMember ? 'Renew membership' : 'Renewal is available after the membership expires'}
                                onClick={() => {
                                  if (!canRenewMember) return;
                                  setOpenActionMenuId(null);
                                  setRenewConfirm(member);
                                }}
                              >
                                <RefreshCw />
                                {canRenewMember ? 'Renew Membership' : 'Renew After Expiry'}
                              </button>
                              <button
                                className="action-menu-item danger"
                                type="button"
                                onClick={() => {
                                  setOpenActionMenuId(null);
                                  setDeleteConfirm(member);
                                }}
                              >
                                <Trash2 />
                                Delete Member
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
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
                Renew <strong>{renewConfirm.name}</strong>&apos;s {getMemberPackageLabel(renewConfirm)}
                for <strong>Rs. {renewConfirm.amount?.toLocaleString()}</strong>?
              </p>
              {hasPersonalTraining(renewConfirm) && (
                <p style={{ marginTop: 12, fontSize: 13, color: 'var(--color-text-muted)' }}>
                  This will refresh both the subscription and personal trainer dates using the member&apos;s saved plans.
                </p>
              )}
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
