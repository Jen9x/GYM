import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { PLANS, getPlanPrices, loadPlanPrices } from '../lib/plans';
import {
  addBsMonths,
  bsDateToAdIso,
  formatBsDate,
  normalizeBsDateInput,
  startOfLocalDay,
} from '../lib/nepali-date';
import Calendar from '@ideabreed/nepali-datepicker-reactjs';
import '@ideabreed/nepali-datepicker-reactjs/dist/index.css';

const BS_CALENDAR_FORMAT = 'YYYY-MM-DD';
const getTodayBs = () => formatBsDate(new Date());

const initialForm = {
  name: '',
  phone: '',
  email: '',
  plan: '1 Month',
  amount: '',
  paid_amount: '',
  start_date: getTodayBs(),
  end_date: '',
  payment_status: 'paid',
  notes: '',
};

function getPlanDuration(plan) {
  return PLANS.find((entry) => entry.value === plan)?.months || 1;
}

function getAutoEndDate(startDate, plan) {
  if (!startDate) return '';
  return addBsMonths(startDate, getPlanDuration(plan));
}

function buildMemberForm(editData, prices) {
  if (editData) {
    const startDate = formatBsDate(editData.start_date) || getTodayBs();
    const endDate = formatBsDate(editData.end_date) || getAutoEndDate(startDate, editData.plan || '1 Month');
    const resolvedPaymentStatus = editData.computed_payment_status || editData.payment_status || 'paid';
    const recordedPaidAmount = Number(editData.paid_this_period);

    return {
      name: editData.name || '',
      phone: editData.phone || '',
      email: editData.email || '',
      plan: editData.plan || '1 Month',
      amount: editData.amount ?? '',
      paid_amount: recordedPaidAmount > 0
        ? String(recordedPaidAmount)
        : resolvedPaymentStatus === 'paid' && editData.amount != null
          ? String(editData.amount)
          : '',
      start_date: startDate,
      end_date: endDate,
      payment_status: resolvedPaymentStatus,
      notes: editData.notes || '',
    };
  }

  const startDate = getTodayBs();
  const defaultAmount = prices['1 Month'] || '';

  return {
    ...initialForm,
    amount: defaultAmount,
    paid_amount: defaultAmount ? String(defaultAmount) : '',
    start_date: startDate,
    end_date: getAutoEndDate(startDate, '1 Month'),
  };
}

export default function AddMemberModal({ onClose, onSave, editData }) {
  const [initialPrices] = useState(() => getPlanPrices());
  const [prices, setPrices] = useState(initialPrices);
  const [form, setForm] = useState(() => buildMemberForm(editData, initialPrices));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const totalAmount = Number.parseInt(form.amount, 10) || 0;
  const paidAmount = Number.parseInt(form.paid_amount, 10) || 0;
  const remainingAmount = Math.max(0, totalAmount - paidAmount);

  useEffect(() => {
    let active = true;

    async function syncPrices() {
      const remotePrices = await loadPlanPrices();
      if (!active) return;

      setPrices(remotePrices);

      if (!editData) {
        setForm((currentForm) => {
          const currentPlan = currentForm.plan || '1 Month';
          const localAmount = initialPrices[currentPlan] || '';
          const remoteAmount = remotePrices[currentPlan] || '';
          const shouldRefreshAmount = currentForm.amount === '' || Number(currentForm.amount) === Number(localAmount);

          if (!shouldRefreshAmount) return currentForm;

          return {
            ...currentForm,
            amount: remoteAmount,
            paid_amount: currentForm.payment_status === 'paid' && remoteAmount
              ? String(remoteAmount)
              : currentForm.paid_amount,
          };
        });
      }
    }

    syncPrices();

    return () => {
      active = false;
    };
  }, [editData, initialPrices]);

  const handleChange = (field, value) => {
    const safeValue = field.includes('date') ? normalizeBsDateInput(value) : value;

    setForm((currentForm) => {
      const updated = { ...currentForm, [field]: safeValue };

      if (field === 'plan' || field === 'start_date') {
        const startDate = field === 'start_date' ? safeValue : currentForm.start_date;
        const plan = field === 'plan' ? safeValue : currentForm.plan;

        updated.end_date = getAutoEndDate(startDate, plan);

        if (field === 'plan' && !editData) {
          updated.amount = prices[safeValue] || '';

          if (updated.payment_status === 'paid') {
            updated.paid_amount = updated.amount ? String(updated.amount) : '';
          }
        }
      }

      if (field === 'amount') {
        if (updated.payment_status === 'paid') {
          updated.paid_amount = safeValue ? String(safeValue) : '';
        }

        if (updated.payment_status === 'partial' && Number(updated.paid_amount) >= Number(safeValue || 0)) {
          updated.paid_amount = '';
        }
      }

      if (field === 'payment_status') {
        if (safeValue === 'paid') {
          updated.paid_amount = updated.amount ? String(updated.amount) : '';
        }

        if (safeValue === 'unpaid') {
          updated.paid_amount = '';
        }

        if (safeValue === 'partial' && Number(updated.paid_amount) >= Number(updated.amount || 0)) {
          updated.paid_amount = '';
        }
      }

      return updated;
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      const startDate = normalizeBsDateInput(form.start_date);
      const endDate = normalizeBsDateInput(form.end_date) || getAutoEndDate(startDate || getTodayBs(), form.plan);
      const adStartStr = bsDateToAdIso(startDate);
      const adEndStr = bsDateToAdIso(endDate);
      const membershipAmount = Number.parseInt(form.amount, 10) || 0;

      if (!membershipAmount) {
        throw new Error('Please enter a valid membership amount.');
      }

      if (!adStartStr) {
        throw new Error('Please select a valid start date.');
      }

      if (!adEndStr) {
        throw new Error('Please select a valid end date.');
      }

      let resolvedPaidAmount = 0;

      if (form.payment_status === 'paid') {
        resolvedPaidAmount = membershipAmount;
      }

      if (form.payment_status === 'partial') {
        resolvedPaidAmount = Number.parseInt(form.paid_amount, 10) || 0;

        if (!resolvedPaidAmount) {
          throw new Error('Enter how much the member paid.');
        }

        if (resolvedPaidAmount >= membershipAmount) {
          throw new Error('Partial payment must be less than the full amount. Choose Paid if they paid everything.');
        }
      }

      const resolvedPaymentStatus = resolvedPaidAmount <= 0
        ? 'unpaid'
        : resolvedPaidAmount >= membershipAmount
          ? 'paid'
          : 'partial';

      const today = startOfLocalDay(new Date());
      const resolvedEndDate = startOfLocalDay(adEndStr);
      const statusResolved = today && resolvedEndDate && resolvedEndDate >= today ? 'active' : 'expired';

      const memberData = {
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || null,
        plan: form.plan,
        amount: membershipAmount,
        paid_amount: resolvedPaidAmount,
        start_date: adStartStr,
        end_date: adEndStr,
        status: statusResolved,
        payment_status: resolvedPaymentStatus,
        notes: form.notes.trim() || null,
      };

      await onSave(memberData);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to save member.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <h2>{editData ? 'Edit Member' : 'Add New Member'}</h2>
          <button className="modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="alert alert-error">{error}</div>}

            <div className="form-grid">
              <div className="form-group full">
                <label htmlFor="member-name">Full Name *</label>
                <input
                  id="member-name"
                  type="text"
                  className="form-input light"
                  placeholder="Enter member's full name"
                  value={form.name}
                  onChange={(event) => handleChange('name', event.target.value)}
                  required
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label htmlFor="member-phone">Phone Number *</label>
                <input
                  id="member-phone"
                  type="tel"
                  className="form-input light"
                  placeholder="+977 98XXXXXXXX"
                  value={form.phone}
                  onChange={(event) => handleChange('phone', event.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="member-email">Email (Optional)</label>
                <input
                  id="member-email"
                  type="email"
                  className="form-input light"
                  placeholder="email@example.com"
                  value={form.email}
                  onChange={(event) => handleChange('email', event.target.value)}
                />
              </div>

              <div className="form-group">
                <label htmlFor="member-plan">Subscription Plan *</label>
                <select
                  id="member-plan"
                  className="form-select"
                  value={form.plan}
                  onChange={(event) => handleChange('plan', event.target.value)}
                >
                  {PLANS.map((plan) => (
                    <option key={plan.value} value={plan.value}>
                      {plan.label} - Rs. {(prices[plan.value] || 0).toLocaleString()}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="member-amount">Amount (Rs.) *</label>
                <input
                  id="member-amount"
                  type="number"
                  className="form-input light"
                  placeholder="e.g. 1500"
                  value={form.amount}
                  onChange={(event) => handleChange('amount', event.target.value)}
                  required
                  min="0"
                />
              </div>

              <div className="form-group custom-datepicker-wrapper">
                <label htmlFor="member-start">Start Date *</label>
                <div
                  style={{
                    padding: '0.4rem 0.5rem',
                    background: 'var(--color-bg)',
                    border: '1px solid var(--color-card-border)',
                    borderRadius: '10px',
                  }}
                >
                  <Calendar
                    key={`start-${form.start_date}`}
                    defaultDate={form.start_date}
                    dateFormat={BS_CALENDAR_FORMAT}
                    language="en"
                    onChange={({ bsDate }) => handleChange('start_date', bsDate)}
                  />
                </div>
              </div>

              <div className="form-group custom-datepicker-wrapper">
                <label>End Date</label>
                <div
                  style={{
                    padding: '0.4rem 0.5rem',
                    background: 'var(--color-bg)',
                    border: '1px solid var(--color-card-border)',
                    borderRadius: '10px',
                    minWidth: '100%',
                  }}
                >
                  <Calendar
                    key={`end-${form.end_date || form.start_date || getTodayBs()}`}
                    defaultDate={form.end_date || getTodayBs()}
                    dateFormat={BS_CALENDAR_FORMAT}
                    language="en"
                    onChange={({ bsDate }) => handleChange('end_date', bsDate)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="member-payment">Payment Status *</label>
                <select
                  id="member-payment"
                  className="form-select"
                  value={form.payment_status}
                  onChange={(event) => handleChange('payment_status', event.target.value)}
                >
                  <option value="paid">Paid</option>
                  <option value="unpaid">Unpaid</option>
                  <option value="partial">Partial</option>
                </select>
              </div>

              {form.payment_status === 'partial' && (
                <div className="form-group">
                  <label htmlFor="member-paid-amount">Amount Received (Rs.) *</label>
                  <input
                    id="member-paid-amount"
                    type="number"
                    className="form-input light"
                    placeholder="Enter amount received"
                    value={form.paid_amount}
                    onChange={(event) => handleChange('paid_amount', event.target.value)}
                    required
                    min="1"
                    max={Math.max(0, totalAmount - 1) || undefined}
                  />
                  <div
                    style={{
                      marginTop: 8,
                      fontSize: 12,
                      color: paidAmount > 0 && paidAmount < totalAmount
                        ? 'var(--color-success)'
                        : 'var(--color-text-muted)',
                    }}
                  >
                    {paidAmount > 0 && paidAmount < totalAmount
                      ? `Remaining balance: Rs. ${remainingAmount.toLocaleString()}`
                      : 'Enter the amount received now so the remaining balance is tracked correctly.'}
                  </div>
                </div>
              )}

              <div className="form-group full">
                <label htmlFor="member-notes">Notes (Optional)</label>
                <textarea
                  id="member-notes"
                  className="form-textarea"
                  placeholder="Any additional notes..."
                  value={form.notes}
                  onChange={(event) => handleChange('notes', event.target.value)}
                  rows={3}
                />
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              id="save-member-btn"
            >
              {loading ? <div className="spinner" /> : editData ? 'Update Member' : 'Add Member'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
