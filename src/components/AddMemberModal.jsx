import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { PLANS, getPlanPrices } from '../lib/plans';

const initialForm = {
  name: '',
  phone: '',
  email: '',
  plan: '1 Month',
  amount: '',
  start_date: new Date().toISOString().split('T')[0],
  end_date: '',
  payment_status: 'paid',
  notes: '',
};

export default function AddMemberModal({ onClose, onSave, editData }) {
  const [prices, setPrices] = useState(getPlanPrices());

  const [form, setForm] = useState(() => {
    if (editData) {
      return {
        name: editData.name || '',
        phone: editData.phone || '',
        email: editData.email || '',
        plan: editData.plan || '1 Month',
        amount: editData.amount || '',
        start_date: editData.start_date || new Date().toISOString().split('T')[0],
        end_date: editData.end_date || '',
        payment_status: editData.payment_status || 'paid',
        notes: editData.notes || '',
      };
    }
    // For new member, auto-fill the default price
    const defaultPrices = getPlanPrices();
    return {
      ...initialForm,
      amount: defaultPrices['1 Month'] || '',
    };
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (field, value) => {
    const updated = { ...form, [field]: value };

    // Auto-calculate end date when plan or start_date changes
    if (field === 'plan' || field === 'start_date') {
      const startDate = field === 'start_date' ? value : form.start_date;
      const plan = field === 'plan' ? value : form.plan;
      const planInfo = PLANS.find((p) => p.value === plan);
      if (planInfo && startDate) {
        const end = new Date(startDate);
        end.setMonth(end.getMonth() + planInfo.months);
        updated.end_date = end.toISOString().split('T')[0];
      }

      // Auto-fill price when plan changes (only if not editing)
      if (field === 'plan' && !editData) {
        updated.amount = prices[value] || '';
      }
    }

    setForm(updated);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const memberData = {
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || null,
        plan: form.plan,
        amount: parseInt(form.amount) || 0,
        start_date: form.start_date,
        end_date: form.end_date,
        status: new Date(form.end_date) >= new Date() ? 'active' : 'expired',
        payment_status: form.payment_status,
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

  // Auto-calc end date on first render if not set
  if (!form.end_date && form.start_date) {
    const planInfo = PLANS.find((p) => p.value === form.plan);
    if (planInfo) {
      const end = new Date(form.start_date);
      end.setMonth(end.getMonth() + planInfo.months);
      form.end_date = end.toISOString().split('T')[0];
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
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
                  onChange={(e) => handleChange('name', e.target.value)}
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
                  onChange={(e) => handleChange('phone', e.target.value)}
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
                  onChange={(e) => handleChange('email', e.target.value)}
                />
              </div>

              <div className="form-group">
                <label htmlFor="member-plan">Subscription Plan *</label>
                <select
                  id="member-plan"
                  className="form-select"
                  value={form.plan}
                  onChange={(e) => handleChange('plan', e.target.value)}
                >
                  {PLANS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label} — Rs. {(prices[p.value] || 0).toLocaleString()}
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
                  onChange={(e) => handleChange('amount', e.target.value)}
                  required
                  min="0"
                />
              </div>

              <div className="form-group">
                <label htmlFor="member-start">Start Date *</label>
                <input
                  id="member-start"
                  type="date"
                  className="form-input light"
                  value={form.start_date}
                  onChange={(e) => handleChange('start_date', e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="member-end">End Date</label>
                <input
                  id="member-end"
                  type="date"
                  className="form-input light"
                  value={form.end_date}
                  onChange={(e) => handleChange('end_date', e.target.value)}
                />
              </div>

              <div className="form-group">
                <label htmlFor="member-payment">Payment Status *</label>
                <select
                  id="member-payment"
                  className="form-select"
                  value={form.payment_status}
                  onChange={(e) => handleChange('payment_status', e.target.value)}
                >
                  <option value="paid">Paid</option>
                  <option value="unpaid">Unpaid</option>
                  <option value="partial">Partial</option>
                </select>
              </div>

              <div className="form-group full">
                <label htmlFor="member-notes">Notes (Optional)</label>
                <textarea
                  id="member-notes"
                  className="form-textarea"
                  placeholder="Any additional notes..."
                  value={form.notes}
                  onChange={(e) => handleChange('notes', e.target.value)}
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
