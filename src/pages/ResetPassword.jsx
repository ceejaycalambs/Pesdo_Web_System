import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link, useSearchParams } from 'react-router-dom';
import { supabase } from '../supabase';
import Logo_pesdo from '../assets/Logo_pesdo.png';
import '../Login/Login.css';
import './ResetPassword.css';

const ResetPassword = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const userType = searchParams.get('type') || 'jobseeker'; // Get user type from URL params
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [verifying, setVerifying] = useState(true);

  useEffect(() => {
    // Check if we have a valid session from the password reset link
    const checkSession = async () => {
      try {
        // First, check if there are hash fragments in the URL (from password reset link)
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        const type = hashParams.get('type');
        const error = hashParams.get('error');
        const errorDescription = hashParams.get('error_description');

        // Handle errors from hash fragments
        if (error) {
          console.error('Password reset error from URL:', error, errorDescription);
          setError(errorDescription || 'Invalid or expired reset link. Please request a new password reset.');
          setVerifying(false);
          return;
        }

        // If we have tokens in the hash, set the session
        if (type === 'recovery' && accessToken) {
          console.log('🔐 Processing password reset link from URL hash...');
          const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken || '',
          });
          
          if (sessionError) {
            console.error('Error setting session from hash:', sessionError);
            setError('Invalid or expired reset link. Please request a new password reset.');
            setVerifying(false);
            return;
          }

          // Clear the hash from URL after processing
          window.history.replaceState(null, '', window.location.pathname);
          setVerifying(false);
          return;
        }

        // If tokens were passed from AuthCallback via state, set the session
        if (location.state?.accessToken && location.state?.refreshToken) {
          console.log('🔐 Processing password reset link from location state...');
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: location.state.accessToken,
            refresh_token: location.state.refreshToken,
          });
          
          if (sessionError) {
            console.error('Error setting session from state:', sessionError);
            setError('Invalid or expired reset link. Please request a new password reset.');
            setVerifying(false);
            return;
          }
          setVerifying(false);
          return;
        }

        // Wait a moment for Supabase's automatic session detection to process hash fragments
        await new Promise(resolve => setTimeout(resolve, 500));

        // Check if we already have a valid session (from Supabase's automatic processing or previous manual processing)
        const { data: { session }, error: sessionCheckError } = await supabase.auth.getSession();
        if (sessionCheckError || !session) {
          console.error('No valid session found:', sessionCheckError);
          setError('Invalid or expired reset link. Please request a new password reset.');
          setVerifying(false);
          return;
        }

        // Session is valid, allow password reset
        console.log('✅ Valid session found for password reset');
        setVerifying(false);
      } catch (err) {
        console.error('Error checking session:', err);
        setError('Failed to verify reset link. Please try again.');
        setVerifying(false);
      }
    };

    checkSession();
  }, [location.state]);

  const validatePassword = (password) => {
    if (password.length < 8) {
      return 'Password must be at least 8 characters long';
    }
    if (!/(?=.*[a-z])/.test(password)) {
      return 'Password must contain at least one lowercase letter';
    }
    if (!/(?=.*[A-Z])/.test(password)) {
      return 'Password must contain at least one uppercase letter';
    }
    if (!/(?=.*\d)/.test(password)) {
      return 'Password must contain at least one number';
    }
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!newPassword || !confirmPassword) {
      setError('Please fill in all fields');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    setLoading(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (updateError) {
        throw updateError;
      }

      setSuccess(true);
      
      // Redirect to login after 3 seconds (use correct user type)
      setTimeout(() => {
        navigate(`/login/${userType}`);
      }, 3000);
    } catch (err) {
      console.error('Password reset error:', err);
      let errorMessage = 'Failed to reset password. Please try again.';
      
      if (err.message?.includes('expired') || err.message?.includes('invalid')) {
        errorMessage = 'This reset link has expired or is invalid. Please request a new one.';
      } else if (err.message?.includes('same')) {
        errorMessage = 'New password must be different from your current password.';
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (verifying) {
    return (
      <div className="reset-password-page">
        <div className="login-container">
          <div className="login-card">
            <div className="verifying-container">
              <div className="loading-spinner"></div>
              <h2>Verifying Reset Link</h2>
              <p>Please wait while we verify your password reset link...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="reset-password-page">
        <header className="login-header-nav">
          <div className="header-brand">
            <img src={Logo_pesdo} alt="PESDO Logo" className="header-logo" />
            <h1>PESDO Web Portal</h1>
          </div>
        </header>
        <div className="login-container">
          <div className="login-card">
            <div className="success-message-container">
              <div className="success-icon-large">✅</div>
              <h2>Password Reset Successful!</h2>
              <p>Your password has been updated successfully.</p>
              <p className="success-instructions">
                Redirecting to login page...
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="reset-password-page">
      <header className="login-header-nav">
        <div className="header-brand">
          <img src={Logo_pesdo} alt="PESDO Logo" className="header-logo" />
          <h1>PESDO Web Portal</h1>
        </div>
        <nav aria-label="Primary navigation">
          <Link className="btn" to="/">Home</Link>
          <Link className="btn btn-outline" to={`/login/${userType}`}>Back to Login</Link>
        </nav>
      </header>

      <div className="login-container">
        <div className="login-card">
          <div className="login-header">
            <h1>Reset Password</h1>
            <p>Enter your new password</p>
            <div className={`login-type-badge ${userType}`}>
              <span className="badge-icon">{userType === 'employer' ? '🏢' : '👤'}</span>
              <span className="badge-text">{userType === 'employer' ? 'Employer Portal' : 'Jobseeker Portal'}</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="login-form">
            <div className="form-group">
              <label htmlFor="newPassword">New Password</label>
              <div className="password-input-container">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="newPassword"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  required
                  disabled={loading}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
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
              <small className="password-hint">
                Must be at least 8 characters with uppercase, lowercase, and a number
              </small>
            </div>

            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm Password</label>
              <div className="password-input-container">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  id="confirmPassword"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  required
                  disabled={loading}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  disabled={loading}
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                >
                  {showConfirmPassword ? (
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
                  Resetting Password...
                </div>
              ) : (
                <>
                  <span className="button-icon">🔒</span>
                  Reset Password
                </>
              )}
            </button>
          </form>

          <div className="login-footer">
            <p>
              Remember your password?{' '}
              <Link to={`/login/${userType}`} className="register-link">
                Back to Login
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;

