import { useState, useEffect } from 'react';
import { getMembers } from '../lib/members';
import { X, Calendar } from 'lucide-react';

export default function AddPaymentModal({ onClose, onSave }) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  const [formData, setFormData] = useState({
    member_id: '',
    amount: '',
    payment_method: 'cash',
    payment_date: new Date().toISOString().split('T')[0],
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
    onSave({
      ...formData,
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

              <div className="form-group">
                <label>Date of Payment</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#fff', border: '1px solid var(--color-card-border)', borderRadius: 'var(--radius-md)', padding: '0 12px' }}>
                  <Calendar size={16} color="var(--color-text-muted)" />
                  <input
                    type="date"
                    className="form-input light"
                    style={{ border: 'none', paddingLeft: '4px', flex: 1 }}
                    value={formData.payment_date}
                    onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
                    required
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
