import { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle,
  Database,
  DollarSign,
  Download,
  Eye,
  EyeOff,
  Key,
  Save,
  Shield,
  Trash2,
  X,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getCurrentUser, updatePassword } from '../lib/auth';
import {
  PERSONAL_TRAINER_PLANS,
  PLANS,
  getPersonalTrainerPrices,
  getPlanPrices,
  loadPersonalTrainerPrices,
  loadPlanPrices,
  savePersonalTrainerPrices,
  savePlanPrices,
} from '../lib/plans';

const EM_DASH = '\u2014';

export default function Settings() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userError, setUserError] = useState('');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState(null);

  const [subscriptionPrices, setSubscriptionPrices] = useState(() => getPlanPrices());
  const [subscriptionPricesLoading, setSubscriptionPricesLoading] = useState(false);
  const [subscriptionPricesMessage, setSubscriptionPricesMessage] = useState(null);

  const [personalTrainerPrices, setPersonalTrainerPrices] = useState(() => getPersonalTrainerPrices());
  const [personalTrainerPricesLoading, setPersonalTrainerPricesLoading] = useState(false);
  const [personalTrainerPricesMessage, setPersonalTrainerPricesMessage] = useState(null);

  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [dataMessage, setDataMessage] = useState(null);

  useEffect(() => {
    let active = true;

    async function fetchInitialData() {
      try {
        const [userData, remoteSubscriptionPrices, remotePersonalTrainerPrices] = await Promise.all([
          getCurrentUser(),
          loadPlanPrices(),
          loadPersonalTrainerPrices(),
        ]);

        if (!active) return;
        setUser(userData);
        setSubscriptionPrices(remoteSubscriptionPrices);
        setPersonalTrainerPrices(remotePersonalTrainerPrices);
        setUserError('');
      } catch (err) {
        console.error('Failed to load settings data:', err);
        if (!active) return;
        setUserError(err.message || 'Failed to load account settings.');
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    fetchInitialData();

    return () => {
      active = false;
    };
  }, []);

  const handlePasswordChange = async (event) => {
    event.preventDefault();
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

  const updatePriceSet = (setter, planValue, newPrice) => {
    setter((prev) => ({
      ...prev,
      [planValue]: newPrice === '' ? '' : Number.parseInt(newPrice, 10) || 0,
    }));
  };

  const buildCleanPriceMap = (prices) => {
    const cleanedPrices = {};

    Object.keys(prices).forEach((key) => {
      cleanedPrices[key] = Number.parseInt(prices[key], 10) || 0;
    });

    return cleanedPrices;
  };

  const handleSaveSubscriptionPrices = async () => {
    setSubscriptionPricesLoading(true);
    setSubscriptionPricesMessage(null);

    try {
      const cleanedPrices = buildCleanPriceMap(subscriptionPrices);
      const savedPrices = await savePlanPrices(cleanedPrices);
      setSubscriptionPrices(savedPrices);
      setSubscriptionPricesMessage({ type: 'success', text: 'Subscription prices saved successfully!' });
    } catch (err) {
      setSubscriptionPricesMessage({ type: 'error', text: err.message || 'Failed to save prices.' });
    } finally {
      setSubscriptionPricesLoading(false);
    }
  };

  const handleSavePersonalTrainerPrices = async () => {
    setPersonalTrainerPricesLoading(true);
    setPersonalTrainerPricesMessage(null);

    try {
      const cleanedPrices = buildCleanPriceMap(personalTrainerPrices);
      const savedPrices = await savePersonalTrainerPrices(cleanedPrices);
      setPersonalTrainerPrices(savedPrices);
      setPersonalTrainerPricesMessage({ type: 'success', text: 'Personal trainer prices saved successfully!' });
    } catch (err) {
      setPersonalTrainerPricesMessage({ type: 'error', text: err.message || 'Failed to save personal trainer prices.' });
    } finally {
      setPersonalTrainerPricesLoading(false);
    }
  };

  const handleExportData = async () => {
    setExportLoading(true);
    setDataMessage(null);

    try {
      const [
        { data: members, error: membersError },
        { data: payments, error: paymentsError },
      ] = await Promise.all([
        supabase.from('members').select('*'),
        supabase.from('payments').select('*'),
      ]);

      if (membersError) throw membersError;
      if (paymentsError) throw paymentsError;

      const exportData = {
        exportDate: new Date().toISOString(),
        members: members || [],
        payments: payments || [],
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `gym_data_backup_${new Date().toISOString().split('T')[0]}.json`;
      anchor.click();
      URL.revokeObjectURL(url);

      setDataMessage({ type: 'success', text: 'Data exported successfully!' });
    } catch (err) {
      setDataMessage({ type: 'error', text: err.message || 'Failed to export data.' });
    } finally {
      setExportLoading(false);
    }
  };

  const handleDeleteAllMembers = async () => {
    setDeleteLoading(true);
    setDataMessage(null);

    try {
      const { error: payError } = await supabase
        .from('payments')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');

      if (payError) throw payError;

      const { error: memberError } = await supabase
        .from('members')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');

      if (memberError) throw memberError;

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

      {userError && <div className="alert alert-error">{userError}</div>}

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
              }) : EM_DASH}
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
              }) : EM_DASH}
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
              value={user?.id || EM_DASH}
              disabled
              style={{ opacity: 0.7, cursor: 'not-allowed', fontSize: 12 }}
              id="settings-user-id"
            />
          </div>
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-section-header">
          <DollarSign size={20} style={{ color: 'var(--color-primary)', marginRight: 10, verticalAlign: 'middle' }} />
          <h3 style={{ display: 'inline' }}>Subscription Pricing</h3>
        </div>
        <p className="section-desc">
          Set the default price for each subscription plan. These prices are saved to your shared account settings and auto-fill when adding new members.
        </p>

        {subscriptionPricesMessage && (
          <div className={`alert alert-${subscriptionPricesMessage.type}`}>
            {subscriptionPricesMessage.type === 'success' ? (
              <CheckCircle size={16} style={{ marginRight: 8, verticalAlign: 'middle' }} />
            ) : (
              <AlertCircle size={16} style={{ marginRight: 8, verticalAlign: 'middle' }} />
            )}
            {subscriptionPricesMessage.text}
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
                  value={subscriptionPrices[plan.value] ?? ''}
                  onChange={(event) => updatePriceSet(setSubscriptionPrices, plan.value, event.target.value)}
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
            onClick={handleSaveSubscriptionPrices}
            disabled={subscriptionPricesLoading}
            id="save-prices-btn"
          >
            {subscriptionPricesLoading ? (
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

      <div className="settings-section">
        <div className="settings-section-header">
          <DollarSign size={20} style={{ color: 'var(--color-primary)', marginRight: 10, verticalAlign: 'middle' }} />
          <h3 style={{ display: 'inline' }}>Personal Trainer Pricing</h3>
        </div>
        <p className="section-desc">
          Set default prices for personal trainer packages. These values are used when PT is enabled while adding or editing a member.
        </p>

        {personalTrainerPricesMessage && (
          <div className={`alert alert-${personalTrainerPricesMessage.type}`}>
            {personalTrainerPricesMessage.type === 'success' ? (
              <CheckCircle size={16} style={{ marginRight: 8, verticalAlign: 'middle' }} />
            ) : (
              <AlertCircle size={16} style={{ marginRight: 8, verticalAlign: 'middle' }} />
            )}
            {personalTrainerPricesMessage.text}
          </div>
        )}

        <div className="pricing-grid">
          {PERSONAL_TRAINER_PLANS.map((plan) => (
            <div className="pricing-item" key={plan.value}>
              <label htmlFor={`pt-price-${plan.value}`}>
                <span className="pricing-label">{plan.label}</span>
                <span className="pricing-duration">{plan.months} month{plan.months > 1 ? 's' : ''}</span>
              </label>
              <div className="pricing-input-wrapper">
                <span className="pricing-currency">Rs.</span>
                <input
                  id={`pt-price-${plan.value}`}
                  type="number"
                  className="form-input light pricing-input"
                  value={personalTrainerPrices[plan.value] ?? ''}
                  onChange={(event) => updatePriceSet(setPersonalTrainerPrices, plan.value, event.target.value)}
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
            onClick={handleSavePersonalTrainerPrices}
            disabled={personalTrainerPricesLoading}
            id="save-pt-prices-btn"
          >
            {personalTrainerPricesLoading ? (
              <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
            ) : (
              <>
                <Save size={16} />
                Save PT Prices
              </>
            )}
          </button>
        </div>
      </div>

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
                  onChange={(event) => setNewPassword(event.target.value)}
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
                  onChange={(event) => setConfirmPassword(event.target.value)}
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

      {showDeleteAllConfirm && (
        <div className="modal-overlay" onClick={() => setShowDeleteAllConfirm(false)}>
          <div className="modal confirm-dialog" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h2>Delete All Data</h2>
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
