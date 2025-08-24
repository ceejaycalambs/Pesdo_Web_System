import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Logo_pesdo from '../assets/Logo_pesdo.png';
import { useAuth } from '../contexts/AuthContext.jsx';
import './Register.css';

const Register = () => {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    userType: 'jobseeker' // default to jobseeker
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleUserTypeToggle = () => {
    setFormData(prev => ({
      ...prev,
      userType: prev.userType === 'jobseeker' ? 'employer' : 'jobseeker'
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Validation
    if (!formData.username || !formData.email || !formData.password || !formData.confirmPassword) {
      setError('Please fill in all fields');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    try {
      setLoading(true);
      await register(formData.email, formData.password, {
        username: formData.username,
        userType: formData.userType
      });
      
      setSuccess('Account created successfully! Redirecting...');
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (err) {
      console.error('Registration error:', err);
      setError(err.message || 'Failed to create account. Please try again.');
    } finally {
      setLoading(false);
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
          <Link className="btn btn-outline" to="/login">Login</Link>
        </nav>
      </header>

      <div className="register-container">
        <div className="register-card">
          <div className="register-header">
            <img src={Logo_pesdo} alt="PESDO Logo" className="register-logo" />
            <h2>Create Your Account</h2>
            <p>Join PESDO and find your dream job in Surigao City</p>
          </div>

          {error && <div className="error-message">{error}</div>}
          {success && <div className="success-message">{success}</div>}

          <form className="register-form" onSubmit={handleSubmit}>
            {/* User Type Toggle */}
            <div className="form-group">
              <label>Account Type</label>
              <div className="toggle-container">
                <span className={`toggle-label ${formData.userType === 'jobseeker' ? 'active' : ''}`}>
                  Job Seeker
                </span>
                <div className="toggle-switch" onClick={handleUserTypeToggle}>
                  <div className={`toggle-slider ${formData.userType === 'employer' ? 'toggled' : ''}`}></div>
                </div>
                <span className={`toggle-label ${formData.userType === 'employer' ? 'active' : ''}`}>
                  Employer
                </span>
              </div>
              <p className="toggle-description">
                {formData.userType === 'jobseeker' 
                  ? 'Looking for job opportunities' 
                  : 'Posting job vacancies'
                }
              </p>
            </div>

            <div className="form-group">
              <label htmlFor="username">Username</label>
              <input
                type="text"
                id="username"
                name="username"
                value={formData.username}
                onChange={handleInputChange}
                placeholder="Enter your username"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="Enter your email"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                placeholder="Enter your password"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm Password</label>
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                placeholder="Confirm your password"
                required
              />
            </div>

            <button 
              type="submit" 
              className="register-btn"
              disabled={loading}
            >
              {loading ? 'Creating Account...' : 'Create Account'}
            </button>
          </form>

          <div className="register-footer">
            <p>
              Already have an account? <Link to="/login">Login here</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;