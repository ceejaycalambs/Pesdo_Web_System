import React, { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { supabase } from '../supabase';
import Logo_pesdo from '../assets/Logo_pesdo.png';
import '../Login/Login.css';
import './ForgotPassword.css';

const ForgotPassword = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const userType = searchParams.get('type') || 'jobseeker';
  
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!email) {
      setError('Please enter your email address');
      setLoading(false);
      return;
    }

    try {
      // Normalize the origin (remove www. if present for consistency)
      let origin = window.location.origin;
      // Remove www. prefix to ensure consistency with Supabase redirect URLs
      origin = origin.replace(/^https?:\/\/www\./, (match) => match.replace('www.', ''));
      
      // Get the redirect URL based on user type (include user type in query params)
      const redirectUrl = `${origin}/reset-password?type=${userType}`;
      
      console.log('🔐 Password reset request for:', email);
      console.log('🔐 User type:', userType);
      console.log('🔐 Original origin:', window.location.origin);
      console.log('🔐 Normalized origin:', origin);
      console.log('🔐 Redirect URL:', redirectUrl);
      
      const { data, error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl,
      });

      console.log('🔐 Password reset response:', { data, error: resetError });

      if (resetError) {
        console.error('❌ Password reset error details:', {
          message: resetError.message,
          status: resetError.status,
          code: resetError.code,
          name: resetError.name
        });
        throw resetError;
      }

      console.log('✅ Password reset email sent successfully');
      // Note: Supabase automatically sends password reset email with actual reset link
      // We rely on Supabase's email system for password reset
      
      setSuccess(true);
    } catch (err) {
      console.error('Password reset error:', err);
      let errorMessage = 'Failed to send password reset email. Please try again.';
      
      if (err.message?.includes('rate limit')) {
        errorMessage = 'Too many requests. Please wait a moment and try again.';
      } else if (err.message?.includes('email')) {
        errorMessage = 'Please enter a valid email address.';
      } else if (err.message?.includes('not found') || err.message?.includes('does not exist')) {
        errorMessage = 'No account found with this email address. Please check your email and try again.';
      } else if (err.message?.includes('SMTP') || err.message?.includes('email')) {
        errorMessage = 'Email service error. Please contact support if this issue persists.';
      } else {
        // Show more detailed error for debugging
        errorMessage = `Failed to send password reset email: ${err.message || 'Unknown error'}. Please check your email configuration or contact support.`;
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="forgot-password-page">
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
            <h1>Forgot Password</h1>
            <p>Enter your email to receive a password reset link</p>
            <div className={`login-type-badge ${userType}`}>
              <span className="badge-icon">{userType === 'employer' ? '🏢' : '👤'}</span>
              <span className="badge-text">{userType === 'employer' ? 'Employer Portal' : 'Jobseeker Portal'}</span>
            </div>
          </div>

          {!success ? (
            <form onSubmit={handleSubmit} className="login-form">
              <div className="form-group">
                <label htmlFor="email">Email Address</label>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  required
                  disabled={loading}
                  autoComplete="email"
                />
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
                    Sending...
                  </div>
                ) : (
                  <>
                    <span className="button-icon">📧</span>
                    Send Reset Link
                  </>
                )}
              </button>
            </form>
          ) : (
            <div className="success-message-container">
              <div className="success-icon-large">✅</div>
              <h2>Check Your Email</h2>
              <p>
                We've sent a password reset link to <strong>{email}</strong>
              </p>
              <p className="success-instructions">
                Please check your email inbox and click the link to reset your password. 
                The link will expire in 1 hour.
              </p>
              <div className="success-actions">
                <button 
                  onClick={() => navigate(`/login/${userType}`)}
                  className="back-to-login-btn"
                >
                  Back to Login
                </button>
                <button 
                  onClick={() => {
                    setSuccess(false);
                    setEmail('');
                  }}
                  className="try-another-email-btn"
                >
                  Try Another Email
                </button>
              </div>
            </div>
          )}

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

export default ForgotPassword;

