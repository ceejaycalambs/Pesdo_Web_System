import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './Login.css';
import Logo_pesdo from '../assets/Logo_pesdo.png';

const EmployerLogin = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const auth = useAuth();

  const { login } = auth || {};

  // Clear form fields when component mounts
  useEffect(() => {
    setEmail('');
    setPassword('');
    setError('');
  }, []);

  // Note: We don't need to clear session on mount because the login function
  // already clears any existing session before authenticating

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!email || !password) {
      setError('Please fill in all fields');
      setLoading(false);
      return;
    }

    try {
      // Auth is working, just call it directly with expected user type
      console.log('🔍 Login attempt - Email:', email, 'Expected UserType: employer');
      await login(email, password, 'employer');
      
      console.log('Login completed successfully');
      // Clear form fields after successful login
      setEmail('');
      setPassword('');
      setLoading(false);
      navigate('/employer');
    } catch (err) {
      console.error('Login error:', err);
      let errorMessage = 'Failed to login. Please try again.';
      
      if (err.message?.includes('Invalid login credentials')) {
        errorMessage = 'Invalid email or password. Please check your credentials and try again.';
      } else if (err.message?.includes('This account is registered as')) {
        errorMessage = err.message;
      } else if (err.message?.includes('account has been deleted')) {
        errorMessage = 'Your account has been deleted. Please contact support if you believe this is an error.';
      } else if (err.message?.includes('Email not confirmed')) {
        errorMessage = 'Please check your email and click the confirmation link before logging in.';
      } else if (err.message?.includes('Too many requests')) {
        errorMessage = 'Too many login attempts. Please wait a moment and try again.';
      }
      
      setError(errorMessage);
      setLoading(false);
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  return (
    <div className="login-page">
      <header className="login-header-nav">
        <div className="header-brand">
          <img src={Logo_pesdo} alt="PESDO Logo" className="header-logo" />
          <h1>PESDO Web Portal</h1>
        </div>
        <nav aria-label="Primary navigation">
          <Link className="btn" to="/">Home</Link>
          <Link className="btn btn-outline" to="/register">Register</Link>
        </nav>
      </header>
      
      <div className="login-container">
        <div className="login-card">
          <div className="login-header">
            <h1>Employer Login</h1>
            <p>Access your employer dashboard</p>
            <div className="login-type-badge employer">
              <span className="badge-icon">🏢</span>
              <span className="badge-text">Employer Portal</span>
            </div>
          </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input
              type="email"
              id="email"
              name="employer-email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              required
              disabled={loading}
              autoComplete="new-password"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <div className="password-input-container">
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                name="employer-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                disabled={loading}
                autoComplete="new-password"
              />
              <button
                type="button"
                className="password-toggle"
                onClick={togglePasswordVisibility}
                disabled={loading}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                )}
              </button>
            </div>
            <div className="forgot-password-container">
              <Link 
                to="/forgot-password?type=employer" 
                className="forgot-password-link"
              >
                Forgot Password?
              </Link>
            </div>
          </div>

          {error && (
            <div className="error-message">
              <span className="error-icon">⚠️</span>
              {error}
            </div>
          )}

          <button 
            type="submit" 
            className="login-button"
            disabled={loading}
          >
            {loading ? (
              <div className="loading-content">
                <div className="loading-spinner"></div>
                Logging in...
              </div>
            ) : (
              <>
                <span className="button-icon">🏢</span>
                Login as Employer
              </>
            )}
          </button>
        </form>

        <div className="login-footer">
          <p>
            Don't have an employer account?{' '}
            <Link to="/register" className="register-link">
              Create one here
            </Link>
          </p>
          <p>
            Looking for jobseeker login?{' '}
            <Link to="/login/jobseeker" className="switch-login-link">
              Click here
            </Link>
          </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmployerLogin;
