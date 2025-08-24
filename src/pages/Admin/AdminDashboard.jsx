import React, { useState } from "react";
import "./AdminDashboard.css";
import { 
  FaChartLine, 
  FaUserTie, 
  FaUsers, 
  FaBriefcase, 
  FaHandshake, 
  FaSignOutAlt,
  FaSearch,
  FaBell,
  FaUserCircle
} from "react-icons/fa";

const AdminDashboard = () => {
  const [activePage, setActivePage] = useState("Analytics");
  const [searchQuery, setSearchQuery] = useState("");
  const [notifications, setNotifications] = useState(3);
  const [userData, setUserData] = useState({
    name: "Admin User",
    role: "Administrator"
  });

  // Navigation functions
  const handleNavigation = (page) => {
    setActivePage(page);
    console.log(`Navigated to ${page} page`);
  };

  const handleLogout = () => {
    console.log("User logged out");
    // Add your logout logic here (e.g., clear auth token, redirect)
    window.location.href = "/login";
  };

  // Search function
  const handleSearch = (e) => {
    e.preventDefault();
    console.log("Searching for:", searchQuery);
    // Add your search logic here
  };

  // Card action functions
  const handleTotalUsersClick = () => {
    console.log("Viewing all users");
    setActivePage("Jobseekers");
  };

  const handleActiveJobsClick = () => {
    console.log("Viewing active jobs");
    setActivePage("Vacancies");
  };

  const handleReportsClick = () => {
    console.log("Viewing reports");
    setActivePage("Analytics");
  };

  // Notification function
  const handleNotificationClick = () => {
    console.log("Viewing notifications");
    setNotifications(0);
  };

  return (
    <div className="dashboard-container">
      {/* Sidebar */}
      <aside className="sidebar">
        <h2 className="logo">Admin Panel</h2>
        <ul>
          <li
            className={activePage === "Analytics" ? "active" : ""}
            onClick={() => handleNavigation("Analytics")}
          >
            <FaChartLine /> Analytics Report
          </li>
          <li
            className={activePage === "Jobseekers" ? "active" : ""}
            onClick={() => handleNavigation("Jobseekers")}
          >
            <FaUsers /> Manage Jobseekers
          </li>
          <li
            className={activePage === "Employers" ? "active" : ""}
            onClick={() => handleNavigation("Employers")}
          >
            <FaUserTie /> Manage Employers
          </li>
          <li
            className={activePage === "Vacancies" ? "active" : ""}
            onClick={() => handleNavigation("Vacancies")}
          >
            <FaBriefcase /> Manage Job Vacancies
          </li>
          <li
            className={activePage === "Matching" ? "active" : ""}
            onClick={() => handleNavigation("Matching")}
          >
            <FaHandshake /> Job Matching
          </li>
          <li className="logout" onClick={handleLogout}>
            <FaSignOutAlt /> Logout
          </li>
        </ul>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        {/* Header with search and user info */}
        <header className="dashboard-header">
          <div className="header-left">
            <h1>{activePage} Dashboard</h1>
          </div>
          <div className="header-right">
            <form onSubmit={handleSearch} className="search-form">
              <div className="search-container">
                <FaSearch className="search-icon" />
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="search-input"
                />
              </div>
            </form>
            
            <button 
              className="notification-btn"
              onClick={handleNotificationClick}
            >
              <FaBell />
              {notifications > 0 && (
                <span className="notification-badge">{notifications}</span>
              )}
            </button>
            
            <div className="user-profile">
              <FaUserCircle className="user-avatar" />
              <div className="user-info">
                <span className="user-name">{userData.name}</span>
                <span className="user-role">{userData.role}</span>
              </div>
            </div>
          </div>
        </header>

        {/* Dashboard Cards */}
        <section className="dashboard-cards">
          <div 
            className="card" 
            onClick={handleTotalUsersClick}
            style={{ cursor: "pointer" }}
          >
            <h3>Total Users</h3>
            <p>120</p>
            <button className="card-action-btn">View All</button>
          </div>
          <div 
            className="card" 
            onClick={handleActiveJobsClick}
            style={{ cursor: "pointer" }}
          >
            <h3>Active Jobs</h3>
            <p>45</p>
            <button className="card-action-btn">View Jobs</button>
          </div>
          <div 
            className="card" 
            onClick={handleReportsClick}
            style={{ cursor: "pointer" }}
          >
            <h3>Reports</h3>
            <p>10</p>
            <button className="card-action-btn">Generate Report</button>
          </div>
        </section>

        {/* Page Content */}
        <section className="page-content">
          {activePage === "Analytics" && (
            <AnalyticsView 
              onGenerateReport={() => console.log("Report generated")}
            />
          )}
          {activePage === "Jobseekers" && (
            <JobseekersView 
              onAddJobseeker={() => console.log("Add jobseeker clicked")}
            />
          )}
          {/* Add other views similarly */}
        </section>
      </main>
    </div>
  );
};

// Example component for Analytics view
const AnalyticsView = ({ onGenerateReport }) => (
  <div>
    <div className="section-header">
      <h2>Analytics Overview</h2>
      <button 
        className="submit" // Reusing your login button style
        onClick={onGenerateReport}
      >
        Generate Full Report
      </button>
    </div>
    <p>Dashboard analytics and insights go here.</p>
    <div className="analytics-grid">
      {/* Your analytics components */}
    </div>
  </div>
);

// Example component for Jobseekers view
const JobseekersView = ({ onAddJobseeker }) => (
  <div>
    <div className="section-header">
      <h2>Jobseekers Management</h2>
      <button 
        className="submit" // Reusing your login button style
        onClick={onAddJobseeker}
      >
        Add New Jobseeker
      </button>
    </div>
    <p>Manage your jobseekers data here.</p>
    {/* Jobseekers table or list */}
  </div>
);

export default AdminDashboard;