import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import Calendar from '@ideabreed/nepali-datepicker-reactjs';
import '@ideabreed/nepali-datepicker-reactjs/dist/index.css';
import { getMembers } from '../lib/members';
import { bsDateToAdIso, formatBsDate, normalizeBsDateInput } from '../lib/nepali-date';
import { PAYMENT_METHOD_OPTIONS } from '../lib/payment-methods';

const BS_CALENDAR_FORMAT = 'YYYY-MM-DD';

export default function AddPaymentModal({ onClose, onSave }) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    member_id: '',
    amount: '',
    payment_method: 'cash',
    payment_date: formatBsDate(new Date()),
    notes: '',
  });

  useEffect(() => {
    let active = true;

    async function loadMembers() {
      setLoading(true);
      setLoadError('');

      try {
        const data = await getMembers({ status: 'all' });
        if (!active) return;

        setMembers(data);

        const firstPayableMember = data.find((member) => (Number(member.balance) || 0) > 0);

        if (firstPayableMember) {
          setFormData((prev) => ({ ...prev, member_id: prev.member_id || firstPayableMember.id }));
        }
      } catch (err) {
        console.error('Failed to load members', err);
        if (!active) return;
        setLoadError(err.message || 'Failed to load members for payment entry.');
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadMembers();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const payableMembers = members.filter((member) => (Number(member.balance) || 0) > 0);
  const selectedMember = members.find((member) => member.id === formData.member_id) || null;
  const dueAmount = Number(selectedMember?.balance) || 0;
  const canSavePayment = !loading && payableMembers.length > 0 && !loadError;

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    const amount = Number(formData.amount);
    const adPaymentDateStr = bsDateToAdIso(formData.payment_date);

    if (!selectedMember) {
      setError('Please select a valid member.');
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Please enter a valid payment amount.');
      return;
    }

    if (!adPaymentDateStr) {
      setError('Please choose a valid payment date.');
      return;
    }

    if (dueAmount <= 0) {
      setError('This member does not have any due balance to record.');
      return;
    }

    if (amount > dueAmount) {
      setError(`Payment cannot be more than the remaining due amount of Rs. ${dueAmount.toLocaleString()}.`);
      return;
    }

    await onSave({
      ...formData,
      payment_date: adPaymentDateStr,
      amount,
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <h2>Record Manual Payment</h2>
          <button className="modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          {loadError && <div className="alert alert-error">{loadError}</div>}
          {error && <div className="alert alert-error">{error}</div>}
          {!loading && !loadError && payableMembers.length === 0 && (
            <div className="alert alert-info">
              No members currently have an outstanding balance to record a payment against.
            </div>
          )}

          {loading ? (
            <div style={{ textAlign: 'center', padding: '20px' }}>Loading members...</div>
          ) : (
            <>
              <div className="form-group">
                <label>Select Member</label>
                <select
                  className="form-select"
                  value={formData.member_id}
                  onChange={(event) => setFormData((prev) => ({ ...prev, member_id: event.target.value, amount: '' }))}
                  required
                >
                  <option value="" disabled>-- Select a member --</option>
                  {members.map((member) => (
                    <option
                      key={member.id}
                      value={member.id}
                      disabled={(Number(member.balance) || 0) <= 0}
                    >
                      {member.name} ({member.phone}){(Number(member.balance) || 0) <= 0 ? ' - Fully paid' : ''}
                    </option>
                  ))}
                </select>
                {selectedMember && (
                  <div
                    style={{
                      marginTop: 8,
                      fontSize: 12,
                      color: dueAmount > 0 ? 'var(--color-warning)' : 'var(--color-success)',
                    }}
                  >
                    {dueAmount > 0
                      ? `Current due: Rs. ${dueAmount.toLocaleString()}`
                      : 'This member is already fully paid.'}
                  </div>
                )}
              </div>

              <div className="form-group">
                <label>Amount (Rs)</label>
                <input
                  type="number"
                  className="form-input light"
                  value={formData.amount}
                  onChange={(event) => setFormData((prev) => ({ ...prev, amount: event.target.value }))}
                  placeholder="e.g. 5000"
                  min="0"
                  max={dueAmount > 0 ? dueAmount : undefined}
                  required
                />
              </div>

              <div className="form-group">
                <label>Payment Method</label>
                <select
                  className="form-select"
                  value={formData.payment_method}
                  onChange={(event) => setFormData((prev) => ({ ...prev, payment_method: event.target.value }))}
                  required
                >
                  {PAYMENT_METHOD_OPTIONS.map((method) => (
                    <option key={method.value} value={method.value}>
                      {method.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group custom-datepicker-wrapper">
                <label>Date of Payment</label>
                <div
                  style={{
                    padding: '0.4rem 0.5rem',
                    background: 'var(--color-bg)',
                    border: '1px solid var(--color-card-border)',
                    borderRadius: '10px',
                  }}
                >
                  <Calendar
                    key={`payment-${formData.payment_date}`}
                    defaultDate={formData.payment_date}
                    dateFormat={BS_CALENDAR_FORMAT}
                    language="en"
                    onChange={({ bsDate }) => {
                      setFormData((prev) => ({
                        ...prev,
                        payment_date: normalizeBsDateInput(bsDate),
                      }));
                    }}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Notes (Optional)</label>
                <textarea
                  className="form-textarea"
                  value={formData.notes}
                  onChange={(event) => setFormData((prev) => ({ ...prev, notes: event.target.value }))}
                  placeholder="e.g. Paid for 3 months in advance."
                />
              </div>
            </>
          )}

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!canSavePayment}
            >
              Save Payment
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
