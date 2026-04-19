import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { updatePassword, getCurrentUser } from '../lib/auth';
import { PLANS, getPlanPrices, savePlanPrices } from '../lib/plans';
import {
  Shield,
  Key,
  Bell,
  Database,
  Save,
  CheckCircle,
  AlertCircle,
  Eye,
  EyeOff,
  Trash2,
  X,
  Download,
  DollarSign,
} from 'lucide-react';

export default function Settings() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Password change state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState(null);

  // Plan pricing state
  const [prices, setPrices] = useState(getPlanPrices());
  const [pricesLoading, setPricesLoading] = useState(false);
  const [pricesMessage, setPricesMessage] = useState(null);

  // Data management state
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [dataMessage, setDataMessage] = useState(null);

  useEffect(() => {
    fetchUser();
  }, []);

  const fetchUser = async () => {
    try {
      const userData = await getCurrentUser();
      setUser(userData);
    } catch (err) {
      console.error('Failed to fetch user:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPasswordMessage(null);

    if (newPassword.length < 6) {
      setPasswordMessage({ type: 'error', text: 'Password must be at least 6 characters.' });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordMessage({ type: 'error', text: 'Passwords do not match.' });
      return;
    }

    setPasswordLoading(true);
    try {
      await updatePassword(newPassword);
      setPasswordMessage({ type: 'success', text: 'Password updated successfully!' });
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPasswordMessage({ type: 'error', text: err.message || 'Failed to update password.' });
    } finally {
      setPasswordLoading(false);
    }
  };

  const handlePriceChange = (planValue, newPrice) => {
    setPrices((prev) => ({
      ...prev,
      [planValue]: newPrice === '' ? '' : parseInt(newPrice) || 0,
    }));
  };

  const handleSavePrices = () => {
    setPricesLoading(true);
    setPricesMessage(null);
    try {
      // Convert any empty strings to 0 before saving
      const cleanedPrices = {};
      Object.keys(prices).forEach((key) => {
        cleanedPrices[key] = parseInt(prices[key]) || 0;
      });
      savePlanPrices(cleanedPrices);
      setPrices(cleanedPrices);
      setPricesMessage({ type: 'success', text: 'Subscription prices saved successfully!' });
    } catch (err) {
      setPricesMessage({ type: 'error', text: 'Failed to save prices.' });
    } finally {
      setPricesLoading(false);
    }
  };

  const handleExportData = async () => {
    setExportLoading(true);
    setDataMessage(null);
    try {
      const { data: members } = await supabase.from('members').select('*');
      const { data: payments } = await supabase.from('payments').select('*');

      const exportData = {
        exportDate: new Date().toISOString(),
        members: members || [],
        payments: payments || [],
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `gym_data_backup_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);

      setDataMessage({ type: 'success', text: 'Data exported successfully!' });
    } catch (err) {
      setDataMessage({ type: 'error', text: 'Failed to export data.' });
    } finally {
      setExportLoading(false);
    }
  };

  const handleDeleteAllMembers = async () => {
    setDeleteLoading(true);
    setDataMessage(null);
    try {
      // Delete all payments first (foreign key dependency)
      const { error: payError } = await supabase.from('payments').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (payError) throw payError;

      // Then delete all members
      const { error: memError } = await supabase.from('members').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (memError) throw memError;

      setDataMessage({ type: 'success', text: 'All member data has been deleted.' });
      setShowDeleteAllConfirm(false);
    } catch (err) {
      setDataMessage({ type: 'error', text: err.message || 'Failed to delete data.' });
    } finally {
      setDeleteLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '100px' }}>
        <div className="spinner spinner-dark" style={{ width: 32, height: 32 }} />
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-header-text">
          <h1>Settings</h1>
          <p>Manage your account, pricing, and application preferences.</p>
        </div>
      </div>

      {/* Account Info */}
      <div className="settings-section">
        <div className="settings-section-header">
          <Shield size={20} style={{ color: 'var(--color-primary)', marginRight: 10, verticalAlign: 'middle' }} />
          <h3 style={{ display: 'inline' }}>Account Information</h3>
        </div>
        <p className="section-desc">Your authenticated account details.</p>

        <div className="form-grid">
          <div className="form-group">
            <label>Email Address</label>
            <input
              type="text"
              className="form-input light"
              value={user?.email || ''}
              disabled
              style={{ opacity: 0.7, cursor: 'not-allowed' }}
              id="settings-email"
            />
          </div>
          <div className="form-group">
            <label>Account Created</label>
            <input
              type="text"
              className="form-input light"
              value={user?.created_at ? new Date(user.created_at).toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              }) : '—'}
              disabled
              style={{ opacity: 0.7, cursor: 'not-allowed' }}
              id="settings-created"
            />
          </div>
          <div className="form-group">
            <label>Last Sign In</label>
            <input
              type="text"
              className="form-input light"
              value={user?.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              }) : '—'}
              disabled
              style={{ opacity: 0.7, cursor: 'not-allowed' }}
              id="settings-last-signin"
            />
          </div>
          <div className="form-group">
            <label>User ID</label>
            <input
              type="text"
              className="form-input light"
              value={user?.id || '—'}
              disabled
              style={{ opacity: 0.7, cursor: 'not-allowed', fontSize: 12 }}
              id="settings-user-id"
            />
          </div>
        </div>
      </div>

      {/* Subscription Pricing */}
      <div className="settings-section">
        <div className="settings-section-header">
          <DollarSign size={20} style={{ color: 'var(--color-primary)', marginRight: 10, verticalAlign: 'middle' }} />
          <h3 style={{ display: 'inline' }}>Subscription Pricing</h3>
        </div>
        <p className="section-desc">Set the default price for each subscription plan. These prices auto-fill when adding new members.</p>

        {pricesMessage && (
          <div className={`alert alert-${pricesMessage.type}`}>
            {pricesMessage.type === 'success' ? (
              <CheckCircle size={16} style={{ marginRight: 8, verticalAlign: 'middle' }} />
            ) : (
              <AlertCircle size={16} style={{ marginRight: 8, verticalAlign: 'middle' }} />
            )}
            {pricesMessage.text}
          </div>
        )}

        <div className="pricing-grid">
          {PLANS.map((plan) => (
            <div className="pricing-item" key={plan.value}>
              <label htmlFor={`price-${plan.value}`}>
                <span className="pricing-label">{plan.label}</span>
                <span className="pricing-duration">{plan.months} month{plan.months > 1 ? 's' : ''}</span>
              </label>
              <div className="pricing-input-wrapper">
                <span className="pricing-currency">Rs.</span>
                <input
                  id={`price-${plan.value}`}
                  type="number"
                  className="form-input light pricing-input"
                  value={prices[plan.value] ?? ''}
                  onChange={(e) => handlePriceChange(plan.value, e.target.value)}
                  min="0"
                  placeholder="0"
                />
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 20 }}>
          <button
            className="btn btn-primary btn-sm"
            onClick={handleSavePrices}
            disabled={pricesLoading}
            id="save-prices-btn"
          >
            {pricesLoading ? (
              <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
            ) : (
              <>
                <Save size={16} />
                Save Prices
              </>
            )}
          </button>
        </div>
      </div>

      {/* Change Password */}
      <div className="settings-section">
        <div className="settings-section-header">
          <Key size={20} style={{ color: 'var(--color-primary)', marginRight: 10, verticalAlign: 'middle' }} />
          <h3 style={{ display: 'inline' }}>Change Password</h3>
        </div>
        <p className="section-desc">Update your account password. Use a strong password with at least 6 characters.</p>

        {passwordMessage && (
          <div className={`alert alert-${passwordMessage.type}`}>
            {passwordMessage.type === 'success' ? (
              <CheckCircle size={16} style={{ marginRight: 8, verticalAlign: 'middle' }} />
            ) : (
              <AlertCircle size={16} style={{ marginRight: 8, verticalAlign: 'middle' }} />
            )}
            {passwordMessage.text}
          </div>
        )}

        <form onSubmit={handlePasswordChange}>
          <div className="form-grid">
            <div className="form-group">
              <label>New Password</label>
              <div className="password-input-wrapper">
                <input
                  type={showNewPass ? 'text' : 'password'}
                  className="form-input light"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  required
                  id="settings-new-password"
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowNewPass(!showNewPass)}
                >
                  {showNewPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div className="form-group">
              <label>Confirm New Password</label>
              <div className="password-input-wrapper">
                <input
                  type={showConfirmPass ? 'text' : 'password'}
                  className="form-input light"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  required
                  id="settings-confirm-password"
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowConfirmPass(!showConfirmPass)}
                >
                  {showConfirmPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          </div>
          <div style={{ marginTop: 8 }}>
            <button
              type="submit"
              className="btn btn-primary btn-sm"
              disabled={passwordLoading}
              id="save-password-btn"
            >
              {passwordLoading ? (
                <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
              ) : (
                <>
                  <Save size={16} />
                  Update Password
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Data Management */}
      <div className="settings-section">
        <div className="settings-section-header">
          <Database size={20} style={{ color: 'var(--color-primary)', marginRight: 10, verticalAlign: 'middle' }} />
          <h3 style={{ display: 'inline' }}>Data Management</h3>
        </div>
        <p className="section-desc">Export or clear your gym data. Exports include all members and payment records.</p>

        {dataMessage && (
          <div className={`alert alert-${dataMessage.type}`}>
            {dataMessage.type === 'success' ? (
              <CheckCircle size={16} style={{ marginRight: 8, verticalAlign: 'middle' }} />
            ) : (
              <AlertCircle size={16} style={{ marginRight: 8, verticalAlign: 'middle' }} />
            )}
            {dataMessage.text}
          </div>
        )}

        <div className="data-actions">
          <button
            className="btn btn-secondary"
            onClick={handleExportData}
            disabled={exportLoading}
            id="export-data-btn"
          >
            {exportLoading ? (
              <div className="spinner spinner-dark" style={{ width: 16, height: 16, borderWidth: 2 }} />
            ) : (
              <>
                <Download size={16} />
                Export All Data (JSON)
              </>
            )}
          </button>

          <button
            className="btn btn-danger"
            onClick={() => setShowDeleteAllConfirm(true)}
            id="delete-all-btn"
          >
            <Trash2 size={16} />
            Delete All Member Data
          </button>
        </div>
      </div>

      {/* Delete All Confirmation Modal */}
      {showDeleteAllConfirm && (
        <div className="modal-overlay" onClick={() => setShowDeleteAllConfirm(false)}>
          <div className="modal confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>⚠️ Delete All Data</h2>
              <button className="modal-close" onClick={() => setShowDeleteAllConfirm(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <p>
                This will permanently delete <strong>all members</strong> and <strong>all payment records</strong>.
                This action <strong>cannot be undone</strong>.
              </p>
              <p style={{ marginTop: 12, fontSize: 13, color: 'var(--color-text-muted)' }}>
                It is recommended to export a backup before proceeding.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowDeleteAllConfirm(false)}>
                Cancel
              </button>
              <button
                className="btn btn-danger"
                onClick={handleDeleteAllMembers}
                disabled={deleteLoading}
                id="confirm-delete-all-btn"
              >
                {deleteLoading ? (
                  <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                ) : (
                  <>
                    <Trash2 size={16} />
                    Delete Everything
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
