import React, { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import "./Login.css";
import { FaEnvelope, FaLock, FaEye, FaEyeSlash } from "react-icons/fa";
import Logo_pesdo from "../assets/Logo_pesdo.png";
import { useAuth } from "../contexts/AuthContext.jsx";

const Login = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const auth = useAuth();
  const { login, currentUser, userData, loading: authLoading, profileLoaded } = auth || {};
  const [email, setEmail] = useState("jester@gmail.com");
  const [password, setPassword] = useState("Cjcalamba@12");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  
  // Get user type from URL parameter
  const userType = searchParams.get('type') || 'jobseeker';

  // Handle redirection after successful login
  useEffect(() => {
    if (!auth) return; // Ensure auth context is available
    
    console.log('Login useEffect - Auth state:', { 
      currentUser: !!currentUser, 
      userData: !!userData, 
      authLoading,
      userEmail: currentUser?.email,
      userId: currentUser?.id
    });
    
    console.log('🔍 Login redirect check:', {
      hasCurrentUser: !!currentUser,
      authLoadingComplete: !authLoading,
      profileLoaded: profileLoaded,
      shouldRedirect: currentUser && !authLoading && profileLoaded
    });
    
    // Redirect when user is authenticated, auth loading is false, and profile is loaded
    if (currentUser && !authLoading && profileLoaded) {
      console.log('✅ User authenticated and profile loaded, redirecting to dashboard...');
      console.log('User type from URL:', userType);
      console.log('User data:', userData);
      console.log('User type from userData:', userData?.userType);
      
      // Redirect based on userData.userType (determined from database profile)
      // Use replace: true to prevent back button from returning to login page
      if (userData?.userType === 'employer') {
        console.log('Redirecting to employer dashboard');
        navigate('/employer', { replace: true });
      } else if (userData?.userType === 'admin' || userData?.userType === 'super_admin') {
        console.log('Redirecting to admin dashboard');
        const host = typeof window !== 'undefined' ? window.location.hostname : '';
        navigate(host.startsWith('admin.') ? '/dashboard' : '/admin/dashboard', { replace: true });
      } else {
        console.log('Redirecting to jobseeker dashboard');
        navigate('/jobseeker', { replace: true }); // Default to jobseeker
      }
    }
  }, [currentUser, userData, authLoading, profileLoaded, navigate, auth, userType]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    
    if (!email || !password) {
      setError("Please fill in all fields");
      return;
    }

    try {
      setLoading(true);
      
      // Auth is working, just call it directly with expected user type
      console.log('🔍 Login attempt - Email:', email, 'Expected UserType:', userType);
      await login(email, password, userType);
      
      console.log('Login completed successfully');
      // Login successful - user will be redirected by the useEffect
      setLoading(false);
    } catch (err) {
      console.error('Login error:', err);
      let errorMessage = 'Failed to login. Please try again.';
      
      if (err.message?.includes('timeout')) {
        errorMessage = 'Login timed out after 15 seconds. Please try again or check your credentials.';
      } else if (err.message?.includes('Supabase auth timeout')) {
        errorMessage = 'Authentication service is slow. Please try again in a moment.';
      } else if (err.message?.includes('Cannot connect to Supabase')) {
        errorMessage = 'Cannot connect to the server. Please check your internet connection.';
      } else if (err.message?.includes('Invalid login credentials')) {
        errorMessage = 'Invalid email or password. Please check your credentials.';
      } else if (err.message?.includes('Email not confirmed')) {
        errorMessage = 'Please check your email and confirm your account before logging in.';
      } else if (err.code === 'auth/user-not-found') {
        errorMessage = 'No account found with this email address.';
      } else if (err.code === 'auth/wrong-password') {
        errorMessage = 'Incorrect password. Please try again.';
      } else if (err.code === 'auth/invalid-email') {
        errorMessage = 'Please enter a valid email address.';
      } else if (err.code === 'auth/too-many-requests') {
        errorMessage = 'Too many failed attempts. Please try again later.';
      } else if (err.message?.includes('This account is registered as')) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      {/* Header matching landing page */}
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
            <img src={Logo_pesdo} alt="PESDO Logo" className="login-logo" />
            <h2>Welcome Back</h2>
            <p>
              {userType === 'employer' ? (
                <>
                  <span className="login-type-badge employer">🏢</span>
                  Login to your Employer Dashboard
                </>
              ) : (
                <>
                  <span className="login-type-badge jobseeker">👤</span>
                  Login to your Jobseeker Dashboard
                </>
              )}
            </p>
          </div>

          {error && <div className="error-message">{error}</div>}

          <form className="login-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="email">
                <FaEnvelope className="label-icon" />
                Email
              </label>
              <input
                type="email"
                id="email"
                className="form-input"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">
                <FaLock className="label-icon" />
                Password
              </label>
              <div className="password-input-container">
                <input
                  type={showPassword ? "text" : "password"}
                  id="password"
                  className="form-input"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <span
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <FaEye /> : <FaEyeSlash />}
                </span>
              </div>
            </div>

            <button 
              type="submit" 
              className="login-btn"
              disabled={loading}
            >
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </form>

          <div className="login-footer">
            <p>
              Don't have an account? <Link to="/register">Sign up here</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
