import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signIn } from '../lib/auth';

export default function Login({ initialError = '' }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(initialError);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    setError(initialError || '');
  }, [initialError]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signIn(email, password);
      navigate('/');
    } catch (err) {
      setError(err.message || 'Invalid credentials. Please try again.');
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
          <p>Sign in to the admin portal</p>
        </div>

        <div className="login-card">
          <h2>Admin Login</h2>
          <p className="subtitle">Enter your credentials to continue</p>

          {error && <div className="alert alert-error">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                className="form-input"
                placeholder="admin@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                autoFocus
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                className="form-input"
                placeholder="Enter your password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </div>

            <Link to="/forgot-password" className="forgot-link">
              Forgot Password?
            </Link>

            <button
              type="submit"
              className="btn btn-primary btn-full"
              disabled={loading}
              id="login-submit-btn"
            >
              {loading ? <div className="spinner" /> : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
