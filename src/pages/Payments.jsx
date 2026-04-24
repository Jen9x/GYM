import { useEffect, useState } from 'react';
import { Banknote, PlusCircle, Trash2, X } from 'lucide-react';
import {
  PAYMENT_DELETE_WINDOW_HOURS,
  addPayment,
  deleteRecentPayment,
  getPayments,
  isPaymentDeleteAllowed,
} from '../lib/payments';
import { useToast } from '../components/Toast';
import { formatNepaliDate } from '../lib/nepali-date';
import { getPaymentMethodLabel } from '../lib/payment-methods';
import AddPaymentModal from '../components/AddPaymentModal';

export default function Payments() {
  const toast = useToast();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchPayments = async () => {
    setLoading(true);
    setError('');

    try {
      const data = await getPayments();
      setPayments(data);
    } catch (err) {
      console.error('Fetch payments error:', err);
      setError(err.message || 'Failed to load payments history.');
      toast('Failed to load payments history.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, []);

  const handleAddPayment = async (paymentData) => {
    try {
      const result = await addPayment(paymentData);
      toast('Payment recorded successfully!', 'success');

      if (result.memberSyncWarning) {
        toast(result.memberSyncWarning, 'info');
      }

      setShowAddModal(false);
      await fetchPayments();
    } catch (err) {
      toast(err.message || 'Failed to record payment.', 'error');
    }
  };

  const handleDeletePayment = async () => {
    if (!deleteConfirm) return;

    setDeleteLoading(true);

    try {
      const result = await deleteRecentPayment(deleteConfirm.id);
      toast('Payment deleted successfully.', 'success');

      if (result.memberSyncWarning) {
        toast(result.memberSyncWarning, 'info');
      }

      setDeleteConfirm(null);
      await fetchPayments();
    } catch (err) {
      toast(err.message || 'Failed to delete payment.', 'error');
    } finally {
      setDeleteLoading(false);
    }
  };

  const formatDate = (dateStr) => formatNepaliDate(dateStr, 'long');

  const getMethodBadge = (method) => {
    return (
      <span
        style={{
          background: 'var(--color-bg)',
          padding: '4px 8px',
          borderRadius: 'var(--radius-sm)',
          fontSize: '12px',
          fontWeight: 500,
          color: 'var(--color-text-secondary)',
          border: '1px solid var(--color-card-border)',
        }}
      >
        {getPaymentMethodLabel(method)}
      </span>
    );
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-header-text">
          <h1>Payment Ledger</h1>
          <p>Manual record of all physical and transferred payments received.</p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => setShowAddModal(true)}
          id="record-payment-btn"
        >
          <PlusCircle size={18} />
          Record Payment
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="content-card">
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date Paid</th>
                <th>Member Name</th>
                <th>Amount</th>
                <th>Method</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '48px' }}>
                    <div className="spinner spinner-dark" style={{ margin: '0 auto', width: 24, height: 24 }} />
                  </td>
                </tr>
              ) : payments.length === 0 ? (
                <tr>
                  <td colSpan="5">
                    <div className="empty-state">
                      <Banknote size={48} color="var(--color-text-muted)" style={{ marginBottom: '16px' }} />
                      <p style={{ color: 'var(--color-primary)', fontWeight: 600 }}>No payments recorded yet.</p>
                      <p style={{ color: 'var(--color-text-muted)', fontSize: '14px', marginTop: '4px' }}>
                        Click &apos;Record Payment&apos; to add your first entry.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                payments.map((payment) => (
                  <tr key={payment.id}>
                    <td>
                      <span style={{ fontWeight: 500, color: 'var(--color-text)' }}>
                        {formatDate(payment.payment_date)}
                      </span>
                      {isPaymentDeleteAllowed(payment) && (
                        <div style={{ marginTop: 8 }}>
                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            onClick={() => setDeleteConfirm(payment)}
                            title={`Delete payments recorded within ${PAYMENT_DELETE_WINDOW_HOURS} hour`}
                          >
                            <Trash2 size={14} />
                            Delete
                          </button>
                        </div>
                      )}
                    </td>
                    <td>
                      <span className="member-name">
                        {payment.members?.name || 'Unknown Member'}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontWeight: 700, color: 'var(--color-success)' }}>
                        Rs. {payment.amount?.toLocaleString()}
                      </span>
                    </td>
                    <td>{getMethodBadge(payment.payment_method)}</td>
                    <td>
                      <span style={{ color: 'var(--color-text-secondary)', fontSize: '13px' }}>
                        {payment.notes || '-'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showAddModal && (
        <AddPaymentModal
          onClose={() => setShowAddModal(false)}
          onSave={handleAddPayment}
        />
      )}

      {deleteConfirm && (
        <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="modal confirm-dialog" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h2>Delete Payment</h2>
              <button className="modal-close" onClick={() => setDeleteConfirm(null)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <p>
                Delete the <strong>Rs. {Number(deleteConfirm.amount || 0).toLocaleString()}</strong> payment
                for <strong>{deleteConfirm.members?.name || 'this member'}</strong>?
              </p>
              <p style={{ marginTop: 12, fontSize: 13, color: 'var(--color-text-muted)' }}>
                This is only allowed for payments recorded within the last {PAYMENT_DELETE_WINDOW_HOURS} hour.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDeleteConfirm(null)}>
                Cancel
              </button>
              <button
                className="btn btn-danger"
                onClick={handleDeletePayment}
                disabled={deleteLoading}
                id="confirm-delete-payment-btn"
              >
                {deleteLoading ? (
                  <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                ) : (
                  <>
                    <Trash2 size={16} />
                    Delete Payment
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
