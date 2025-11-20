import React from 'react';
import './PrivacyPolicy.css';

const PrivacyPolicy = ({ onClose }) => {
  return (
    <div className="privacy-modal-overlay" onClick={onClose}>
      <div className="privacy-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="privacy-modal-header">
          <h2>Privacy Policy</h2>
          <button className="privacy-modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="privacy-modal-body">
          <div className="privacy-content">
            <p className="privacy-intro">
              <strong>Last Updated:</strong> {new Date().toLocaleDateString()}
            </p>
            <p className="privacy-intro">
              PESDO (Public Employment Service Office) is committed to protecting your privacy. 
              This Privacy Policy explains how we collect, use, disclose, and safeguard your 
              information when you use our web portal.
            </p>
            
            <section>
              <h3>1. Information We Collect</h3>
              
              <h4>For Jobseekers:</h4>
              <ul>
                <li><strong>Personal Information:</strong> Name, email address, phone number, address, age, gender, civil status</li>
                <li><strong>Professional Information:</strong> Education, work experience, preferred jobs, resume/CV, profile picture</li>
                <li><strong>Application Data:</strong> Job applications, application status, referral information</li>
                <li><strong>Account Information:</strong> Login credentials, account activity</li>
              </ul>
              
              <h4>For Employers:</h4>
              <ul>
                <li><strong>Business Information:</strong> Business name, contact person, email, phone number, address</li>
                <li><strong>Verification Documents:</strong> BIR Certificate, Business Permit, Company Logo</li>
                <li><strong>Job Posting Data:</strong> Job vacancies, job descriptions, application reviews</li>
                <li><strong>Account Information:</strong> Login credentials, verification status, account activity</li>
              </ul>
              
              <h4>For Administrators:</h4>
              <ul>
                <li><strong>Admin Information:</strong> Name, email, role (admin/super_admin)</li>
                <li><strong>Activity Logs:</strong> System actions, verification decisions, job approvals</li>
              </ul>
            </section>

            <section>
              <h3>2. How We Use Your Information</h3>
              <p>We use collected information to:</p>
              <ul>
                <li>Create and manage your account</li>
                <li>Process job applications and referrals</li>
                <li>Verify employer accounts and documents</li>
                <li>Send notifications (email, SMS, in-app) about:
                  <ul>
                    <li>Application status updates</li>
                    <li>New job opportunities</li>
                    <li>Account verification status</li>
                    <li>Job approval/rejection</li>
                    <li>System updates</li>
                  </ul>
                </li>
                <li>Match jobseekers with suitable job opportunities</li>
                <li>Enable communication between jobseekers and employers</li>
                <li>Improve platform functionality and user experience</li>
                <li>Comply with legal obligations</li>
                <li>Generate analytics and reports (anonymized)</li>
              </ul>
            </section>

            <section>
              <h3>3. Information Sharing and Disclosure</h3>
              <p>We share your information only in the following circumstances:</p>
              
              <h4>With Other Users:</h4>
              <ul>
                <li><strong>Jobseekers to Employers:</strong> When you apply to a job, employers see your name, resume, and application details</li>
                <li><strong>Employers to Jobseekers:</strong> Job postings and company information are visible to jobseekers</li>
                <li><strong>Admin Referrals:</strong> Admins may refer jobseekers to employers, sharing relevant application information</li>
              </ul>
              
              <h4>With Service Providers:</h4>
              <ul>
                <li><strong>Supabase:</strong> Cloud database and authentication services</li>
                <li><strong>Email Services:</strong> For sending email notifications</li>
                <li><strong>SMS Services (TextBee):</strong> For sending SMS notifications</li>
                <li><strong>Storage Services:</strong> For storing documents and files</li>
              </ul>
              
              <h4>Legal Requirements:</h4>
              <ul>
                <li>When required by law or legal process</li>
                <li>To protect rights, property, or safety</li>
                <li>To prevent fraud or abuse</li>
                <li>To comply with government requests</li>
              </ul>
              
              <p>
                <strong>We do NOT sell your personal information to third parties.</strong>
              </p>
            </section>

            <section>
              <h3>4. Data Security</h3>
              <p>We implement security measures to protect your information:</p>
              <ul>
                <li>Encrypted data transmission (HTTPS)</li>
                <li>Secure password storage (hashed passwords)</li>
                <li>Role-based access controls (RLS policies)</li>
                <li>Regular security audits and updates</li>
                <li>Secure document storage</li>
                <li>Activity logging for security monitoring</li>
              </ul>
              <p>
                However, no method of transmission over the internet is 100% secure. 
                While we strive to protect your information, we cannot guarantee absolute security.
              </p>
            </section>

            <section>
              <h3>5. Data Retention</h3>
              <p>We retain your information for as long as:</p>
              <ul>
                <li>Your account is active</li>
                <li>Necessary to provide services</li>
                <li>Required by law or legal obligations</li>
                <li>Needed to resolve disputes or enforce agreements</li>
              </ul>
              <p>
                When you delete your account, we will delete or anonymize your personal 
                information, except where retention is required by law.
              </p>
            </section>

            <section>
              <h3>6. Your Rights and Choices</h3>
              <p>You have the right to:</p>
              <ul>
                <li><strong>Access:</strong> Request access to your personal information</li>
                <li><strong>Correction:</strong> Update or correct inaccurate information</li>
                <li><strong>Deletion:</strong> Request deletion of your account and data</li>
                <li><strong>Withdrawal:</strong> Withdraw job applications at any time</li>
                <li><strong>Opt-out:</strong> Unsubscribe from non-essential notifications (account-related notifications cannot be disabled)</li>
                <li><strong>Data Portability:</strong> Request a copy of your data</li>
              </ul>
              <p>
                To exercise these rights, contact PESDO through the official channels 
                or use the account management features in your dashboard.
              </p>
            </section>

            <section>
              <h3>7. Cookies and Tracking</h3>
              <p>
                We use cookies and similar technologies to:
              </p>
              <ul>
                <li>Maintain your login session</li>
                <li>Remember your preferences</li>
                <li>Analyze platform usage (anonymized)</li>
                <li>Improve user experience</li>
              </ul>
              <p>
                You can control cookies through your browser settings, but this may 
                affect platform functionality.
              </p>
            </section>

            <section>
              <h3>8. Third-Party Links</h3>
              <p>
                Our platform may contain links to third-party websites. We are not 
                responsible for the privacy practices of these external sites. 
                We encourage you to review their privacy policies.
              </p>
            </section>

            <section>
              <h3>9. Children's Privacy</h3>
              <p>
                Our platform is intended for users who are at least 18 years old. 
                We do not knowingly collect information from individuals under 18. 
                If we become aware of such collection, we will take steps to delete 
                the information.
              </p>
            </section>

            <section>
              <h3>10. International Data Transfers</h3>
              <p>
                Your information may be processed and stored in servers located outside 
                the Philippines. By using our platform, you consent to the transfer of 
                your information to these servers.
              </p>
            </section>

            <section>
              <h3>11. Changes to Privacy Policy</h3>
              <p>
                We may update this Privacy Policy from time to time. We will notify 
                you of significant changes via email or platform notification. 
                Continued use after changes constitutes acceptance of the updated policy.
              </p>
            </section>

            <section>
              <h3>12. Contact Us</h3>
              <p>
                For questions, concerns, or requests regarding this Privacy Policy or 
                your personal information, please contact PESDO Surigao through the 
                official channels provided on the platform.
              </p>
            </section>

            <section>
              <h3>13. Consent</h3>
              <p>
                By using the PESDO platform, you consent to the collection, use, and 
                disclosure of your information as described in this Privacy Policy.
              </p>
            </section>
          </div>
        </div>
        <div className="privacy-modal-footer">
          <button className="privacy-modal-btn" onClick={onClose}>
            I Understand
          </button>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;

