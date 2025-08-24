import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import SignUp from './signUp/SignUp';
import Login from './Login/Login';
import Register from './pages/Register';
import JobseekerDashboard from './pages/Jobseeker/JobseekerDashboard';
import EmployerDashboard from './pages/Employer/EmployerDashboard';
import AdminDashboard from './pages/Admin/AdminDashboard';
import { AuthProvider, useAuth } from './contexts/AuthContext.jsx';


// Protected Route Component
const ProtectedRoute = ({ children, allowedUserTypes = [] }) => {
  const { currentUser, userData, loading } = useAuth();

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!currentUser) {
    return <Navigate to="/login" />;
  }

  if (allowedUserTypes.length > 0 && userData && !allowedUserTypes.includes(userData.userType)) {
    // Redirect to appropriate dashboard based on user type
    if (userData.userType === 'jobseeker') {
      return <Navigate to="/jobseeker" />;
    } else if (userData.userType === 'employer') {
      return <Navigate to="/employer" />;
    } else if (userData.userType === 'admin') {
      return <Navigate to="/admin" />;
    }
  }

  return children;
};

// Public Route Component (redirects authenticated users)
const PublicRoute = ({ children }) => {
  const { currentUser, userData, loading } = useAuth();

  if (loading) {
    return <div>Loading...</div>;
  }

  if (currentUser && userData) {
    // Redirect to appropriate dashboard based on user type
    if (userData.userType === 'jobseeker') {
      return <Navigate to="/jobseeker" />;
    } else if (userData.userType === 'employer') {
      return <Navigate to="/employer" />;
    } else if (userData.userType === 'admin') {
      return <Navigate to="/admin" />;
    }
  }

  return children;
};

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
      <Route path="/signup" element={<PublicRoute><SignUp /></PublicRoute>} />
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/jobseeker" element={<ProtectedRoute allowedUserTypes={['jobseeker']}><JobseekerDashboard /></ProtectedRoute>} />
      <Route path="/employer" element={<ProtectedRoute allowedUserTypes={['employer']}><EmployerDashboard /></ProtectedRoute>} />
      <Route path="/admin" element={<ProtectedRoute allowedUserTypes={['admin']}><AdminDashboard /></ProtectedRoute>} />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppRoutes />
      </Router>
    </AuthProvider>
  );
}

export default App;
