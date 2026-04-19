import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { updatePassword } from '../lib/auth';

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Supabase handles the token from the URL automatically
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event) => {
        if (event === 'PASSWORD_RECOVERY') {
          // User arrived via password reset link
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

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
                ✓ Password updated successfully! Redirecting to login...
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
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    autoFocus
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="confirm-password">Confirm Password</label>
                  <input
                    id="confirm-password"
                    type="password"
                    className="form-input"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                </div>

                <button
                  type="submit"
                  className="btn btn-primary btn-full"
                  disabled={loading}
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
