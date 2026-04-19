import { useState } from 'react';
import { Link } from 'react-router-dom';
import { resetPassword } from '../lib/auth';
import { ArrowLeft } from 'lucide-react';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await resetPassword(email);
      setSent(true);
    } catch (err) {
      setError(err.message || 'Failed to send reset email.');
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
          <p>Reset your password</p>
        </div>

        <div className="login-card">
          <Link to="/login" className="back-link">
            <ArrowLeft size={16} />
            Back to Login
          </Link>

          {sent ? (
            <div style={{ marginTop: '20px' }}>
              <div className="alert alert-success">
                ✓ Password reset link sent! Check your email at <strong>{email}</strong>
              </div>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '13px', marginTop: '12px', textAlign: 'center' }}>
                Didn't receive it? Check your spam folder or try again.
              </p>
            </div>
          ) : (
            <>
              <h2 style={{ marginTop: '20px' }}>Forgot Password</h2>
              <p className="subtitle">Enter your email to receive a reset link</p>

              {error && <div className="alert alert-error">{error}</div>}

              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label htmlFor="reset-email">Email Address</label>
                  <input
                    id="reset-email"
                    type="email"
                    className="form-input"
                    placeholder="admin@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoFocus
                  />
                </div>

                <button
                  type="submit"
                  className="btn btn-primary btn-full"
                  disabled={loading}
                  id="reset-submit-btn"
                >
                  {loading ? <div className="spinner" /> : 'Send Reset Link'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
