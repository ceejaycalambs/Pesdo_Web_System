import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import SignUp from './signUp/SignUp';
import Login from './Login/Login';
import JobseekerLogin from './Login/JobseekerLogin';
import EmployerLogin from './Login/EmployerLogin';
import Register from './pages/Register';
import JobseekerDashboard from './pages/Jobseeker/JobseekerDashboard';
import EmployerDashboard from './pages/Employer/EmployerDashboard';
import AdminLanding from './pages/Admin/AdminLanding';
import AdminDashboard from './pages/Admin/AdminDashboard';
import UserManagement from './pages/Admin/UserManagement';
import JobManagementSimplified from './pages/Admin/JobManagementSimplified';
import EmployerVerificationSimple from './pages/Admin/EmployerVerificationSimple';
import AdminAnalytics from './pages/Admin/AdminAnalytics';
import SuperAdminLogs from './pages/Admin/SuperAdminLogs';
import AdminManagement from './pages/Admin/AdminManagement';
import AuthCallback from './pages/AuthCallback';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import { AuthProvider } from './contexts/AuthContext.jsx';
import './styles/responsive.css';


function App() {
    return (
        <Router>
            <AuthProvider>
                <Routes>
                    <Route path="/" element={<LandingPage />} />
                    <Route path="/register" element={<Register />} />
                    <Route path="/signup" element={<SignUp />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/login/jobseeker" element={<JobseekerLogin />} />
                    <Route path="/login/employer" element={<EmployerLogin />} />
                    <Route path="/jobseeker" element={<JobseekerDashboard />} />
                    <Route path="/employer" element={<EmployerDashboard />} />
                    <Route path="/admin" element={<AdminLanding />} />
                    <Route path="/admin/dashboard" element={<AdminDashboard />} />
                    <Route path="/admin/users" element={<UserManagement />} />
                    <Route path="/admin/jobs" element={<JobManagementSimplified />} />
                    <Route path="/admin/verification" element={<EmployerVerificationSimple />} />
                    <Route path="/admin/analytics" element={<AdminAnalytics />} />
                    <Route path="/admin/logs" element={<SuperAdminLogs />} />
                    <Route path="/admin/settings" element={<AdminManagement />} />
                    <Route path="/auth/callback" element={<AuthCallback />} />
                    <Route path="/forgot-password" element={<ForgotPassword />} />
                    <Route path="/reset-password" element={<ResetPassword />} />
                </Routes>
            </AuthProvider>
        </Router>
    );
}

export default App;
