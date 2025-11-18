import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import './AdminLanding.css';
import Logo_pesdo from '../../assets/Logo_pesdo.png';
import Pesdo_Office from '../../assets/Pesdo_Office.png';

const AdminLanding = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const { login, currentUser, userData, loading: authLoading, profileLoaded } = useAuth();

  // Redirect authenticated admins away from login page
  useEffect(() => {
    if (currentUser && !authLoading && profileLoaded) {
      const userType = userData?.userType;
      if (userType === 'admin' || userType === 'super_admin') {
        const host = typeof window !== 'undefined' ? window.location.hostname : '';
        navigate(host.startsWith('admin.') ? '/dashboard' : '/admin/dashboard', { replace: true });
      }
    }
  }, [currentUser, userData, authLoading, profileLoaded, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Use AuthContext login function with 'admin' as expected user type
      await login(email, password, 'admin');
      
      // Store admin session for backward compatibility
      localStorage.setItem('admin_authenticated', 'true');
      localStorage.setItem('admin_login_time', Date.now().toString());
      localStorage.setItem('admin_email', email);
      
      // Navigate to admin dashboard (host-based: admin subdomain uses '/dashboard')
      // Use replace: true to prevent back button from returning to login page
      const host = typeof window !== 'undefined' ? window.location.hostname : '';
      navigate(host.startsWith('admin.') ? '/dashboard' : '/admin/dashboard', { replace: true });
    } catch (err) {
      console.error('Admin login error:', err);
      setError(err.message || 'Invalid admin credentials. Please check your email and password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-landing">
      {/* Header */}
      <header className="admin-header">
        <div className="admin-header-content">
          <div className="admin-header-brand">
            <img src={Logo_pesdo} alt="PESDO Logo" className="admin-header-logo" />
            <h1>PESDO Admin Portal</h1>
          </div>
          {/* Back to Main Site button removed for dedicated admin subdomain */}
        </div>
      </header>

      {/* Main Content - Split Layout */}
      <main className="admin-main">
        {/* Background Image Container */}
        <div 
          className="admin-main-background"
          style={{
            backgroundImage: `url(${Pesdo_Office})`
          }}
        >
          <div className="admin-main-overlay"></div>
        </div>

        {/* Left Side - Welcome Section with Background */}
        <div className="admin-welcome-section">
          <div className="welcome-content">
            <div className="welcome-icon">🔐</div>
            <h2>Administrative Access</h2>
            <p>Welcome to the PESDO Admin Portal. Please sign in with your administrative credentials to access the dashboard.</p>
            
            <div className="features-preview">
              <div className="feature-item">
                <span className="feature-icon">👥</span>
                <span>User Management</span>
              </div>
              <div className="feature-item">
                <span className="feature-icon">📊</span>
                <span>Analytics & Reports</span>
              </div>
              <div className="feature-item">
                <span className="feature-icon">💼</span>
                <span>Job Management</span>
              </div>
              <div className="feature-item">
                <span className="feature-icon">🔒</span>
                <span>Security Controls</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side - Login Form */}
        <div className="admin-login-section">
          <div className="login-card">
            <div className="login-header">
              <h3>Admin Login</h3>
              <p>Enter your credentials to continue</p>
            </div>

            <form onSubmit={handleSubmit} className="admin-login-form" autoComplete="off">
              <div className="form-group">
                <label htmlFor="admin-email">Email Address</label>
                <input
                  id="admin-email"
                  type="email"
                  name="admin-email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email address"
                  autoComplete="off"
                  autoCapitalize="none"
                  autoCorrect="off"
                  inputMode="email"
                  required
                  disabled={loading}
                  className="admin-input"
                />
              </div>

              <div className="form-group">
                <label htmlFor="admin-password">Password</label>
                <div className="password-input-container">
                  <input
                    id="admin-password"
                    type={showPassword ? 'text' : 'password'}
                    name="admin-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    autoComplete="new-password"
                    autoCapitalize="none"
                    autoCorrect="off"
                    required
                    disabled={loading}
                    className="admin-input"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="password-toggle"
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
              </div>

              {error && (
                <div className="error-message">
                  {error}
                </div>
              )}

              <button 
                type="submit" 
                disabled={loading || !email.trim() || !password.trim()}
                className="admin-login-btn"
              >
                {loading ? (
                  <div className="loading-content">
                    <div className="loading-spinner"></div>
                    <span>Signing in...</span>
                  </div>
                ) : (
                  'Sign In'
                )}
              </button>
            </form>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="admin-footer">
        <p>© 2025 PESDO Surigao City | Administrative Access Only</p>
      </footer>
    </div>
  );
};

export default AdminLanding;