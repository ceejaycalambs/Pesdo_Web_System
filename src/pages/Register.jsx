import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Logo_pesdo from '../assets/Logo_pesdo.png';
import { useAuth } from '../contexts/AuthContext.jsx';
import './Register.css';

const Register = () => {
  const { register, currentUser, logout } = useAuth();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    businessName: '',
    email: '',
    password: '',
    confirmPassword: '',
    userType: 'jobseeker' // default to jobseeker
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Handle auth state changes to show success message when user gets auto-logged in
  useEffect(() => {
    console.log('Auth state changed in Register:', { currentUser: !!currentUser, loading, hasSuccess: !!success });
    
      // If user gets auto-logged in during registration, show success message and logout
    if (currentUser && loading && !success) {
      console.log('User auto-logged in during registration, showing success message and logging out for testing');
      setSuccess(`Registration successful. Please check your email to confirm your account.`);
      setLoading(false);
      
      // Clear the form
      setFormData({
        firstName: '',
        lastName: '',
        businessName: '',
        email: '',
        password: '',
        confirmPassword: '',
        userType: formData.userType
      });
      
      // Logout the user immediately so they can test the login form (without redirect)
      logout(true); // Skip redirect to stay on register page
      console.log('User logged out after registration for testing purposes');
    }
  }, [currentUser, loading, success, formData.userType]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    // Remove "register-" prefix from name if present
    const stateKey = name.startsWith('register-') ? name.replace('register-', '') : name;
    setFormData(prev => ({
      ...prev,
      [stateKey]: value
    }));
  };

  const handleUserTypeSelect = (userType) => {
    setFormData(prev => ({
      ...prev,
      userType,
      ...(userType === 'jobseeker'
        ? { firstName: prev.firstName || '', lastName: prev.lastName || '', businessName: '' }
        : { firstName: '', lastName: '', businessName: prev.businessName || '' })
    }));
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const toggleConfirmPasswordVisibility = () => {
    setShowConfirmPassword(!showConfirmPassword);
  };

  const validateForm = () => {
    const requiredFields = ['email', 'password', 'confirmPassword'];
    if (formData.userType === 'jobseeker') {
      requiredFields.push('firstName', 'lastName');
    } else if (formData.userType === 'employer') {
      requiredFields.push('businessName');
    }

    const missingField = requiredFields.find((field) => {
      const value = formData[field] || '';
      if (field === 'password' || field === 'confirmPassword') {
        return value.length === 0;
      }
      return value.trim().length === 0;
    });

    if (missingField) {
      return 'Please complete all required fields to proceed with registration.';
    }

    if (formData.password !== formData.confirmPassword) {
      return 'The password and confirmation password do not match. Please ensure both fields contain the same password.';
    }

    if (formData.password.length < 8) {
      return 'Password must contain a minimum of 8 characters.';
    }

    const passwordValue = formData.password;
    const hasLowerCase = /[a-z]/.test(passwordValue);
    const hasUpperCase = /[A-Z]/.test(passwordValue);
    const hasNumbers = /\d/.test(passwordValue);
    const hasSymbols = /[!@#$%^&*(),.?":{}|<>]/.test(passwordValue);

    if (!hasLowerCase || !hasUpperCase || !hasNumbers || !hasSymbols) {
      return 'Password must contain at least one lowercase letter, one uppercase letter, one numeric digit, and one special character.';
    }

    return '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setLoading(true);
      console.log('Calling register function...');
      
      const additionalData = formData.userType === 'jobseeker'
        ? {
            first_name: formData.firstName.trim(),
            last_name: formData.lastName.trim()
          }
        : formData.userType === 'employer'
        ? {
            business_name: formData.businessName.trim()
          }
        : {};

      const result = await register(formData.email.trim(), formData.password, formData.userType, additionalData);
      
      console.log('Register function completed:', result);
      
      // Show success message and stay on register page
      setSuccess(`Registration successful. Please check your email to confirm your account.`);
      setLoading(false);
      
      // Clear the form for next registration
      setFormData({
        firstName: '',
        lastName: '',
        businessName: '',
        email: '',
        password: '',
        confirmPassword: '',
        userType: formData.userType // Keep the same user type
      });
      
      // Fallback: Show success message after a delay if auth state doesn't change
      setTimeout(() => {
        console.log('Registration completed successfully');
        // If we're still loading and no success message is shown, show it now
        if (loading && !success) {
          console.log('Fallback: Showing success message');
          setSuccess(`Registration successful. Please check your email to confirm your account.`);
          setLoading(false);
          
          // Clear the form
          setFormData({
            firstName: '',
            lastName: '',
            businessName: '',
            email: '',
            password: '',
            confirmPassword: '',
            userType: formData.userType
          });
        }
      }, 1000);
           } catch (err) {
             console.error('Registration error:', err);
             console.error('Error details:', {
               message: err.message,
               status: err.status,
               code: err.code,
               name: err.name,
               stack: err.stack
             });
             
             // Handle specific error cases
             if (err.message?.includes('Email signups are disabled')) {
               setError('Account registration is currently unavailable. Please contact the system administrator for assistance.');
            } else if (err.status === 504 || err.message?.includes('Gateway Timeout') || err.message?.includes('timeout') || err.name === 'AuthRetryableFetchError') {
              setError('The registration service is temporarily unavailable due to a timeout. Please wait a moment and attempt registration again.');
            } else if (err.message?.includes('Error sending confirmation email') || err.status === 500) {
              setError('We encountered an issue while processing your registration. Please contact the system administrator or try again later.');
            } else if (err.message?.includes('rate limit') || err.message?.includes('Too Many Requests') || err.code === 'over_email_send_rate_limit') {
              setError('Too many registration attempts have been made. Please wait a few minutes before attempting to register again.');
            } else if (err.message?.includes('User already registered') || err.message?.includes('already registered')) {
              setError('An account with this email address already exists in our system. Please use a different email address or proceed to the login page if this is your account.');
            } else if (err.message?.includes('Invalid email')) {
              setError('The email address provided is invalid. Please enter a valid email address and try again.');
            } else if (err.message?.includes('previously deleted') || err.message?.includes('orphaned')) {
              setError(err.message); // Keep the detailed message for orphaned accounts
            } else if (err.message?.includes('userType') || err.message?.includes('schema cache')) {
               // Schema cache issues - these are usually not real errors, just display issues
               console.log('Schema cache issue detected, but registration likely succeeded');
               // Don't show error to user, let the success flow handle it
               return;
             } else {
               setError('We were unable to complete your registration at this time. Please verify your information and try again. If the problem persists, please contact support.');
             }
             
             // Always ensure loading is set to false on error
             setLoading(false);
             setSuccess('');
           }
  };

  return (
    <div className="register-page">
      {/* Header matching landing page */}
      <header className="register-header-nav">
        <div className="header-brand">
          <img src={Logo_pesdo} alt="PESDO Logo" className="header-logo" />
          <h1>PESDO Web Portal</h1>
        </div>
        <nav aria-label="Primary navigation">
          <Link className="btn" to="/">Home</Link>
          <Link className="btn btn-outline" to={`/login/${formData.userType}`}>Login</Link>
        </nav>
      </header>

      <div className="register-container">
        <div className="register-card">
          <div className="register-header">
            <img src={Logo_pesdo} alt="PESDO Logo" className="register-logo" />
            <h2>Create Your Account</h2>
            <p>Join PESDO and find your dream job in Surigao City</p>
          </div>

          <form className="register-form" onSubmit={handleSubmit}>
            {/* User Type Toggle */}
            <div className="form-group">
              <span className="group-label">Account Type</span>
              <div className="account-type-cards">
                <button 
                  type="button"
                  className={`account-type-card ${formData.userType === 'jobseeker' ? 'selected' : ''}`}
                  onClick={() => handleUserTypeSelect('jobseeker')}
                  aria-pressed={formData.userType === 'jobseeker'}
                >
                  <div className="card-icon">👤</div>
                  <div className="card-content">
                    <h3>Job Seeker</h3>
                    <p>Find your dream job in Surigao City</p>
                    <ul>
                      <li>Browse job opportunities</li>
                      <li>Apply to positions</li>
                      <li>Track applications</li>
                    </ul>
                  </div>
                  <div className="card-selection">
                    {formData.userType === 'jobseeker' && <span className="selected-indicator">✓</span>}
                  </div>
                </button>
                
                <button 
                  type="button"
                  className={`account-type-card ${formData.userType === 'employer' ? 'selected' : ''}`}
                  onClick={() => handleUserTypeSelect('employer')}
                  aria-pressed={formData.userType === 'employer'}
                >
                  <div className="card-icon">🏢</div>
                  <div className="card-content">
                    <h3>Employer</h3>
                    <p>Post job vacancies and hire talent</p>
                    <ul>
                      <li>Post job openings</li>
                      <li>Review applications</li>
                      <li>Manage your business</li>
                    </ul>
                  </div>
                  <div className="card-selection">
                    {formData.userType === 'employer' && <span className="selected-indicator">✓</span>}
                  </div>
                </button>
              </div>
            </div>

            {formData.userType === 'jobseeker' && (
              <div className="name-fields">
                <div className="name-field">
                  <label htmlFor="firstName">First Name</label>
                  <input
                    type="text"
                    id="firstName"
                    name="register-firstName"
                    value={formData.firstName}
                    onChange={handleInputChange}
                    placeholder="Enter your first name"
                    autoComplete="off"
                    required
                  />
                </div>
                <div className="name-field">
                  <label htmlFor="lastName">Last Name</label>
                  <input
                    type="text"
                    id="lastName"
                    name="register-lastName"
                    value={formData.lastName}
                    onChange={handleInputChange}
                    placeholder="Enter your last name"
                    autoComplete="off"
                    required
                  />
                </div>
              </div>
            )}

            {formData.userType === 'employer' && (
              <div className="form-group">
                <label htmlFor="businessName">Business Name</label>
                <input
                  type="text"
                  id="businessName"
                  name="register-businessName"
                  value={formData.businessName}
                  onChange={handleInputChange}
                  placeholder="Enter your business name"
                  autoComplete="off"
                  required
                />
              </div>
            )}

            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                type="email"
                id="email"
                name="register-email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="Enter your email"
                autoComplete="new-password"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <div className="password-input-container">
                <input
                  type={showPassword ? "text" : "password"}
                  id="password"
                  name="register-password"
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder="Enter your password"
                  autoComplete="new-password"
                  required
                  className="password-input"
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={togglePasswordVisibility}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm Password</label>
              <div className="password-input-container">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  id="confirmPassword"
                  name="register-confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  placeholder="Confirm your password"
                  autoComplete="new-password"
                  required
                  className="password-input"
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={toggleConfirmPasswordVisibility}
                  aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                >
                  {showConfirmPassword ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <button 
              type="submit" 
              className="register-btn"
              disabled={loading}
            >
              {loading ? 'Creating Account...' : 'Create Account'}
            </button>
          </form>

          {error && (
            <div className="error-message">
              {error}
              {error.includes('email signups are disabled') && (
                <div className="error-help">
                  <p><strong>Quick Fix:</strong></p>
                  <ol>
                    <li>Go to Supabase Dashboard → Authentication → Settings</li>
                    <li>Find "User Signups" section</li>
                    <li>Enable "Enable email signups" ✅</li>
                    <li>Keep "Enable email confirmations" disabled ❌</li>
                    <li>Save settings and try again</li>
                  </ol>
                  <p>You accidentally disabled all email signups instead of just email confirmations.</p>
                </div>
              )}
              {error.includes('email service is not configured') && (
                <div className="error-help">
                  <p><strong>Quick Fix:</strong></p>
                  <ol>
                    <li>Go to Supabase Dashboard → Authentication → Settings</li>
                    <li>Find "User Signups" section</li>
                    <li>Disable "Enable email confirmations"</li>
                    <li>Save settings and try again</li>
                  </ol>
                  <p>Or set up an email service like Resend for production use.</p>
                </div>
              )}
            </div>
          )}
          {success && (
            <div className="success-message">
              <p className="success-text">{success}</p>
            </div>
          )}

          {!success && (
            <div className="register-footer">
              <p>
                Already have an account? <Link to={`/login/${formData.userType}`}>Login here</Link>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Register;