import { useState, useEffect } from 'react';
import { getMembers } from '../lib/members';
import { X, Calendar as CalendarIcon } from 'lucide-react';
import NepaliDate from 'nepali-date-converter';
import Calendar from '@ideabreed/nepali-datepicker-reactjs';
import '@ideabreed/nepali-datepicker-reactjs/dist/index.css';

export default function AddPaymentModal({ onClose, onSave }) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  const [formData, setFormData] = useState({
    member_id: '',
    amount: '',
    payment_method: 'cash',
    payment_date: new NepaliDate().format('YYYY/MM/DD'),
    notes: '',
  });

  useEffect(() => {
    async function loadMembers() {
      try {
        const data = await getMembers({ status: 'all' });
        setMembers(data);
        if (data.length > 0) {
          setFormData((prev) => ({ ...prev, member_id: data[0].id }));
        }
      } catch (err) {
        console.error('Failed to load members', err);
      } finally {
        setLoading(false);
      }
    }
    loadMembers();
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();

    let adPaymentDateStr = null;
    if (formData.payment_date) {
      const [py, pm, pd] = formData.payment_date.split('-').map(Number);
      adPaymentDateStr = new NepaliDate(py, pm - 1, pd).toJsDate().toISOString().split('T')[0];
    }

    onSave({
      ...formData,
      payment_date: adPaymentDateStr,
      amount: Number(formData.amount),
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Record Manual Payment</h2>
          <button className="modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          {loading ? (
            <div style={{ textAlign: 'center', padding: '20px' }}>Loading members...</div>
          ) : (
            <>
              <div className="form-group">
                <label>Select Member</label>
                <select
                  className="form-select"
                  value={formData.member_id}
                  onChange={(e) => setFormData({ ...formData, member_id: e.target.value })}
                  required
                >
                  <option value="" disabled>-- Select a member --</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.phone})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Amount (Rs)</label>
                <input
                  type="number"
                  className="form-input light"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  placeholder="e.g. 5000"
                  min="0"
                  required
                />
              </div>

              <div className="form-group">
                <label>Payment Method</label>
                <select
                  className="form-select"
                  value={formData.payment_method}
                  onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                  required
                >
                  <option value="cash">Cash</option>
                  <option value="esewa">eSewa</option>
                  <option value="khalti">Khalti</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="cheque">Cheque</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div className="form-group custom-datepicker-wrapper">
                <label>Date of Payment</label>
                <div style={{ padding: '0.4rem 0.5rem', background: 'var(--bg-lighter)', border: '1px solid var(--border-color)', borderRadius: '6px' }}>
                  <Calendar
                    defaultDate={formData.payment_date}
                    dateFormat="YYYY/MM/DD"
                    onChange={({ bsDate }) => setFormData({ ...formData, payment_date: bsDate })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Notes (Optional)</label>
                <textarea
                  className="form-textarea"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="e.g. Paid for 3 months in advance."
                />
              </div>
            </>
          )}

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading || members.length === 0}>
              Save Payment
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
