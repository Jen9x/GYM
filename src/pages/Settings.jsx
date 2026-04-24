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
const DELETE_ALL_CONFIRMATION_TEXT = 'DELETE ALL DATA';
const DATA_BACKUP_SETTING_KEY = 'latest_data_backup';

function getBackupSummary(backup) {
  if (!backup?.createdAt) return null;

  return {
    createdAt: backup.createdAt,
    memberCount: Array.isArray(backup.members) ? backup.members.length : 0,
    paymentCount: Array.isArray(backup.payments) ? backup.payments.length : 0,
  };
}

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
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [backupLoading, setBackupLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [latestBackup, setLatestBackup] = useState(null);
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

        if (userData?.id) {
          const { data: backupData, error: backupError } = await supabase
            .from('app_settings')
            .select('setting_value')
            .eq('user_id', userData.id)
            .eq('setting_key', DATA_BACKUP_SETTING_KEY)
            .maybeSingle();

          if (backupError) throw backupError;
          setLatestBackup(getBackupSummary(backupData?.setting_value));
        }
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
      if (!user?.id) {
        throw new Error('Could not verify the signed-in user before exporting data.');
      }

      const [
        { data: members, error: membersError },
        { data: payments, error: paymentsError },
      ] = await Promise.all([
        supabase.from('members').select('*').eq('user_id', user.id),
        supabase.from('payments').select('*').eq('user_id', user.id),
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

  const createBackendBackup = async (reason = 'manual') => {
    if (!user?.id) {
      throw new Error('Could not verify the signed-in user before backing up data.');
    }

    const [
      { data: members, error: membersError },
      { data: payments, error: paymentsError },
    ] = await Promise.all([
      supabase.from('members').select('*').eq('user_id', user.id),
      supabase.from('payments').select('*').eq('user_id', user.id),
    ]);

    if (membersError) throw membersError;
    if (paymentsError) throw paymentsError;

    const backupData = {
      version: 1,
      reason,
      createdAt: new Date().toISOString(),
      members: members || [],
      payments: payments || [],
    };

    const { error: saveError } = await supabase
      .from('app_settings')
      .upsert(
        [{
          user_id: user.id,
          setting_key: DATA_BACKUP_SETTING_KEY,
          setting_value: backupData,
        }],
        { onConflict: 'user_id,setting_key' }
      );

    if (saveError) throw saveError;

    const summary = getBackupSummary(backupData);
    setLatestBackup(summary);
    return summary;
  };

  const handleCreateBackendBackup = async () => {
    setBackupLoading(true);
    setDataMessage(null);

    try {
      const summary = await createBackendBackup('manual');
      setDataMessage({
        type: 'success',
        text: `Backend backup saved with ${summary.memberCount} members and ${summary.paymentCount} payments.`,
      });
    } catch (err) {
      setDataMessage({ type: 'error', text: err.message || 'Failed to save backend backup.' });
    } finally {
      setBackupLoading(false);
    }
  };

  const handleRestoreLatestBackup = async () => {
    setRestoreLoading(true);
    setDataMessage(null);

    try {
      if (!user?.id) {
        throw new Error('Could not verify the signed-in user before restoring data.');
      }

      const { data, error } = await supabase
        .from('app_settings')
        .select('setting_value')
        .eq('user_id', user.id)
        .eq('setting_key', DATA_BACKUP_SETTING_KEY)
        .maybeSingle();

      if (error) throw error;

      const backup = data?.setting_value;
      const members = Array.isArray(backup?.members) ? backup.members : [];
      const payments = Array.isArray(backup?.payments) ? backup.payments : [];

      if (!backup?.createdAt) {
        throw new Error('No backend backup is available to restore.');
      }

      if (members.length > 0) {
        const memberRows = members.map((member) => ({
          ...member,
          user_id: user.id,
        }));

        const { error: membersError } = await supabase
          .from('members')
          .upsert(memberRows, { onConflict: 'id' });

        if (membersError) throw membersError;
      }

      if (payments.length > 0) {
        const paymentRows = payments.map((payment) => ({
          ...payment,
          user_id: user.id,
        }));

        const { error: paymentsError } = await supabase
          .from('payments')
          .upsert(paymentRows, { onConflict: 'id' });

        if (paymentsError) throw paymentsError;
      }

      setLatestBackup(getBackupSummary(backup));
      setDataMessage({
        type: 'success',
        text: `Restored ${members.length} members and ${payments.length} payments from the latest backend backup.`,
      });
      setShowRestoreConfirm(false);
    } catch (err) {
      setDataMessage({ type: 'error', text: err.message || 'Failed to restore backend backup.' });
    } finally {
      setRestoreLoading(false);
    }
  };

  const handleDeleteAllMembers = async () => {
    if (deleteConfirmText !== DELETE_ALL_CONFIRMATION_TEXT) {
      setDataMessage({ type: 'error', text: `Type ${DELETE_ALL_CONFIRMATION_TEXT} to confirm deleting all data.` });
      return;
    }

    setDeleteLoading(true);
    setDataMessage(null);

    try {
      if (!user?.id) {
        throw new Error('Could not verify the signed-in user before deleting data.');
      }

      await createBackendBackup('before_delete_all');

      const { error: payError } = await supabase
        .from('payments')
        .delete()
        .eq('user_id', user.id)
        .neq('id', '00000000-0000-0000-0000-000000000000');

      if (payError) throw payError;

      const { error: memberError } = await supabase
        .from('members')
        .delete()
        .eq('user_id', user.id)
        .neq('id', '00000000-0000-0000-0000-000000000000');

      if (memberError) throw memberError;

      setDataMessage({ type: 'success', text: 'All member data has been deleted. A backend backup was saved first.' });
      setShowDeleteAllConfirm(false);
      setDeleteConfirmText('');
    } catch (err) {
      setDataMessage({ type: 'error', text: err.message || 'Failed to delete data.' });
    } finally {
      setDeleteLoading(false);
    }
  };

  const openDeleteAllConfirm = () => {
    setDeleteConfirmText('');
    setShowDeleteAllConfirm(true);
  };

  const closeDeleteAllConfirm = () => {
    if (deleteLoading) return;
    setDeleteConfirmText('');
    setShowDeleteAllConfirm(false);
  };

  const closeRestoreConfirm = () => {
    if (restoreLoading) return;
    setShowRestoreConfirm(false);
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
            className="btn btn-secondary"
            onClick={handleCreateBackendBackup}
            disabled={backupLoading}
            id="backup-data-btn"
          >
            {backupLoading ? (
              <div className="spinner spinner-dark" style={{ width: 16, height: 16, borderWidth: 2 }} />
            ) : (
              <>
                <Database size={16} />
                Save Backend Backup
              </>
            )}
          </button>

          <button
            className="btn btn-secondary"
            onClick={() => setShowRestoreConfirm(true)}
            disabled={restoreLoading || !latestBackup}
            id="restore-backup-btn"
            title={latestBackup ? 'Restore the latest backend backup' : 'No backend backup available yet'}
          >
            {restoreLoading ? (
              <div className="spinner spinner-dark" style={{ width: 16, height: 16, borderWidth: 2 }} />
            ) : (
              <>
                <Database size={16} />
                Restore Latest Backup
              </>
            )}
          </button>

          <button
            className="btn btn-danger"
            onClick={openDeleteAllConfirm}
            id="delete-all-btn"
          >
            <Trash2 size={16} />
            Delete All Member Data
          </button>
        </div>

        <p style={{ marginTop: 12, fontSize: 13, color: 'var(--color-text-muted)' }}>
          {latestBackup
            ? `Latest backend backup: ${new Date(latestBackup.createdAt).toLocaleString()} (${latestBackup.memberCount} members, ${latestBackup.paymentCount} payments).`
            : 'No backend backup saved yet.'}
        </p>
      </div>

      {showRestoreConfirm && (
        <div className="modal-overlay" onClick={closeRestoreConfirm}>
          <div className="modal confirm-dialog" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h2>Restore Backup</h2>
              <button className="modal-close" onClick={closeRestoreConfirm}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <p>
                Restore the latest backend backup with <strong>{latestBackup?.memberCount || 0} members</strong> and{' '}
                <strong>{latestBackup?.paymentCount || 0} payments</strong>?
              </p>
              <p style={{ marginTop: 12, fontSize: 13, color: 'var(--color-text-muted)' }}>
                Existing records with the same IDs will be updated. Records created after the backup will not be deleted.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={closeRestoreConfirm}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleRestoreLatestBackup}
                disabled={restoreLoading}
                id="confirm-restore-backup-btn"
              >
                {restoreLoading ? (
                  <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                ) : (
                  <>
                    <Database size={16} />
                    Restore Backup
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteAllConfirm && (
        <div className="modal-overlay" onClick={closeDeleteAllConfirm}>
          <div className="modal confirm-dialog" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h2>Delete All Data</h2>
              <button className="modal-close" onClick={closeDeleteAllConfirm}>
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
              <div style={{ marginTop: 18, textAlign: 'left' }}>
                <label htmlFor="delete-all-confirm-text">
                  Type <strong>{DELETE_ALL_CONFIRMATION_TEXT}</strong> to confirm
                </label>
                <input
                  id="delete-all-confirm-text"
                  type="text"
                  className="form-input light"
                  value={deleteConfirmText}
                  onChange={(event) => setDeleteConfirmText(event.target.value)}
                  autoComplete="off"
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={closeDeleteAllConfirm}>
                Cancel
              </button>
              <button
                className="btn btn-danger"
                onClick={handleDeleteAllMembers}
                disabled={deleteLoading || deleteConfirmText !== DELETE_ALL_CONFIRMATION_TEXT}
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
