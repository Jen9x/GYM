import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { updatePassword } from '../lib/auth';

function hasRecoveryTokensInUrl() {
  const urlState = `${window.location.search}&${window.location.hash}`;
  return /type=recovery|access_token=|refresh_token=|token_hash=|code=/.test(urlState);
}

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingRecovery, setCheckingRecovery] = useState(true);
  const [recoveryReady, setRecoveryReady] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;

    async function validateRecoverySession() {
      try {
        const hasRecoveryTokens = hasRecoveryTokensInUrl();
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) throw sessionError;
        if (!mounted) return;

        if (hasRecoveryTokens && session) {
          setRecoveryReady(true);
          setError('');
        } else if (!hasRecoveryTokens) {
          setRecoveryReady(false);
          setError('Open this page from a valid password reset link sent to your email.');
        } else {
          setRecoveryReady(false);
          setError('This password reset link is invalid or has expired. Request a new one and try again.');
        }
      } catch (err) {
        if (!mounted) return;
        setRecoveryReady(false);
        setError(err.message || 'Could not validate the password reset link.');
      } finally {
        if (mounted) {
          setCheckingRecovery(false);
        }
      }
    }

    validateRecoverySession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!mounted) return;

        if (event === 'PASSWORD_RECOVERY' && session) {
          setRecoveryReady(true);
          setError('');
          setCheckingRecovery(false);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (!recoveryReady) {
      setError('This password reset link is invalid or has expired. Request a new one and try again.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);

    try {
      await updatePassword(password);
      setSuccess(true);
      setTimeout(() => navigate('/login'), 3000);
    } catch (err) {
      setError(err.message || 'Failed to update password.');
    } finally {
      setLoading(false);
    }
  };

  if (checkingRecovery) {
    return (
      <div className="login-page">
        <div className="login-container">
          <div className="login-card" style={{ textAlign: 'center' }}>
            <div className="spinner spinner-dark" style={{ width: 28, height: 28, margin: '0 auto 16px' }} />
            <p>Validating your password reset link...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-header">
          <img src="/logo.png" alt="Black Bull's Advance Gym" className="login-logo" />
          <h1>Black Bull's <span>Advance Gym</span></h1>
          <p>Set your new password</p>
        </div>

        <div className="login-card">
          {success ? (
            <div>
              <div className="alert alert-success">
                Password updated successfully! Redirecting to login...
              </div>
            </div>
          ) : (
            <>
              <h2>New Password</h2>
              <p className="subtitle">Choose a strong password for your account</p>

              {error && <div className="alert alert-error">{error}</div>}

              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label htmlFor="new-password">New Password</label>
                  <input
                    id="new-password"
                    type="password"
                    className="form-input"
                    placeholder="Enter a new password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    minLength={6}
                    autoFocus
                    disabled={!recoveryReady}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="confirm-password">Confirm Password</label>
                  <input
                    id="confirm-password"
                    type="password"
                    className="form-input"
                    placeholder="Confirm your new password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    required
                    minLength={6}
                    disabled={!recoveryReady}
                  />
                </div>

                <button
                  type="submit"
                  className="btn btn-primary btn-full"
                  disabled={loading || !recoveryReady}
                  id="update-password-btn"
                >
                  {loading ? <div className="spinner" /> : 'Update Password'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
