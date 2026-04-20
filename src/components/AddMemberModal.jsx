import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { PLANS, getPlanPrices } from '../lib/plans';
import NepaliDate from 'nepali-date-converter';
import Calendar from '@ideabreed/nepali-datepicker-reactjs';
import '@ideabreed/nepali-datepicker-reactjs/dist/index.css';

const getTodayBs = () => new NepaliDate().format('YYYY/MM/DD');
const adStringToBsString = (adStr) => {
  if (!adStr) return '';
  return new NepaliDate(new Date(adStr)).format('YYYY/MM/DD');
};

const initialForm = {
  name: '',
  phone: '',
  email: '',
  plan: '1 Month',
  amount: '',
  start_date: getTodayBs(),
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
        start_date: editData.start_date ? adStringToBsString(editData.start_date) : getTodayBs(),
        end_date: editData.end_date ? adStringToBsString(editData.end_date) : '',
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
        try {
          // Splitting by regex to safely accept both YYYY-MM-DD and YYYY/MM/DD from 3rd party modules
          const parts = String(startDate).split(/[-/]/).map(Number);
          if (parts.length === 3 && !parts.includes(NaN)) {
            const [y, m, d] = parts;
            const adDate = new NepaliDate(y, m - 1, d).toJsDate();
            
            adDate.setMonth(adDate.getMonth() + planInfo.months);
            
            // Convert back to BS for the form input
            updated.end_date = new NepaliDate(adDate).format('YYYY/MM/DD');
          }
        } catch (error) {
          console.warn("Auto-calculator suppressed invalid date structure:", startDate);
        }
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
      // Safely convert BS form strings to AD for database persistence
      let adStartStr = null;
      if (form.start_date) {
        const parts = String(form.start_date).split(/[-/]/).map(Number);
        if (parts.length === 3 && !parts.includes(NaN)) {
          const [sy, sm, sd] = parts;
          adStartStr = new NepaliDate(sy, sm - 1, sd).toJsDate().toISOString().split('T')[0];
        }
      }

      let adEndStr = null;
      let statusResolved = 'expired';
      if (form.end_date) {
        const parts = String(form.end_date).split(/[-/]/).map(Number);
        if (parts.length === 3 && !parts.includes(NaN)) {
          const [ey, em, ed] = parts;
          const adEnd = new NepaliDate(ey, em - 1, ed).toJsDate();
          adEndStr = adEnd.toISOString().split('T')[0];
          
          // Active check uses local date bounding
          const today = new Date();
          today.setHours(0,0,0,0);
          statusResolved = adEnd >= today ? 'active' : 'expired';
        }
      }

      const memberData = {
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || null,
        plan: form.plan,
        amount: parseInt(form.amount) || 0,
        start_date: adStartStr,
        end_date: adEndStr,
        status: statusResolved,
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

  // end_date is now initialized in useState, removing render mutation violations.

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

              <div className="form-group custom-datepicker-wrapper">
                <label htmlFor="member-start">Start Date *</label>
                <div style={{ padding: '0.4rem 0.5rem', background: 'var(--bg-lighter)', border: '1px solid var(--border-color)', borderRadius: '6px' }}>
                  <Calendar
                    key={`start-${form.start_date}`}
                    defaultDate={form.start_date}
                    dateFormat="YYYY/MM/DD"
                    onChange={({ bsDate }) => handleChange('start_date', bsDate)}
                  />
                </div>
              </div>

              <div className="form-group custom-datepicker-wrapper">
                <label>End Date</label>
                <div style={{ padding: '0.4rem 0.5rem', background: 'var(--bg-lighter)', border: '1px solid var(--border-color)', borderRadius: '6px', minWidth: '100%' }}>
                  <Calendar
                    key={`end-${form.end_date || getTodayBs()}`}
                    defaultDate={form.end_date || getTodayBs()}
                    dateFormat="YYYY/MM/DD"
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
