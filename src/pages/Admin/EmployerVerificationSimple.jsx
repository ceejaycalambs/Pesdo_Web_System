import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../supabase.js';
import { logActivity } from '../../utils/activityLogger';
import { useAuth } from '../../contexts/AuthContext';
import { useRealtimeNotifications } from '../../hooks/useRealtimeNotifications';
import NotificationButton from '../../components/NotificationButton';
import { sendSMS } from '../../services/smsService';
import { sendEmployerVerificationEmail } from '../../services/emailService';
import './EmployerVerification.css';

const EmployerVerificationSimple = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [employers, setEmployers] = useState([]);
  const [filteredEmployers, setFilteredEmployers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmployer, setSelectedEmployer] = useState(null);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [verificationNotes, setVerificationNotes] = useState('');
  const [verificationStatus, setVerificationStatus] = useState('pending');
  const [isUpdating, setIsUpdating] = useState(false);
  const [notification, setNotification] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [adminRole, setAdminRole] = useState(null);
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0
  });

  // Realtime notifications
  const {
    notifications: realtimeNotifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    requestNotificationPermission
  } = useRealtimeNotifications(currentUser?.id, 'admin');

  // Request notification permission on mount
  useEffect(() => {
    if (currentUser?.id) {
      requestNotificationPermission();
    }
  }, [currentUser?.id, requestNotificationPermission]);

  // Fetch employers directly from employer_profiles
  const fetchEmployers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('employer_profiles')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) throw error;
      console.log('📊 Fetched employers:', data);
      const employersData = data || [];
      setEmployers(employersData);
      setFilteredEmployers(employersData);
      
      // Calculate stats - handle null verification_status
      const total = employersData.length;
      const pending = employersData.filter(emp => !emp.verification_status || emp.verification_status === 'pending').length;
      const approved = employersData.filter(emp => emp.verification_status === 'approved').length;
      const rejected = employersData.filter(emp => emp.verification_status === 'rejected').length;
      
      setStats({ total, pending, approved, rejected });
    } catch (error) {
      console.error('Error fetching employers:', error);
    } finally {
      setLoading(false);
    }
  };

  // Handle verification
  const handleVerification = async () => {
    try {
      setIsUpdating(true);
      console.log('🔄 Updating verification:', {
        employerId: selectedEmployer.id,
        newStatus: verificationStatus,
        notes: verificationNotes
      });

      const updateData = {
        verification_status: verificationStatus,
        verification_notes: verificationNotes
      };

      // Only add verified_at if status is approved
      if (verificationStatus === 'approved') {
        updateData.verified_at = new Date().toISOString();
      }

      console.log('📤 Update data:', updateData);

      const { data, error } = await supabase
        .from('employer_profiles')
        .update(updateData)
        .eq('id', selectedEmployer.id)
        .select();

      if (error) {
        console.error('❌ Supabase error:', error);
        throw error;
      }

      console.log('✅ Update successful:', data);

      // Log activity with admin name
      if (currentUser?.id) {
        // Get admin name
        const { data: adminProfile } = await supabase
          .from('admin_profiles')
          .select('first_name, last_name, username, email')
          .eq('id', currentUser.id)
          .maybeSingle();
        
        const adminName = adminProfile 
          ? `${adminProfile.first_name || ''} ${adminProfile.last_name || ''}`.trim() || adminProfile.username || adminProfile.email || 'Admin'
          : 'Admin';
        
        const actionType = verificationStatus === 'approved' ? 'employer_verified' : 
                          verificationStatus === 'rejected' ? 'employer_rejected' : 
                          'employer_verification_updated';
        const actionDescription = verificationStatus === 'approved' 
          ? `${adminName} verified employer: ${selectedEmployer.business_name || selectedEmployer.email}`
          : verificationStatus === 'rejected'
          ? `${adminName} rejected employer verification: ${selectedEmployer.business_name || selectedEmployer.email}`
          : `${adminName} updated employer verification status to ${verificationStatus}`;

        await logActivity({
          userId: currentUser.id,
          userType: adminRole === 'super_admin' ? 'super_admin' : 'admin',
          actionType: actionType,
          actionDescription: actionDescription,
          entityType: 'profile',
          entityId: selectedEmployer.id,
          metadata: {
            adminName: adminName,
            employerId: selectedEmployer.id,
            businessName: selectedEmployer.business_name,
            verificationStatus: verificationStatus,
            verificationNotes: verificationNotes
          }
        });
      }

      // Create notification for employer about verification update
      if (verificationStatus === 'approved' || verificationStatus === 'rejected') {
        try {
          const isApproved = verificationStatus === 'approved';
          const notesText = !isApproved && verificationNotes ? ` Notes: ${verificationNotes}` : '';
          const notificationMessage = isApproved
            ? '🎉 Your employer account has been approved. You can now post job vacancies.'
            : `⚠️ Your employer verification status is now REJECTED.${notesText}`;

          await supabase
            .from('notifications')
            .insert([
              {
                employer_id: selectedEmployer.id,
                type: isApproved ? 'employer_verification_approved' : 'employer_verification_rejected',
                title: isApproved ? 'Employer Verification Approved' : 'Employer Verification Update',
                message: notificationMessage,
                is_read: false,
                created_at: new Date().toISOString()
              }
            ]);
        } catch (notificationError) {
          console.error('❌ Error creating employer verification notification:', notificationError);
        }
      }

      // Send SMS and Email notifications to employer (non-blocking)
      if (verificationStatus === 'approved' || verificationStatus === 'rejected') {
        try {
          const { data: employerProfile } = await supabase
            .from('employer_profiles')
            .select('mobile_number, email, contact_email, business_name, contact_person_name')
            .eq('id', selectedEmployer.id)
            .single();

          if (employerProfile) {
            const employerName = employerProfile.contact_person_name || employerProfile.business_name || 'Employer';
            const employerEmail = employerProfile.contact_email || employerProfile.email;

            // Send SMS if mobile number is available
            if (employerProfile.mobile_number) {
              const message = verificationStatus === 'approved'
                ? `Hi ${employerName}! Your employer account has been APPROVED. You can now post job vacancies. - PESDO`
                : `Hi ${employerName}! Your verification was REJECTED. Check dashboard for details. - PESDO`;

              sendSMS({
                to: employerProfile.mobile_number,
                message: message
              }).then(() => {
                console.log('✅ SMS notification sent to employer');
              }).catch((smsError) => {
                console.error('⚠️ Failed to send SMS notification (non-critical):', smsError);
              });
            }

            // Send Email if email is available
            if (employerEmail) {
              sendEmployerVerificationEmail(
                employerEmail,
                employerName,
                verificationStatus,
                verificationNotes || null
              ).then(() => {
                console.log('✅ Email notification sent to employer');
              }).catch((emailError) => {
                console.error('⚠️ Failed to send email notification (non-critical):', emailError);
              });
            }
          }
        } catch (error) {
          // Notification failures should not block the main action
          console.error('⚠️ Failed to send notifications (non-critical):', error);
        }
      }

      // Refresh data
      await fetchEmployers();
      
      // Close modal
      setShowVerificationModal(false);
      setSelectedEmployer(null);
      setVerificationNotes('');
      setVerificationStatus('pending');
      
      // Show success notification
      setNotification({
        type: 'success',
        message: `✅ Employer verification updated to: ${verificationStatus}`,
        show: true
      });
      
      // Auto-hide notification after 5 seconds
      setTimeout(() => {
        setNotification(prev => ({ ...prev, show: false }));
      }, 5000);
    } catch (error) {
      console.error('❌ Error updating verification:', error);
      
      // Show error notification
      setNotification({
        type: 'error',
        message: `❌ Error updating verification: ${error.message}`,
        show: true
      });
      
      // Auto-hide notification after 7 seconds (longer for errors)
      setTimeout(() => {
        setNotification(prev => ({ ...prev, show: false }));
      }, 7000);
    } finally {
      setIsUpdating(false);
    }
  };

  // Open verification modal
  const openVerificationModal = (employer) => {
    setSelectedEmployer(employer);
    setVerificationNotes(employer.verification_notes || '');
    setVerificationStatus(employer.verification_status || 'pending');
    setShowVerificationModal(true);
  };

  useEffect(() => {
    fetchEmployers();
  }, []);

  useEffect(() => {
    if (currentUser?.id) {
      fetchAdminRole();
    }
  }, [currentUser]);

  const fetchAdminRole = async () => {
    if (currentUser?.id) {
      try {
        const { data: adminProfile, error } = await supabase
          .from('admin_profiles')
          .select('role')
          .eq('id', currentUser.id)
          .single();
        
        if (!error && adminProfile) {
          setAdminRole(adminProfile.role || 'admin');
        } else {
          setAdminRole('admin');
        }
      } catch (error) {
        console.error('Error fetching admin role:', error);
        setAdminRole('admin');
      }
    }
  };

  // Filter employers based on search term
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredEmployers(employers);
      return;
    }

    const searchLower = searchTerm.toLowerCase().trim();
    const filtered = employers.filter(employer => {
      const businessName = (employer.business_name || '').toLowerCase();
      const email = (employer.email || '').toLowerCase();
      const contactPerson = (employer.contact_person_name || '').toLowerCase();
      const acronym = (employer.acronym || '').toLowerCase();
      const establishmentType = (employer.establishment_type || '').toLowerCase();
      const contactEmail = (employer.contact_email || '').toLowerCase();
      
      return (
        businessName.includes(searchLower) ||
        email.includes(searchLower) ||
        contactPerson.includes(searchLower) ||
        acronym.includes(searchLower) ||
        establishmentType.includes(searchLower) ||
        contactEmail.includes(searchLower)
      );
    });

    setFilteredEmployers(filtered);
  }, [searchTerm, employers]);

  const getStatusBadge = (status) => {
    const statusConfig = {
      pending: { class: 'status-pending', text: '⏳ Pending', color: '#f59e0b' },
      approved: { class: 'status-approved', text: '✅ Approved', color: '#10b981' },
      rejected: { class: 'status-rejected', text: '❌ Rejected', color: '#ef4444' }
    };
    
    const config = statusConfig[status] || statusConfig.pending;
    return (
      <span className={`status-badge ${config.class}`} style={{ backgroundColor: config.color }}>
        {config.text}
      </span>
    );
  };

  const getDocumentStatus = (employer) => {
    const hasBIR = employer.bir_document_url;
    const hasBusinessPermit = employer.business_permit_url;
    
    if (hasBIR && hasBusinessPermit) {
      return <span className="document-status complete">📄 Complete</span>;
    } else {
      return <span className="document-status incomplete">⚠️ Incomplete</span>;
    }
  };

  if (loading) {
    return (
      <div className="employer-verification">
        <div className="loading-screen">
          <div className="loading-spinner"></div>
          <p>Loading employer verification...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="employer-verification">
      {/* Header - Matching Admin Dashboard */}
      <div className="verification-page-header">
        <div className="header-content">
          <div className="header-left">
            <h1>🏢 Employer Verification</h1>
            <p>Review and verify employer documents before they can post job vacancies.</p>
          </div>
          <div className="header-right">
            <NotificationButton
              notifications={realtimeNotifications}
              unreadCount={unreadCount}
              onMarkAsRead={markAsRead}
              onMarkAllAsRead={markAllAsRead}
              onNotificationClick={(notification) => {
                // Navigate to job management page when notification is clicked
                const base = window.location.hostname.startsWith('admin.') ? '' : '/admin';
                navigate(`${base}/jobs`);
              }}
            />
            <button 
              className="back-btn"
              onClick={() => {
                const host = typeof window !== 'undefined' ? window.location.hostname : '';
                navigate(host.startsWith('admin.') ? '/dashboard' : '/admin/dashboard');
              }}
            >
              ← Back to Dashboard
            </button>
          </div>
        </div>
      </div>

      {/* Notification */}
      {notification && notification.show && (
        <div className={`notification ${notification.type}`}>
          <div className="notification-content">
            <span className="notification-message">{notification.message}</span>
            <button 
              className="notification-close"
              onClick={() => setNotification(prev => ({ ...prev, show: false }))}
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="verification-main">
        <div className="verification-header">
          <h2>Verification Overview</h2>
          <p>Manage employer account verification and document review process.</p>
        </div>

      {/* Statistics Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <h3>Total Employers</h3>
          <div className="stat-number">{stats.total}</div>
        </div>
        <div className="stat-card pending">
          <h3>Pending Review</h3>
          <div className="stat-number">{stats.pending}</div>
        </div>
        <div className="stat-card approved">
          <h3>Approved</h3>
          <div className="stat-number">{stats.approved}</div>
        </div>
        <div className="stat-card rejected">
          <h3>Rejected</h3>
          <div className="stat-number">{stats.rejected}</div>
        </div>
      </div>

      {/* Employers List - Table View for Admin Efficiency */}
      <div className="employers-list">
        <div className="employers-list-header">
          <h2>Employers Awaiting Verification</h2>
          <div className="search-container">
            <input
              type="text"
              className="search-input"
              placeholder="Search by business name, email, contact person..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button 
                className="clear-search-btn"
                onClick={() => setSearchTerm('')}
                title="Clear search"
              >
                ×
              </button>
            )}
          </div>
        </div>
        
        {filteredEmployers.length === 0 && employers.length > 0 ? (
          <div className="no-results">
            <div className="no-results-icon">🔍</div>
            <h3>No results found</h3>
            <p>No employers match your search term "{searchTerm}"</p>
            <button 
              className="btn-secondary"
              onClick={() => setSearchTerm('')}
            >
              Clear Search
            </button>
          </div>
        ) : employers.length === 0 ? (
          <div className="no-employers">
            <div className="no-employers-icon">🎉</div>
            <h3>All caught up!</h3>
            <p>No employers are currently awaiting verification.</p>
          </div>
        ) : (
          <div className="verification-table-container">
            <table className="verification-table">
              <thead>
                <tr>
                  <th>Business Name</th>
                  <th>Contact Person</th>
                  <th>Email</th>
                  <th>Establishment Type</th>
                  <th>Documents</th>
                  <th>Status</th>
                  <th>Registered</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredEmployers.map((employer) => (
                  <tr key={employer.id} className="employer-row">
                    <td className="business-name">
                      <div className="business-info">
                        <strong>{employer.business_name || 'No Business Name'}</strong>
                        {employer.acronym && (
                          <span className="acronym">({employer.acronym})</span>
                        )}
                      </div>
                    </td>
                    <td className="contact-person">
                      <div className="contact-info">
                        <div>{employer.contact_person_name || '-'}</div>
                        <div className="position">{employer.contact_position || ''}</div>
                      </div>
                    </td>
                    <td className="email">
                      <a href={`mailto:${employer.email}`} className="email-link">
                        {employer.email}
                      </a>
                    </td>
                    <td className="establishment-type">
                      {employer.establishment_type || '-'}
                    </td>
                    <td className="documents">
                      <div className="document-status">
                        {employer.bir_document_url && (
                          <button 
                            className="document-btn bir"
                            onClick={() => window.open(employer.bir_document_url, '_blank')}
                            title="View BIR Document"
                          >
                            📄 BIR
                          </button>
                        )}
                        {employer.business_permit_url && (
                          <button 
                            className="document-btn permit"
                            onClick={() => window.open(employer.business_permit_url, '_blank')}
                            title="View Business Permit"
                          >
                            🏢 Permit
                          </button>
                        )}
                        {!employer.bir_document_url && !employer.business_permit_url && (
                          <span className="no-documents">No documents</span>
                        )}
                      </div>
                    </td>
                    <td className="status">
                      {getStatusBadge(employer.verification_status || 'pending')}
                    </td>
                    <td className="registered-date">
                      {new Date(employer.created_at).toLocaleDateString()}
                    </td>
                    <td className="actions">
                      <div className="action-buttons">
                        <button 
                          className="btn-primary btn-sm"
                          onClick={() => openVerificationModal(employer)}
                        >
                          {employer.verification_status === 'pending' ? 'Review' : 'Update'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      </div>

      {/* Verification Modal */}
      {showVerificationModal && selectedEmployer && (
        <div className="modal-overlay" onClick={() => setShowVerificationModal(false)}>
          <div className="modal-content verification-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Review Documents - {selectedEmployer.business_name || 'No Business Name'}</h2>
            </div>
            
            <div className="modal-body">
              <div className="verification-form">
                <div className="form-group">
                  <label>Verification Status</label>
                  <select 
                    value={verificationStatus}
                    onChange={(e) => setVerificationStatus(e.target.value)}
                    className="form-select"
                  >
                    <option value="pending">⏳ Pending</option>
                    <option value="approved">✅ Approved</option>
                    <option value="rejected">❌ Rejected</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Verification Notes</label>
                  <textarea
                    value={verificationNotes}
                    onChange={(e) => setVerificationNotes(e.target.value)}
                    className="form-textarea"
                    rows="4"
                    placeholder="Add notes about the verification decision..."
                  />
                </div>

                <div className="document-links">
                  <h4>Review Documents:</h4>
                  <div className="document-buttons">
                    {selectedEmployer.bir_document_url && (
                      <button 
                        className="btn-secondary"
                        onClick={() => window.open(selectedEmployer.bir_document_url, '_blank')}
                      >
                        📄 View BIR Document
                      </button>
                    )}
                    {selectedEmployer.business_permit_url && (
                      <button 
                        className="btn-secondary"
                        onClick={() => window.open(selectedEmployer.business_permit_url, '_blank')}
                      >
                        🏢 View Business Permit
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="modal-footer">
              <button 
                className="btn-secondary"
                onClick={() => setShowVerificationModal(false)}
              >
                Cancel
              </button>
              <button 
                className="btn-primary"
                onClick={handleVerification}
                disabled={isUpdating}
              >
                {isUpdating ? (
                  <>
                    <div className="loading-spinner"></div>
                    Updating...
                  </>
                ) : (
                  'Update Verification'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployerVerificationSimple;
